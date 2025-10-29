import '@testing-library/jest-dom';

// Mock Capacitor plugins
jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: jest.fn(() => false),
    getPlatform: jest.fn(() => 'web'),
    Plugins: {},
  },
}));

jest.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: {},
  SQLiteConnection: jest.fn(() => ({
    initWebStore: jest.fn(),
    createConnection: jest.fn(() => Promise.resolve({
      open: jest.fn(),
    })),
  })),
}));