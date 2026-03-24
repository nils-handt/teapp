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
  hasSeenTutorial: boolean;
  settingsLoaded: boolean;
  isTutorialOpen: boolean;
}

export interface SettingsStoreActions {
  updateSettings: (settings: Partial<PersistedSettingsStoreValues>) => void;
  loadSettings: () => Promise<void>;
  finishSettingsLoad: () => void;
  openTutorial: () => void;
  closeTutorial: () => void;
  markTutorialSeen: () => void;
}

export type SettingsStore = SettingsStoreValues & SettingsStoreActions;

export type PersistedSettingsStoreValues = Pick<
  SettingsStoreValues,
  | 'scaleConfig'
  | 'devMode'
  | 'logLevel'
  | 'logToFileEnabled'
  | 'weightLoggerEnabled'
  | 'playbackSpeed'
  | 'lastUsedBrewingScreen'
  | 'hasSeenTutorial'
>;

export const initialSettingsStoreValues: SettingsStoreValues = {
  scaleConfig: {},
  devMode: false,
  logLevel: DEFAULT_LOGGER_CONFIG.minLevel,
  logToFileEnabled: DEFAULT_LOGGER_CONFIG.enableFileLogging,
  weightLoggerEnabled: false,
  playbackSpeed: 1,
  lastUsedBrewingScreen: DEFAULT_BREWING_SCREEN_ID,
  hasSeenTutorial: false,
  settingsLoaded: false,
  isTutorialOpen: false,
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
    const loadedSettings: Partial<PersistedSettingsStoreValues> = {};

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
    if (allSettings['hasSeenTutorial']) {
      loadedSettings.hasSeenTutorial = allSettings['hasSeenTutorial'] === 'true';
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
    set({ settingsLoaded: true });
    logger.info('Persisted settings loaded', { keys: Object.keys(loadedSettings) });
  },
  finishSettingsLoad: () => set({ settingsLoaded: true }),
  openTutorial: () => set({ isTutorialOpen: true }),
  closeTutorial: () => set({ isTutorialOpen: false }),
  markTutorialSeen: () => {
    set({ hasSeenTutorial: true, isTutorialOpen: false });
    void settingsRepository.saveSettingsState({ hasSeenTutorial: true });
    logger.info('Marked tutorial as seen');
  },
}));

export const useSettingsStore = <T>(selector: (state: SettingsStore) => T): T =>
  useZustandStore(settingsStore, selector);
