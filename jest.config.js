module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/*.test.ts?(x)'],
  transform: {
    "node_modules/ionic/.+\\.(j|t)sx?$": "ts-jest"
  },
  transformIgnorePatterns: ['node_modules/(?!@ionic/.*)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
