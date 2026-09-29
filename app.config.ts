import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Permessi Health Connect dichiarati nel manifest (solo lettura: la v1.0 non scrive mai).
 * Devono restare allineati con i record type richiesti dall'adapter (src/sources/healthconnect).
 */
const P = 'android.permission.health.';

const HEALTH_CONNECT_READ_PERMISSIONS = [
  `${P}READ_STEPS`,
  `${P}READ_DISTANCE`,
  `${P}READ_FLOORS_CLIMBED`,
  `${P}READ_ACTIVE_CALORIES_BURNED`,
  `${P}READ_BASAL_METABOLIC_RATE`,
  `${P}READ_TOTAL_CALORIES_BURNED`,
  `${P}READ_HEART_RATE`,
  `${P}READ_RESTING_HEART_RATE`,
  `${P}READ_HEART_RATE_VARIABILITY`,
  `${P}READ_VO2_MAX`,
  `${P}READ_SLEEP`,
  `${P}READ_WEIGHT`,
  `${P}READ_HEIGHT`,
  `${P}READ_BODY_FAT`,
  `${P}READ_LEAN_BODY_MASS`,
  `${P}READ_BLOOD_PRESSURE`,
  `${P}READ_BLOOD_GLUCOSE`,
  `${P}READ_OXYGEN_SATURATION`,
  `${P}READ_RESPIRATORY_RATE`,
  `${P}READ_BODY_TEMPERATURE`,
  `${P}READ_EXERCISE`,
  `${P}READ_NUTRITION`,
  `${P}READ_HYDRATION`,
  `${P}READ_MENSTRUATION`,
  `${P}READ_MINDFULNESS`,
  // Lettura in background e dello storico oltre i 30 giorni precedenti al consenso.
  `${P}READ_HEALTH_DATA_IN_BACKGROUND`,
  `${P}READ_HEALTH_DATA_HISTORY`,
] as const;

/**
 * APP_VARIANT = development | preview | production (impostato dai profili in eas.json).
 * Le varianti non-production hanno bundle id e nome distinti, così possono
 * convivere sullo stesso dispositivo con la versione dello store.
 */
const variant = (process.env.APP_VARIANT ?? 'development') as
  'development' | 'preview' | 'production';

/** Progetto EAS @ticinoweb/health-coach (non è un segreto). */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? '90f2abc0-4279-4591-8482-ce14873179c8';

const BASE_BUNDLE_ID = process.env.APP_BUNDLE_ID ?? 'ch.ticinoweb.healthcoach';
const bundleId =
  variant === 'production'
    ? BASE_BUNDLE_ID
    : `${BASE_BUNDLE_ID}.${variant === 'preview' ? 'preview' : 'dev'}`;
const appName =
  variant === 'production'
    ? 'Health Coach'
    : `Health Coach (${variant === 'preview' ? 'Preview' : 'Dev'})`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appName,
  slug: 'health-coach',
  owner: process.env.EAS_OWNER ?? 'ticinoweb',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'healthcoach',
  userInterfaceStyle: 'automatic',
  // fingerprint: ogni modifica nativa cambia il runtime, così un OTA non arriva mai a una build incompatibile.
  runtimeVersion: { policy: 'fingerprint' },
  updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}` },
  // Stringhe di sistema (permessi) localizzate per iOS.
  locales: {
    it: './locales/native/it.json',
    en: './locales/native/en.json',
    de: './locales/native/de.json',
    fr: './locales/native/fr.json',
  },
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      CFBundleDevelopmentRegion: 'it',
      CFBundleAllowMixedLocalizations: true,
      // Nessun dato su iCloud: niente capability iCloud, niente backup del DB (vedi src/db).
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [],
    },
  },
  android: {
    package: bundleId,
    adaptiveIcon: {
      backgroundColor: '#E8F1EC',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // I dati di salute non devono finire nei backup automatici di Google.
    allowBackup: false,
    predictiveBackGestureEnabled: false,
    permissions: [...HEALTH_CONNECT_READ_PERMISSIONS],
  },
  plugins: [
    'expo-router',
    ['expo-sqlite', { useSQLCipher: true, enableFTS: true }],
    [
      'expo-secure-store',
      { configureAndroidBackup: true, faceIDPermission: 'Usa Face ID per sbloccare Health Coach.' },
    ],
    ['expo-local-authentication', { faceIDPermission: 'Usa Face ID per sbloccare Health Coach.' }],
    'expo-localization',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#F6F4EF',
        dark: { image: './assets/splash-icon.png', backgroundColor: '#14171A' },
      },
    ],
    'expo-font',
    'expo-background-task',
    ['expo-notifications', { color: '#3F7D63', defaultChannel: 'coach' }],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Health Coach accede alle foto solo per importare i referti che scegli tu.',
        cameraPermission: 'Health Coach usa la fotocamera solo per fotografare i tuoi referti.',
        microphonePermission: false,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Health Coach usa la fotocamera solo per fotografare i tuoi referti.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    'expo-sharing',
    [
      'expo-speech-recognition',
      {
        microphonePermission: 'Health Coach usa il microfono solo mentre parli con il coach.',
        speechRecognitionPermission:
          'Health Coach trascrive la tua voce per parlare con il coach. Quando possibile, la trascrizione avviene sul telefono.',
      },
    ],
    [
      // "Condividi → Health Coach" da altre app: referti PDF e immagini finiscono nella Cartella salute.
      'expo-share-intent',
      {
        iosShareExtensionName: 'Health Coach',
        iosActivationRules: {
          NSExtensionActivationSupportsImageWithMaxCount: 10,
          NSExtensionActivationSupportsFileWithMaxCount: 10,
        },
        androidIntentFilters: ['image/*', 'application/pdf'],
        androidMultiIntentFilters: ['image/*', 'application/pdf'],
      },
    ],
    'expo-web-browser',
    [
      'expo-build-properties',
      {
        android: { minSdkVersion: 26 },
      },
    ],
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription:
          'Health Coach legge i tuoi dati di salute (attività, sonno, parametri vitali, nutrizione) per mostrarti trend e darti consigli personalizzati. I dati restano sul tuo iPhone.',
        // v1.0 legge soltanto: nessuna richiesta di scrittura.
        NSHealthUpdateUsageDescription: false,
        background: true,
      },
    ],
    'react-native-health-connect',
    // Ciclo di vita UIScene richiesto dall'SDK iOS 27 (rimuovere con SDK 58).
    './plugins/withIosSceneLifecycle',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    variant,
    backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL ?? '',
    eas: { projectId: EAS_PROJECT_ID },
  },
});
