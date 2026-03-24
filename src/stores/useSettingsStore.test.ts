import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  configureLogger: vi.fn(),
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../repositories/SettingsRepository', () => ({
  settingsRepository: {
    saveSettingsState: vi.fn(),
    getAllSettings: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../services/logging', async () => {
  const actual = await vi.importActual<typeof import('../services/logging')>('../services/logging');

  return {
    ...actual,
    configureLogger: mockLogger.configureLogger,
    createLogger: mockLogger.createLogger,
  };
});

import { settingsRepository } from '../repositories/SettingsRepository';
import { DEFAULT_BREWING_SCREEN_ID } from '../constants/brewingScreens';
import { DEFAULT_LOGGER_CONFIG, configureLogger } from '../services/logging';
import { initialSettingsStoreValues, settingsStore } from './useSettingsStore';

describe('useSettingsStore', () => {
  beforeEach(() => {
    settingsStore.setState(initialSettingsStoreValues);
    vi.clearAllMocks();
  });

  it('starts with default logger settings before persisted settings load', () => {
    expect(settingsStore.getState().logLevel).toBe(DEFAULT_LOGGER_CONFIG.minLevel);
    expect(settingsStore.getState().logToFileEnabled).toBe(DEFAULT_LOGGER_CONFIG.enableFileLogging);
    expect(settingsStore.getState().lastUsedBrewingScreen).toBe(DEFAULT_BREWING_SCREEN_ID);
    expect(settingsStore.getState().hasSeenTutorial).toBe(false);
    expect(settingsStore.getState().settingsLoaded).toBe(false);
    expect(settingsStore.getState().isTutorialOpen).toBe(false);
  });

  it('updates persisted settings without touching the logger when logger settings are absent', () => {
    settingsStore.getState().updateSettings({ devMode: true, playbackSpeed: 2, lastUsedBrewingScreen: 4 });

    expect(settingsStore.getState().devMode).toBe(true);
    expect(settingsStore.getState().playbackSpeed).toBe(2);
    expect(settingsStore.getState().lastUsedBrewingScreen).toBe(4);
    expect(settingsRepository.saveSettingsState).toHaveBeenCalledWith({
      devMode: true,
      playbackSpeed: 2,
      lastUsedBrewingScreen: 4,
    });
    expect(configureLogger).not.toHaveBeenCalled();
  });

  it('pushes logger settings into the runtime logger on update', () => {
    settingsStore.getState().updateSettings({ logLevel: 'warn', logToFileEnabled: true });

    expect(settingsStore.getState().logLevel).toBe('warn');
    expect(settingsStore.getState().logToFileEnabled).toBe(true);
    expect(settingsRepository.saveSettingsState).toHaveBeenCalledWith({
      logLevel: 'warn',
      logToFileEnabled: true,
    });
    expect(configureLogger).toHaveBeenCalledWith({ minLevel: 'warn', enableFileLogging: true });
  });

  it('loads persisted settings and applies logger configuration', async () => {
    vi.mocked(settingsRepository.getAllSettings).mockResolvedValue({
      lastUsedBrewingScreen: '5',
      devMode: 'true',
      hasSeenTutorial: 'true',
      logLevel: 'error',
      logToFileEnabled: 'true',
      weightLoggerEnabled: 'true',
      playbackSpeed: '3',
      scaleConfig: '{"tareOnConnect":true}',
    });

    await settingsStore.getState().loadSettings();

    expect(settingsStore.getState()).toMatchObject({
      lastUsedBrewingScreen: 5,
      devMode: true,
      hasSeenTutorial: true,
      logLevel: 'error',
      logToFileEnabled: true,
      weightLoggerEnabled: true,
      playbackSpeed: 3,
      scaleConfig: { tareOnConnect: true },
      settingsLoaded: true,
    });
    expect(configureLogger).toHaveBeenCalledWith({ minLevel: 'error', enableFileLogging: true });
  });

  it('defaults tutorial visibility to unseen when the setting is absent and still marks settings as loaded', async () => {
    vi.mocked(settingsRepository.getAllSettings).mockResolvedValue({
      devMode: 'false',
    });

    await settingsStore.getState().loadSettings();

    expect(settingsStore.getState().hasSeenTutorial).toBe(false);
    expect(settingsStore.getState().settingsLoaded).toBe(true);
    expect(settingsStore.getState().isTutorialOpen).toBe(false);
  });

  it('does not persist transient tutorial ui state', () => {
    settingsStore.getState().openTutorial();
    settingsStore.getState().closeTutorial();
    settingsStore.getState().finishSettingsLoad();

    expect(settingsRepository.saveSettingsState).not.toHaveBeenCalled();
    expect(settingsStore.getState()).toMatchObject({
      settingsLoaded: true,
      isTutorialOpen: false,
    });
  });

  it('marks the tutorial as seen and closes it', () => {
    settingsStore.setState({ isTutorialOpen: true });

    settingsStore.getState().markTutorialSeen();

    expect(settingsStore.getState().hasSeenTutorial).toBe(true);
    expect(settingsStore.getState().isTutorialOpen).toBe(false);
    expect(settingsRepository.saveSettingsState).toHaveBeenCalledWith({ hasSeenTutorial: true });
  });
});
