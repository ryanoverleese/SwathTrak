import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.spraymarker.app',
  appName: 'SprayMarker',
  webDir: 'dist',
  plugins: {
    Geolocation: {
      // Request precise location on iOS
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
    },
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    backgroundColor: '#000000',
  },
};

export default config;
