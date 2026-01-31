import { CapacitorConfig } from '@capacitor/cli';

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
    }
  }
};

export default config;