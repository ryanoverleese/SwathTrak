import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.swathtrak.app',
  appName: 'SwathTrak',
  webDir: 'dist',
  plugins: {
    Geolocation: {
      // Request precise location on iOS
    },
    StatusBar: {
      style: 'LIGHT',
      overlaysWebView: true,
    },
  },
  ios: {
    contentInset: 'never',
  },
  android: {
    backgroundColor: '#000000',
  },
};

export default config;
