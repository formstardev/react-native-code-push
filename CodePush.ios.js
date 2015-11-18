'use strict';

var extend = require("extend");
var NativeCodePush = require("react-native").NativeModules.CodePush;
var requestFetchAdapter = require("./request-fetch-adapter.js");
var Sdk = require("code-push/script/acquisition-sdk").AcquisitionManager;
var packageMixins = require("./package-mixins")(NativeCodePush);

var { AlertIOS } = require("react-native");

// This function is only used for tests. Replaces the default SDK, configuration and native bridge
function setUpTestDependencies(providedTestSdk, providedTestConfig, testNativeBridge){
  if (providedTestSdk) testSdk = providedTestSdk;
  if (providedTestConfig) testConfig = providedTestConfig;
  if (testNativeBridge) NativeCodePush = testNativeBridge;
}
var testConfig;
var testSdk;

var getConfiguration = (() => {
  var config;
  return function getConfiguration() {
    if (config) {
      return Promise.resolve(config);
    } else if (testConfig) {
      return Promise.resolve(testConfig);
    } else {
      return NativeCodePush.getConfiguration()
        .then((configuration) => {
          if (!config) config = configuration;
          return config;
        });
    }
  }
})();

var getSdk = (() => {
  var sdk;
  return function getSdk() {
    if (sdk) {
      return Promise.resolve(sdk);
    } else if (testSdk) {
      return Promise.resolve(testSdk);
    } else {
      return getConfiguration()
        .then((configuration) => {
          sdk = new Sdk(requestFetchAdapter, configuration);
          return sdk;
        });
    }
  }
})();

function getCurrentPackage() {
  return new Promise((resolve, reject) => {
    var localPackage;
    NativeCodePush.getCurrentPackage()
      .then((currentPackage) => {
        localPackage = currentPackage;
        return NativeCodePush.isFailedUpdate(currentPackage.packageHash);
      })
      .then((failedUpdate) => {
        localPackage.failedInstall = failedUpdate;
        return NativeCodePush.isFirstRun(localPackage.packageHash);
      })
      .then((isFirstRun) => {
        localPackage.isFirstRun = isFirstRun;
        resolve(localPackage);
      })
      .catch(reject)
      .done();
  });
}

function checkForUpdate() {
  var config;
  var sdk;
  
  return getConfiguration()
          .then((configResult) => {
            config = configResult;
            return getSdk();
          })
          .then((sdkResult) => {
            sdk = sdkResult;
            return getCurrentPackage();
          })
          .then((localPackage) => {
            var queryPackage = { appVersion: config.appVersion };
            if (localPackage && localPackage.appVersion === config.appVersion) {
              queryPackage = localPackage;
            }

            return new Promise((resolve, reject) => {
              sdk.queryUpdateWithCurrentPackage(queryPackage, (err, update) => {
                if (err) {
                  return reject(err);
                }
                
                // Ignore updates that require a newer app version,
                // since the end-user couldn't reliably install it
                if (!update || update.updateAppVersion) {
                  return resolve(null);
                }

                update = extend(update, packageMixins.remote);
                
                NativeCodePush.isFailedUpdate(update.packageHash)
                  .then((isFailedHash) => {
                    update.failedInstall = isFailedHash;
                    resolve(update);
                  })
                  .catch(reject)
                  .done();
              })
            });
          });
}

/**
 * The sync method provides a simple, one-line experience for
 * incorporating the check, download and application of an update.
 * 
 * It simply composes the existing API methods together and adds additional
 * support for respecting mandatory updates, ignoring previously failed
 * releases, and displaying a standard confirmation UI to the end-user
 * when an update is available.
 */
