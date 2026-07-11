import { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.teapp.app',
  appName: 'Teapp',
  webDir: 'dist',
  server: {
    // url: 'http://192.168.1.100:5173', // could enable live reload for android
    cleartext: true,
    androidScheme: 'https'
  },
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'default',
      androidIsEncryption: false,
    },
    Keyboard: {
      resize: KeyboardResize.Ionic,
      resizeOnFullScreen: true,
    },
  }
};

export default config;
