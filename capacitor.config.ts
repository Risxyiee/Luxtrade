import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'web.id.luxtradee',
  appName: 'LuxTradee',
  webDir: 'out',
  server: {
    // In production, the app loads from the bundled static files.
    // For development, uncomment the line below to live-reload from Next.js dev server:
    // url: 'http://localhost:3000',
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: [
      'luxtradee.web.id',
      '*.luxtradee.web.id',
      'klxkdrfsfcoankbaoejn.supabase.co',
      '*.supabase.co',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#050507',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      iosSplashResourceName: 'Splash',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#050507',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#4FC3F7',
      sound: 'default',
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: false,
    backgroundColor: '#050507',
  },
};

export default config;
