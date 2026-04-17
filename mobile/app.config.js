/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: 'Yamma',
  slug: 'yamma',
  version: '1.0.0',
  // Expo Go always runs the New Architecture; keep config aligned to avoid bridge mismatches.
  newArchEnabled: true,
  orientation: 'portrait',
  scheme: 'yamma',
  userInterfaceStyle: 'dark',
  icon: './assets/icon.png',
  /**
   * Splash: `splash.png` is the centered image; `backgroundColor` fills the rest.
   * Old asset was a small orange graphic — looked like an “orange square”. Replaced with a full-bleed dark image.
   * `cover` avoids letterboxing so you don’t see odd edges on notched devices.
   */
  splash: {
    image: './assets/splash.png',
    resizeMode: 'cover',
    backgroundColor: '#0f1014',
  },
  androidStatusBar: {
    barStyle: 'light-content',
    backgroundColor: '#0f1014',
  },
  androidNavigationBar: {
    backgroundColor: '#0f1014',
    barStyle: 'light-content',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.yamma.app',
  },
  android: {
    package: 'com.yamma.app',
    /** Allow http:// LAN URLs (EXPO_PUBLIC_API_URL) from the device; required for dev API on your Wi‑Fi IP. */
    usesCleartextTraffic: true,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0f1014',
    },
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0f1014',
        image: './assets/splash.png',
        resizeMode: 'cover',
      },
    ],
  ],
  extra: {},
};