function sync(options = {}, onSyncStatusChange, onDownloadProgress) {  
  var syncOptions = {
    
    ignoreFailedUpdates: true,
    installMode: CodePush.InstallMode.ON_NEXT_RESTART,
    rollbackTimeout: 0,
    updateDialog: null,
    
    ...options 
  };
  
  onSyncStatusChange = typeof onSyncStatusChange == "function"
    ? onSyncStatusChange
    : function(syncStatus) {
        switch(syncStatus) {
          case CodePush.SyncStatus.CHECKING_FOR_UPDATE:
            console.log("Checking for update.");
            break;
          case CodePush.SyncStatus.DOWNLOADING_PACKAGE:
            console.log("Downloading package.");
            break;
          case CodePush.SyncStatus.AWAITING_USER_ACTION:
            console.log("Awaiting user action.");
            break;
          case CodePush.SyncStatus.INSTALLING_UPDATE:
            console.log("Installing update.");
            break;
          case CodePush.SyncStatus.IDLE:
            console.log("Sync is idle.");
            break;
        }
      };
    
  onDownloadProgress = typeof onDownloadProgress == "function" 
    ? onDownloadProgress 
    : function(downloadProgress) {
        console.log(`Expecting ${downloadProgress.totalBytes} bytes, received ${downloadProgress.receivedBytes} bytes.`);
      };
  
  return new Promise((resolve, reject) => {
    onSyncStatusChange(CodePush.SyncStatus.CHECKING_FOR_UPDATE);
    checkForUpdate()
      .then((remotePackage) => {
        var doDownloadAndInstall = () => {
          onSyncStatusChange(CodePush.SyncStatus.DOWNLOADING_PACKAGE);
          remotePackage.download(onDownloadProgress)
            .then((localPackage) => {
              onSyncStatusChange(CodePush.SyncStatus.INSTALLING_UPDATE);
              return localPackage.install(syncOptions.rollbackTimeout, syncOptions.installMode)
            })
            .then(() => {
              onSyncStatusChange(CodePush.SyncStatus.IDLE);
              resolve(CodePush.SyncResult.UPDATE_INSTALLED)
            })
            .catch(reject)
            .done();
        }
        
        if (!remotePackage || (remotePackage.failedInstall && syncOptions.ignoreFailedUpdates)) {
          onSyncStatusChange(CodePush.SyncStatus.IDLE);
          resolve(CodePush.SyncResult.UP_TO_DATE);
        }
        else if (syncOptions.updateNotification) {
          syncOptions.updateNotification = Object.assign(CodePush.DEFAULT_UPDATE_DIALOG, syncOptions.updateNotification);
          
          var message = null;
          var dialogButtons = [
            {
              text: null,
              onPress: () => { 
                doDownloadAndInstall();
              }
            }
          ];
          
          if (remotePackage.isMandatory) {
            message = syncOptions.updateNotification.mandatoryUpdateMessage;
            dialogButtons[0].text = syncOptions.mandatoryContinueButtonLabel;
          } else {
            message = syncOptions.updateNotification.optionalUpdateMessage;
            dialogButtons[0].text = syncOptions.updateNotification.optionalInstallButtonLabel;     
            
            // Since this is an optional update, add another button
            // to allow the end-user to ignore it       
            dialogButtons.push({
              text: syncOptions.updateNotification.optionalIgnoreButtonLabel,
              onPress: () => resolve(CodePush.SyncResult.UPDATE_IGNORED)
            });
          }
          
          // If the update has a description, and the developer
          // explicitly chose to display it, then set that as the message
          if (syncOptions.updateNotification.appendReleaseDescription && remotePackage.description) {
            message += `${syncOptions.updateNotification.descriptionPrefix} ${remotePackage.description}`;  
          }
          
          onSyncStatusChange(CodePush.SyncStatus.AWAITING_USER_ACTION);
          AlertIOS.alert(syncOptions.updateTitle, message, dialogButtons);
        } else {
          doDownloadAndInstall();
        }
      })
      .catch(reject)
      .done();
  });     
};

var CodePush = {
  checkForUpdate: checkForUpdate,
  getConfiguration: getConfiguration,
  getCurrentPackage: getCurrentPackage,
  notifyApplicationReady: NativeCodePush.notifyApplicationReady,
  setUpTestDependencies: setUpTestDependencies,
  sync: sync,
  InstallMode: {
    IMMEDIATE: NativeCodePush.codePushInstallModeImmediate, // Restart the app immediately
    ON_NEXT_RESTART: NativeCodePush.codePushInstallModeOnNextRestart, // Don't artificially restart the app. Allow the update to be "picked up" on the next app restart
    ON_NEXT_RESUME: NativeCodePush.codePushInstallModeOnNextResume // Restart the app the next time it is resumed from the background
  },
  SyncResult: {
    UP_TO_DATE: 0, // The running app is up-to-date
    UPDATE_IGNORED: 1, // The app had an optional update and the end-user chose to ignore it
    UPDATE_INSTALLED: 2 // The app had an optional/mandatory update that was successfully downloaded and is about to be installed.
  },
  SyncStatus: {
    CHECKING_FOR_UPDATE: 0,
    AWAITING_USER_ACTION: 1,
    DOWNLOADING_PACKAGE: 2,
    INSTALLING_UPDATE: 3,
    IDLE: 4
  },
  DEFAULT_UPDATE_DIALOG: {
    appendReleaseDescription: false,
    descriptionPrefix: " Description: ",
    mandatoryContinueButtonLabel: "Continue",
    mandatoryUpdateMessage: "An update is available that must be installed.",
    optionalIgnoreButtonLabel: "Ignore",
    optionalInstallButtonLabel: "Install",
    optionalUpdateMessage: "An update is available. Would you like to install it?",
    updateTitle: "Update available",
  }
};

module.exports = CodePush;
