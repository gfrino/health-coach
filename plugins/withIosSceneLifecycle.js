/**
 * Adotta il ciclo di vita UIScene su iOS, obbligatorio con l'SDK di iOS 27
 * (senza, l'app va in crash all'avvio: "UIScene life cycle is required for apps built with this SDK").
 *
 * Il package `expo` 57 contiene già `ExpoAppSceneDelegate`, ma il template nativo di SDK 57 non lo usa:
 * questo plugin replica il setup del template SDK 58. Da rimuovere passando a SDK 58.
 */
const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  createRunOncePlugin,
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require('@expo/config-plugins');

const SCENE_DELEGATE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

const withSceneManifest = (config) =>
  withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return config;
  });

const withSceneAppDelegate = (config) =>
  withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error('withIosSceneLifecycle: è supportato solo un AppDelegate Swift');
    }
    let src = config.modResults.contents;

    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      src = src.replace(
        /class AppDelegate: ExpoAppDelegate\s*\{/,
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      );
    }
    // La finestra e l'avvio di React Native passano a SceneDelegate.
    src = src.replace(
      /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)[\s\S]*?#endif\n/,
      '// Window e avvio di React Native sono gestiti da SceneDelegate (ciclo di vita UIScene, iOS 27).\n',
    );

    if (!src.includes('ExpoReactNativeFactoryProvider {')) {
      throw new Error('withIosSceneLifecycle: AppDelegate con struttura inattesa');
    }
    config.modResults.contents = src;
    return config;
  });

const withSceneDelegateFile = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
      const file = path.join(config.modRequest.platformProjectRoot, projectName, 'SceneDelegate.swift');
      await fs.promises.writeFile(file, SCENE_DELEGATE);
      return config;
    },
  ]);

const withSceneDelegateInProject = (config) =>
  withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
    const filePath = `${projectName}/SceneDelegate.swift`;
    if (!project.hasFile(filePath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: filePath,
        groupName: projectName,
        project,
      });
    }
    return config;
  });

const withIosSceneLifecycle = (config) => {
  config = withSceneManifest(config);
  config = withSceneAppDelegate(config);
  config = withSceneDelegateFile(config);
  config = withSceneDelegateInProject(config);
  return config;
};

module.exports = createRunOncePlugin(withIosSceneLifecycle, 'with-ios-scene-lifecycle', '1.0.0');
