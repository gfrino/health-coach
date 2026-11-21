/**
 * CarPlay: AlbA come "app di conversazione vocale" (iOS 26.4+), il coach a voce sullo schermo dell'auto.
 *
 * - Scena CarPlay nel manifest delle scene (dopo withIosSceneLifecycle, che lo riscrive).
 * - CarPlaySceneDelegate nel target dell'app: collega i template (modulo car-voice) e avvia
 *   React Native senza finestra ("AlbACar", vedi index.ts), così il coach funziona anche con
 *   il telefono bloccato e l'app chiusa.
 * - Audio in background (solo con CARPLAY_ENTITLED=1): la conversazione continua a telefono spento.
 * - Entitlement com.apple.developer.carplay-voice-based-conversation: lo concede Apple su richiesta.
 *   Finché non è approvato e aggiunto all'App ID, la build fallirebbe la firma: si aggiunge solo
 *   con CARPLAY_ENTITLED=1 (in eas.json quando Apple l'ha concesso, o per il simulatore).
 */
const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  createRunOncePlugin,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} = require('@expo/config-plugins');

const ENTITLEMENT = 'com.apple.developer.carplay-voice-based-conversation';

const DELEGATE = `import CarPlay
internal import CarVoice
internal import Expo
import React

/// Scena CarPlay di AlbA (generata da plugins/withCarPlay.js).
@objc(CarPlaySceneDelegate)
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  /// Superficie React Native senza finestra che ospita il coach vocale dell'auto.
  private static var carRootView: UIView?

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    CarVoiceBridge.shared.connect(interfaceController)
    Self.startJavaScript()
  }

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    CarVoiceBridge.shared.disconnect()
    Self.carRootView = nil
  }

  /// Avvia (o riusa) il runtime JS dell'app e monta il componente "AlbACar".
  private static func startJavaScript() {
    guard carRootView == nil,
      let provider = UIApplication.shared.delegate as? ExpoReactNativeFactoryProvider,
      let factory = provider.reactNativeFactory
    else { return }
    carRootView = factory.rootViewFactory.view(withModuleName: "AlbACar")
  }
}
`;

const withCarPlayScene = (config) =>
  withInfoPlist(config, (config) => {
    const manifest = config.modResults.UIApplicationSceneManifest ?? {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {},
    };
    manifest.UISceneConfigurations = {
      ...manifest.UISceneConfigurations,
      CPTemplateApplicationSceneSessionRoleApplication: [
        {
          UISceneConfigurationName: 'CarPlay',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).CarPlaySceneDelegate',
        },
      ],
    };
    config.modResults.UIApplicationSceneManifest = manifest;

    // Audio in background solo con CarPlay attivo: senza, Apple contesterebbe una modalità non usata.
    if (process.env.CARPLAY_ENTITLED === '1') {
      const modes = new Set(config.modResults.UIBackgroundModes ?? []);
      modes.add('audio');
      config.modResults.UIBackgroundModes = [...modes];
    }
    return config;
  });

const withCarPlayEntitlement = (config) =>
  withEntitlementsPlist(config, (config) => {
    if (process.env.CARPLAY_ENTITLED === '1') config.modResults[ENTITLEMENT] = true;
    else delete config.modResults[ENTITLEMENT];
    return config;
  });

const withCarPlayDelegateFile = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
      const file = path.join(
        config.modRequest.platformProjectRoot,
        projectName,
        'CarPlaySceneDelegate.swift',
      );
      await fs.promises.writeFile(file, DELEGATE);
      return config;
    },
  ]);

const withCarPlayDelegateInProject = (config) =>
  withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
    const filePath = `${projectName}/CarPlaySceneDelegate.swift`;
    if (!project.hasFile(filePath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: filePath,
        groupName: projectName,
        project,
      });
    }
    return config;
  });

const withCarPlay = (config) => {
  config = withCarPlayScene(config);
  config = withCarPlayEntitlement(config);
  config = withCarPlayDelegateFile(config);
  config = withCarPlayDelegateInProject(config);
  return config;
};

module.exports = createRunOncePlugin(withCarPlay, 'with-carplay', '1.0.0');
