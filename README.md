# React Native plugin for CodePush

This plugin provides client-side integration for the [CodePush service](https://microsoft.github.io/code-push), allowing you to easily add a dynamic update experience to your React Native app(s).

## How does it work?

A React Native app is composed of a `.jsbundle` file which is generated by the packager and distributed as part of your app's binary (the `.ipa` or `.apk` file). Traditionally, in order to update any of the JavaScript code, you'd need to recompile and re-distribute the binary, which includes any review time associated with the respective store(s) you are publishing to.

The CodePush plugin for React Native helps simplify and speed up the process of getting JavaScript changes to your end-users by keeping the `.jsbundle` file synchronized with updates that are released to the CodePush server. This way, your app gets the benefits of an offline mobile experience, as well as the "web-like" agility of side-loading updates as soon as they are available. 

## Supported React Native platforms

- iOS
- Coming soon: Android (Try it out on [this branch](https://github.com/Microsoft/react-native-code-push/tree/first-check-in-for-android))

## Getting Started

To get started, you first need to acquire the React Native CodePush plugin by running the following command from within your app's root directory:

```
npm install --save react-native-code-push
```

## Plugin Installation 

Once you've acquired the CodePush plugin, you need to integrate it into the Xcode project of your React Native app. To do this, take the following steps:

1. Open your app's Xcode project
2. Find the `CodePush.xcodeproj` file witin the `node_modules/react-native-code-push` directory, and drag it into the `Libraries` node in Xcode

    ![Add CodePush to project](https://cloud.githubusercontent.com/assets/516559/10322414/7688748e-6c32-11e5-83c1-00d3e6758df4.png)

3. Select the project node in Xcode and select the "Build Phases" tab of your project configuration.
4. Drag `libCodePush.a` from `Libraries/CodePush.xcodeproj/Products` into the "Link Binary With Libraries" secton of your project's "Build Phases" configuration.

    ![Link CodePush during build](https://cloud.githubusercontent.com/assets/516559/10322221/a75ea066-6c31-11e5-9d88-ff6f6a4d6968.png)

5. Under the "Build Settings" tab of your project configuration, find the "Header Search Paths" section and edit the value.
Add a new value, `$(SRCROOT)/../node_modules/react-native-code-push` and select "recursive" in the dropdown.

    ![Add CodePush library reference](https://cloud.githubusercontent.com/assets/516559/10322038/b8157962-6c30-11e5-9264-494d65fd2626.png)

## Plugin Configuration

Once your Xcode project has been setup to build/link the CodePush plugin, you need to configure your app to consult CodePush for the location of your JS bundle, since it is responsible for synchronizing it with updates that are released to the CodePush server. To do this, perform the following steps:

1. Open up the `AppDelegate.m` file, and add an import statement for the CodePush headers:

    ```
    #import "CodePush.h"
    ```

2. Find the following line of code, which loads your JS Bundle from the app binary:

    ```
    jsCodeLocation = [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
    ```
    
3. Replace it with this line:

    ```
    jsCodeLocation = [CodePush bundleURL];
    ```

This change configures your app to always load the most recent version of your app's JS bundle. On the initial launch, this will correspond to the file that was compiled with the app. However, after an update has been pushed via CodePush, this will return the location of the most recently installed update.

*NOTE: The `bundleURL` method assumes your app's JS bundle is named `main.jsbundle`. If you have configured your app to use a different file name, simply call the `bundleURLForResource:` method (which assumes you're using the `.jsbundle` extension) or `bundleURLForResource:withExtension:` method instead, in order to overwrite that default behavior*

To let the CodePush runtime know which deployment it should query for updates against, perform the following steps:

1. Open your app's `Info.plist` and add a new `CodePushDeploymentKey` entry, whose value is the key of the deployment you want to configure this app against (e.g. the Staging deployment for FooBar app). You can retreive this value by running `code-push deployment ls <appName>` in the CodePush CLI, and copying the value of the `Deployment Key` column which corresponds to the deployment you want to use. 
2. In your app's `Info.plist` make sure your `CFBundleShortVersionString` value is a valid [semver](http://semver.org/) version (e.g. 1.0.0 not 1.0)

## Plugin consumption

With the CodePush plugin downloaded and linked, and your app asking CodePush where to get the right JS bundle from, the only thing left is to add the neccessary code to your app to control the following:

1. When (and how often) to check for an update? (e.g. app start, in response to clicking a button in a settings page, periodically at some fixed interval)
2. When an update is available, how to present it to the end-user?

The simplest way to do this is to perform the following in your app's root component:

1. Import the JavaScript module for CodePush:

    ```
    var CodePush = require("react-native-code-push")
    ```

2. Call the `sync` method from within the `componentDidMount` lifecycle event, to initiate a background update on each app start:

    ```
    CodePush.sync();
    ```

If an update is available, it will be silently downloaded, and installed the next time the app is restarted (either explicitly by the end-user or by the OS), which ensures the least invasive experience for your end-users. If you would like to display a confirmation dialog (an "active install"), or customize the update experience in any way, refer to the `sync` method's [API reference](#codepushsync) for information on how to tweak this default behavior.

## Releasing code updates

Once your app has been configured and distributed to your users, and you've made some JS changes, it's time to release it to them instantly! To do this, run the following steps:

1. Execute `react-native bundle` in order to generate the JS bundle for your app.
2. Execute `code-push release <appName> ./ios/main.jsbundle <appVersion> --deploymentName <deploymentName>` in order to publish the generated JS bundle to the server (assuming your CWD is the root directory of your React Native app). 

And that's it! For more information regarding the CodePush API, including the various options you can pass to the `sync` method, refer to the reference section below.

---

## API Reference

### Top-level module methods

When you require the `react-native-code-push` module, that object provides the following methods directly on it:

* [checkForUpdate](#codepushcheckforupdate): Queries the CodePush service for an update against the configured deployment. This method returns a promise which resolves to a `RemotePackage` that can be subsequently downloaded.
* [getCurrentPackage](#codepushgetcurrentpackage): Gets information about the currently installed package (e.g. description, installation time)
* [notifyApplicationReady](#codepushnotifyapplicationready): Notifies the CodePush runtime that an installed update is considered successful. This is an optional API, but is useful when you want to expicitly enable "rollback protection" in the event that an exception occurs in any code that you've deployed to production.
* [restartPendingUpdate](#codepushrestartPendingUpdate): Conditionally restarts the app if a previously installed update is currently pending (e.g. it was installed using the `ON_NEXT_RESTART` or `ON_NEXT_RESUME` modes, and the user hasn't restarted or resumed the app yet).
* [sync](#codepushsync): Allows checking for an update, downloading it and installing it, all with a single call. Unless you need custom UI and/or behavior, we recommend most developers to use this method when integrating CodePush into their apps

#### codePush.checkForUpdate

```javascript
codePush.checkForUpdate(deploymentKey: String = null): Promise<RemotePackage>;
```

Queries the CodePush service for an update using the deployment configured either in your `Info.plist` file or specified using the optional `deploymentKey` parameter. This method returns a promise which resolves to a `RemotePackage` that can be subsequently downloaded.

`checkForUpdate` returns a Promise that resolves to one of two values:

* `null` if there is no update available
* A `RemotePackage` instance that represents an available update that can be downloaded

Example Usage: 

```javascript
codePush.checkForUpdate().then((update) => {
    if (!update) {
        console.log("The app is up to date!"); 
    } else {
        console.log("An update is available! Should we download it?");
    }
});

```

#### codePush.getCurrentPackage

```javascript
codePush.getCurrentPackage(): Promise<LocalPackage>;
```

Gets information about the currently installed package (e.g. description, installation time).

This method returns a Promise that resolves with the `LocalPackage` instance that represents the running update. This API is only useful for advanced scenarios, and so many devs won't need to concern themselves with it.

#### codePush.notifyApplicationReady

```javascript
codePush.notifyApplicationReady(): Promise<void>;
```

Notifies the CodePush runtime that an update is considered successful, and therefore, a rollback isn't neccessary. Calling this function is required whenever the `rollbackTimeout` parameter is specified when calling either ```LocalPackage.install``` or `sync`. If you specify a `rollbackTimeout`, and don't call `notifyApplicationReady`, the CodePush runtime will assume that the installed update has failed and roll back to the previous version.

If the `rollbackTimeout` parameter was not specified, the CodePush runtime will not enforce any automatic rollback behavior, and therefore, calling this function is not required and will result in a no-op.

#### codePush.restartPendingUpdate		
		
```javascript		
codePush.restartPendingUpdate(): void;		
```		
		
Installs the pending update (if applicable) by immediately restarting the app, and optionally starting the rollback timer. This method is for advanced scenarios, and is only useful when the following conditions are true:		
		
1. Your app is specifying an install mode value of `ON_NEXT_RESTART` or `ON_NEXT_RESUME` when calling the `sync` or `LocalPackage.install` methods. This has the effect of not applying your update until the app has been restarted (by either the end-user or OS)	or resumed, and therefore, the update won't be immediately displayed to the end-user 	.
2. You have an app-specific user event (e.g. the end-user navigated back to the app's home route) that allows you to apply the update in an unobtrusive way, and potentially gets the update in front of the end-user sooner then waiting until the next restart or resume.		
		
If you call this method, and there isn't a pending update, it will result in a no-op. Otherwise, the app will be restarted in order to display the update to the end-user.

#### codePush.sync

```javascript
codePush.sync(options: Object, syncStatusChangeCallback: function(syncStatus: Number), downloadProgressCallback: function(progress: DownloadProgress)): Promise<Number>;
```

Provides a simple method for checking for an update and subsequently downloading and installing it. This method provides support for two different (but customizable) "modes" to easily enables apps with different requirements:

1. **Silent mode** *(the default behavior)*, which automatically downloads available updates, and applies them the next time the app restarts. This way, the entire update experience is "silent" to the end-user, since they don't see any update prompt and/or "synthentic" app restarts.

2. **Active mode**, which when an update is available, prompts the end-user for permission before downloading it, and then immediately applies the update. If an update was released using the `mandatory` flag, the end-user would still be notified about the update, but they wouldn't have the choice to ignore it.


Example Usage: 

```javascript
// Fully silent update
codePush.sync();

// Active update
codePush.sync({ updateDialog: true, installMode: codePush.InstallMode.IMMEDIATE });
```

*Note: If you want to determine whether you check and/or download an available update based on the end-user's device battery level, network conditions, etc. then simply wrap the call to `sync` in a condition that ensures you only call it when desired.*

While the `sync` method tries to make it easy to perform silent and active updates, with little configuration, it accepts an "options" object that allows you to customize numerous aspects of the default behavior:

* __deploymentKey__ *(String)* - Specifies the deployment key you want to query for an update against. By default, this value is derived from the `Info.plist` file, but this option allows you to override it from the script-side if you need to dynamically use a different deployment for a specific call to `sync`.

* __ignoreFailedUpdates__ *(Boolean)* - Indicates whether you would like to automatically ignored updates which are available on the server, but have already failed previous installation attempts. Defaults to `true`.

* __installMode__ *(CodePush.InstallMode)* - Indicates when you would like to "install" the update after downloading it, which includes reloading the JS bundle in order for any changes to take affect. Defaults to `CodePush.InstallMode.ON_NEXT_RESTART`.

* __rollbackTimeout__ *(Number)* - The number of milliseconds that you want the runtime to wait after an update has been installed before considering it failed and rolling it back. Defaults to `0`, which disables rollback protection.

* __updateDialog__ *(UpdateDialogOptions)* - The options object used to customize the dialog displayed to the end-user when employing an "active" update workflow. Unspecified fields in the object provided will default to the values shown below, hence the boolean flag `true`, or any other truthy value will cause the default values below to be used. A falsey value will disable the display of a dialog, in which case updates will be downloaded automatically. Defaults to `null` (do not show a dialog). The list of `UpdateDialogOptions` are as follows:
    * __appendReleaseDescription__ *(Boolean)* - Indicates whether you would like to append the description of an available release to the notification message which is displayed to the end-user. Defaults to `false`.
    
    * __descriptionPrefix__ *(String)* - Indicates the string you would like to prefix the release description with, if any, when displaying the update notification to the end-user. Defaults to `" Description: "`
    
    * __mandatoryContinueButtonLabel__ *(String)* - The text to use for the button the end-user must press in order to install a mandatory update. Defaults to `"Continue"`.
    
    * __mandatoryUpdateMessage__ *(String)* - The text used as the body of an update notification, when the update is specified as mandatory. Defaults to `"An update is available that must be installed."`.
    
    * __optionalIgnoreButtonLabel__ *(String)* - The text to use for the button the end-user can press in order to ignore an optional update that is available. Defaults to `"Ignore"`.
    
    * __optionalInstallButtonLabel__ *(String)* - The text to use for the button the end-user can press in order to install an optional update. Defaults to `"Install"`.
    
    * __optionalUpdateMessage__ *(String)* - The text used as the body of an update notification, when the update is optional. Defaults to `"An update is available. Would you like to install it?"`.
    
    * __title__ *(String)* - The text used as the header of an update notification that is displayed to the end-user. Defaults to `"Update available"`.

Example Usage:

```javascript
// Use a different deployment key for this
// specific call, instead of the one configured
// in the Info.plist file
codePush.sync({ deploymentKey: "KEY" });

// Download the update silently
// but install is on the next resume
// instead of waiting until the app is restarted
codePush.sync({ installMode: codePush.InstallMode.ON_NEXT_RESUME });

// Changing the title displayed in the
// confirmation dialog of an "active" update
codePush.sync({ updateDialog: { title: "An update is available!" } });
```

In addition to the options, the `sync` method also accepts two optional function parameters which allow you to subscribe to the lifecycle of the `sync` "pipeline" in order to display additional UI as needed (e.g. a "checking for update modal or a download progress modal):

* __syncStatusChangeCallback__ *((syncStatus: Number) => void)* - Called when the sync process moves from one step to another in the overall update process. The method is called with a status code which represents the current state, and can be any of the following values:
    * __CodePush.SyncStatus.CHECKING_FOR_UPDATE__ *(0)* -  The CodePush server is being queried for an update.
    * __CodePush.SyncStatus.AWAITING_USER_ACTION__ *(1)* - An update is available, and a confirmation dialog was shown to the end-user. (This is only applicable when the `updateDialog` is used)
    * __CodePush.SyncStatus.DOWNLOADING_PACKAGE__ *(2)* - An available update is being downloaded from the CodePush server.
    * __CodePush.SyncStatus.INSTALLING_UPDATE__ *(3)* - An available udpate was downloaded and is about to be installed.
    * __CodePush.SyncStatus.UP_TO_DATE__ *(4)* - The app is fully up-to-date with the configured deployment.
    * __CodePush.SyncStatus.UPDATE_IGNORED__ *(5)* - The app has an optional update, which the end-user chose to ignore. (This is only applicable when the `updateDialog` is used)
    * __CodePush.SyncStatus.UPDATE_INSTALLED__ *(6)* - An available update has been installed and will be run either immediately after the syncStatusCallback function returns or the next time the app resumes/restarts, depending on the `InstallMode` specified in `SyncOptions`.
    * __CodePush.SyncStatus.UNKNOWN_ERROR__ *(-1)* - The sync operation encountered an unknown error. 
    
* __downloadProgressCallback__ *((progress: DownloadProgress) => void)* - Called periodically when an available update is being downloaded from the CodePush server. The method is called with a `DownloadProgress` object, which contains the following two properties:
    * __totalBytes__ *(Number)* - The total number of bytes expected to be received for this update package
    * __receivedBytes__ *(Number)* - The number of bytes downloaded thus far.

Example Usage:

```javascript
// Prompt the user when an update is available
// and then display a "downloading" modal 
codePush.sync({ updateDialog: true }, (status) => {
    switch (status) {
        case CodePush.SyncStatus.DOWNLOADING_PACKAGE:
            // Show "downloading" modal
            break;
        case CodePush.SyncStatus.INSTALLING_UPDATE:
            // Hide "downloading" modal
            break;
    }
});
```

The method returns a `Promise` that is resolved with a `SyncStatus` code that indicates why the `sync` call succeeded. This code can be one of the following values:

* __CodePush.SyncStatus.UP_TO_DATE__ *(4)* - The app is up-to-date with the CodePush server.
* __CodePush.SyncStatus.UPDATE_IGNORED__ *(5)* - The app has an optional update, that the user chose to ignore.
* __CodePush.SyncStatus.UPDATE_INSTALLED__ *(6)* - The update has been installed and will be run either immediately after the syncStatusCallback function returns or the next time the app resumes/restarts, depending on the `InstallMode` specified in `SyncOptions`.

If the update check and/or the subseqeuent download fails for any reason, the `Promise` object returned by `sync` will be rejected with the reason.

The `sync` method can be called anywhere you'd like to check for an update. That could be in the `componentWillMount` lifecycle event of your root component, the onPress handler of a `<TouchableHighlight>` component, in the callback of a periodic timer, or whatever else makes sense for your needs. Just like the `checkForUpdate` method, it will perform the network request to check for an update in the background, so it won't impact your UI thread and/or JavaScript thread's responsiveness.

### Package objects

The `checkForUpdate` and `getCurrentPackage` methods return promises, that when resolved, provide acces to "package" objects. The package represents your code update as well as any extra metadata (e.g. description, mandatory). The CodePush API has the distinction between the following types of packages:

* [LocalPackage](#localpackage): Represents a locally available package that either representing the currently running code or an update that hasn't been installed yet
* [RemotePackage](#remotepackage): Represents a remotely available package that provides an update to the app, and can be downloaded

#### LocalPackage

Contains details about an update package that has been downloaded locally or already installed (currently installed package). You can get a reference to an instance of this object either by calling the module-level `getCurrentPackage` method, or as the value of the promise returned by the `download` method of a RemotePackage.

##### Properties
- __appVersion__: The native version of the application this package update is intended for. (String)
- __deploymentKey__: Deployment key of the package. (String) This is the same value that you added to your `Info.plst` file.
- __description__: Package description. (String) This is the same value that you specified in the CLI when you released the update
- __failedInstall__: Indicates whether this package instance had been previously installed but was rolled back. (Boolean) The `sync` method will automatically ignore updates which have previously failed, so you only need to worry about this property if using `checkForUpdate`.
- __label__: Package label. (String)
- __isMandatory__: Flag indicating if the update is mandatory. (Boolean) This is the value that you specified in the CLI when you released the update
- __packageHash__: The hash value of the package. (String)
- __packageSize__: The size of the package, in bytes. (Number)
- __isFirstRun__: Flag indicating whether this is the first time the package has been run after being installed. (Boolean) This is useful for determining whether you would like to show a "What's New?" UI to the end-user after installing an update.

##### Methods
- __install(rollbackTimeout: Number = 0, installMode: CodePush.InstallMode = CodePush.InstallMode.UPDATE_ON_RESTART): Promise&lt;void&gt;__: Installs this package to the application by unzipping its contents (e.g. the JS bundle) and saving it to the location on disk where the runtime expects to find the latest version of the app. If the `InstallMode` parameter is set to `UPDATE_ON_RESTART`, the install will complete, but it won't take effect until the next time that the app is restarted. If it is `UPDATE_ON_RESUME`, it will take effect when the app is next resumed after going into the background. If the parameter is set to `IMMEDIATE`, it will immediately restart after performing the install, so that the end-user sees the changes.
<br /><br />
If a value greater than zero is provided to the `rollbackTimeout` parameter, the application will wait for the `notifyApplicationReady` method to be called for the given number of milliseconds.
<br /><br />
Note: The "rollback timer" doesn't start until the update has actually become active. If the `installMode` is `IMMEDIATE`, then the rollback timer will also start immediately. However, if the `installMode` is `UPDATE_ON_RESTART` or `UPDATE_ON_RESUME`, then the rollback timer will start the next time the app starts or resumes, not at the point that you called `install`.

#### RemotePackage

Contains details about an update package that is available for download. You get a reference to an instance this object by calling the `checkForUpdate` method when an update is available. If you are using the `sync` API, you don't need to worry about the `RemotePackage`, since it will handle the download and application process automatically for you.

##### Properties

The `RemotePackage` inherits all of the same properties as the `LocalPackage`, but includes one additional one:

- __downloadUrl__: The URL at which the package is available for download. (String). This property is only needed for advanced usage, since the `download` method will automatically handle the acquisition of updates for you.

##### Methods
- __download(downloadProgressCallback?: Function): Promise<LocalPackage>__: Downloads the package update from the CodePush service. If a `downloadProgressCallback` is specified, it will be called periodically with a `DownloadProgress` object (`{ totalBytes: Number, receivedBytes: Number }`) that reports the progress of the download until the download completes. Returns a Promise that resolves with the `LocalPackage`.

---

## Debugging

When debugging your JavaScript using Chrome, make sure that your JS bundle location is configured in your `AppDelegate.m` file to point at the packager URL, since that will provide you with the most effecient debugging experience. Since your CodePush deployment key is specified in either the `Info.plist` file or your call(s) to the `sync` and/or `checkForUpdate` methods, any calls to `sync` or `checkForUpdate` will work just fine regardless if your `AppDelegate.m` file hasn't be configured to use the `[CodePush bundleURL]` method for its JS bundle location. 