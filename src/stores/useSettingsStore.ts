import { useStore as useZustandStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { settingsRepository } from '../repositories/SettingsRepository';
import {
  DEFAULT_BREWING_SCREEN_ID,
  isBrewingScreenId,
  type BrewingScreenId,
} from '../constants/brewingScreens';
import {
  configureLogger,
  createLogger,
  DEFAULT_LOGGER_CONFIG,
  isLogLevel,
  type LogLevel,
} from '../services/logging';

const logger = createLogger('SettingsStore');

configureLogger(DEFAULT_LOGGER_CONFIG);

export interface SettingsStoreValues {
  scaleConfig: Record<string, unknown>;
  devMode: boolean;
  logLevel: LogLevel;
  logToFileEnabled: boolean;
  weightLoggerEnabled: boolean;
  playbackSpeed: number;
  lastUsedBrewingScreen: BrewingScreenId;
}

export interface SettingsStoreActions {
  updateSettings: (settings: Partial<SettingsStoreValues>) => void;
  loadSettings: () => Promise<void>;
}

export type SettingsStore = SettingsStoreValues & SettingsStoreActions;

export const initialSettingsStoreValues: SettingsStoreValues = {
  scaleConfig: {},
  devMode: false,
  logLevel: DEFAULT_LOGGER_CONFIG.minLevel,
  logToFileEnabled: DEFAULT_LOGGER_CONFIG.enableFileLogging,
  weightLoggerEnabled: false,
  playbackSpeed: 1,
  lastUsedBrewingScreen: DEFAULT_BREWING_SCREEN_ID,
};

const applyLoggerSettings = (settings: Partial<SettingsStoreValues>): void => {
  const nextLoggerConfig: {
    minLevel?: LogLevel;
    enableFileLogging?: boolean;
  } = {};

  if (settings.logLevel && isLogLevel(settings.logLevel)) {
    nextLoggerConfig.minLevel = settings.logLevel;
  }

  if (typeof settings.logToFileEnabled === 'boolean') {
    nextLoggerConfig.enableFileLogging = settings.logToFileEnabled;
  }

  if (Object.keys(nextLoggerConfig).length > 0) {
    configureLogger(nextLoggerConfig);
  }
};

export const settingsStore = createStore<SettingsStore>()((set) => ({
  ...initialSettingsStoreValues,
  updateSettings: (settings) => {
    applyLoggerSettings(settings);
    set(settings);
    void settingsRepository.saveSettingsState(settings);
    logger.info('Updated settings', { keys: Object.keys(settings) });
  },
  loadSettings: async () => {
    logger.info('Loading persisted settings');
    const allSettings = await settingsRepository.getAllSettings();
    const loadedSettings: Partial<SettingsStoreValues> = {};

    if (allSettings['devMode']) {
      loadedSettings.devMode = allSettings['devMode'] === 'true';
    }
    if (allSettings['logLevel'] && isLogLevel(allSettings['logLevel'])) {
      loadedSettings.logLevel = allSettings['logLevel'];
    }
    if (allSettings['logToFileEnabled']) {
      loadedSettings.logToFileEnabled = allSettings['logToFileEnabled'] === 'true';
    }
    if (allSettings['weightLoggerEnabled']) {
      loadedSettings.weightLoggerEnabled = allSettings['weightLoggerEnabled'] === 'true';
    }
    if (allSettings['playbackSpeed']) {
      loadedSettings.playbackSpeed = Number(allSettings['playbackSpeed']);
    }
    if (allSettings['lastUsedBrewingScreen']) {
      const screenId = Number(allSettings['lastUsedBrewingScreen']);
      if (isBrewingScreenId(screenId)) {
        loadedSettings.lastUsedBrewingScreen = screenId;
      }
    }
    if (allSettings['scaleConfig']) {
      try {
        loadedSettings.scaleConfig = JSON.parse(allSettings['scaleConfig']);
      } catch (error) {
        logger.error('Failed to parse scaleConfig', error);
      }
    }

    applyLoggerSettings(loadedSettings);
    set(loadedSettings);
    logger.info('Persisted settings loaded', { keys: Object.keys(loadedSettings) });
  },
}));

export const useSettingsStore = <T>(selector: (state: SettingsStore) => T): T =>
  useZustandStore(settingsStore, selector);
