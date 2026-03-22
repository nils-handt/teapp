import { create } from 'zustand';
import { DiscoveredDevice } from '../services/bluetooth/types/ble.types';
import { weightLoggerService } from '../services/WeightLoggerService';
import { settingsRepository } from '../repositories/SettingsRepository';
import { sessionRepository } from '../repositories/SessionRepository';
import {
  BrewingPhase,
  type EditableInfusionMetadata,
  type InfusionMetadataDraft,
} from '../services/interfaces/brewing.types';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Infusion } from '../entities/Infusion.entity';
import { brewingSessionService } from '../services/brewing/BrewingSessionService';
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

const logger = createLogger('Store');

configureLogger(DEFAULT_LOGGER_CONFIG);

// As per ARCHITECTURE.md
interface BluetoothState {
  connectedDevice: DiscoveredDevice | null;
  connectionStatus: 'disconnected' | 'scanning' | 'connecting' | 'connected';
  currentWeight: number;
  availableDevices: DiscoveredDevice[];
  isScanning: boolean;
  setConnectionStatus: (status: BluetoothState['connectionStatus']) => void;
  setAvailableDevices: (devices: DiscoveredDevice[]) => void;
  addDiscoveredDevice: (device: DiscoveredDevice) => void;
  clearAvailableDevices: () => void;
  setConnectedDevice: (device: DiscoveredDevice | null) => void;
  setCurrentWeight: (weight: number) => void;
  setIsScanning: (scanning: boolean) => void;
}

interface BrewingState {
  activeSession: BrewingSession | null;
  currentInfusion: Infusion | null;
  editableInfusionMetadata: EditableInfusionMetadata;
  firstInfusionDraft: InfusionMetadataDraft;
  timerStatus: 'stopped' | 'running' | 'paused';
  brewingPhase: BrewingPhase;
  timerValue: number;
  setBrewingState: (state: Partial<BrewingState>) => void;
  restoreActiveSession: () => Promise<void>;
}

interface HistoryState {
  sessionList: BrewingSession[];
  selectedSession: BrewingSession | null;
  knownTeaNames: string[];
  loadHistory: () => Promise<void>;
  loadKnownTeaNames: (force?: boolean) => Promise<void>;
  upsertKnownTeaName: (teaName: string) => void;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  filterHistoryByTea: (teaName: string) => Promise<void>;
  updateSession: (session: BrewingSession) => Promise<void>;
}

interface SettingsState {
  scaleConfig: Record<string, unknown>;
  devMode: boolean;
  logLevel: LogLevel;
  logToFileEnabled: boolean;
  weightLoggerEnabled: boolean;
  playbackSpeed: number;
  lastUsedBrewingScreen: BrewingScreenId;
  updateSettings: (settings: Partial<SettingsState>) => void;
  loadSettings: () => Promise<void>;
}

interface WeightLoggerState {
  isRecording: boolean;
  recordingStartTime: number | null;
  savedRecordings: string[];
  startRecording: () => void;
  stopRecording: (sessionName: string, notes?: string) => Promise<void>;
  discardRecording: () => void;
  refreshRecordings: () => Promise<void>;
}

export type StoreState = BluetoothState & BrewingState & HistoryState & SettingsState & WeightLoggerState;

const applyLoggerSettings = (settings: Partial<SettingsState>): void => {
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

export const useStore = create<StoreState>((set, get) => ({
  // BluetoothState
  connectedDevice: null,
  connectionStatus: 'disconnected',
  currentWeight: 0,
  availableDevices: [],
  isScanning: false,
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setAvailableDevices: (devices) => set({ availableDevices: devices }),
  addDiscoveredDevice: (device) => {
    const existing = get().availableDevices.find((d) => d.id === device.id);
    if (existing) {
      // Update existing device entry
      set((state) => ({
        availableDevices: state.availableDevices.map((d) =>
          d.id === device.id ? { ...d, ...device } : d
        ),
      }));
    } else {
      // Add new device
      set((state) => ({ availableDevices: [...state.availableDevices, device] }));
    }
  },
  clearAvailableDevices: () => set({ availableDevices: [] }),
  setConnectedDevice: (device) => set({ connectedDevice: device }),
  setCurrentWeight: (weight) => set({ currentWeight: weight }),
  setIsScanning: (scanning) => set({ isScanning: scanning }),

  // BrewingState
  activeSession: null,
  currentInfusion: null,
  editableInfusionMetadata: {
    infusionId: null,
    note: '',
    temperature: null,
    source: 'none',
  },
  firstInfusionDraft: {
    note: '',
    temperature: null,
  },
  timerStatus: 'stopped',
  brewingPhase: BrewingPhase.IDLE,
  timerValue: 0,

  setBrewingState: (newState) => set((state) => ({ ...state, ...newState })),
  restoreActiveSession: async () => {
    logger.info('Restoring active brewing session from persistence');
    const activeSession = await sessionRepository.getActiveSession();

    if (activeSession) {
      logger.info('Found active brewing session', { sessionId: activeSession.sessionId });
      brewingSessionService.restoreSession(activeSession);
      set({
        activeSession: brewingSessionService.session$.value,
        currentInfusion: brewingSessionService.currentInfusion$.value,
        editableInfusionMetadata: brewingSessionService.editableInfusionMetadata$.value,
        firstInfusionDraft: brewingSessionService.firstInfusionDraft$.value,
        brewingPhase: brewingSessionService.state$.value,
        timerValue: brewingSessionService.timer$.value,
        timerStatus: 'stopped',
      });
      return;
    }

    logger.info('No active brewing session found. Clearing in-memory session state');
    brewingSessionService.clearSession();
    set({
      activeSession: null,
      currentInfusion: null,
      editableInfusionMetadata: brewingSessionService.editableInfusionMetadata$.value,
      firstInfusionDraft: brewingSessionService.firstInfusionDraft$.value,
      brewingPhase: BrewingPhase.IDLE,
      timerValue: 0,
      timerStatus: 'stopped',
    });
  },

  // HistoryState
  sessionList: [],
  selectedSession: null,
  knownTeaNames: [],
  loadHistory: async () => {
    const sessions = await sessionRepository.getAllSessions();
    set({ sessionList: sessions });
  },
  loadKnownTeaNames: async (force = false) => {
    if (!force && get().knownTeaNames.length > 0) {
      return;
    }

    const knownTeaNames = await sessionRepository.getKnownTeaNames();
    set({ knownTeaNames });
  },
  upsertKnownTeaName: (teaName) => {
    const trimmedTeaName = teaName.trim();
    if (!trimmedTeaName) {
      return;
    }

    set((state) => {
      const remainingTeaNames = state.knownTeaNames.filter((knownTeaName) => knownTeaName.toLowerCase() !== trimmedTeaName.toLowerCase());
      return {
        knownTeaNames: [trimmedTeaName, ...remainingTeaNames],
      };
    });
  },
  selectSession: async (sessionId) => {
    const session = await sessionRepository.getSessionById(sessionId);
    set({ selectedSession: session });
  },
  deleteSession: async (sessionId) => {
    await sessionRepository.deleteSession(sessionId);
    const sessions = await sessionRepository.getAllSessions();
    set({ sessionList: sessions, selectedSession: null });
  },
  filterHistoryByTea: async (teaName) => {
    const sessions = await sessionRepository.getSessionsByTeaName(teaName);
    set({ sessionList: sessions });
  },
  updateSession: async (session) => {
    await sessionRepository.saveSession(session);
    // Refresh list and selected session
    const sessions = await sessionRepository.getAllSessions();
    set({ sessionList: sessions, selectedSession: session });
  },

  // SettingsState
  scaleConfig: {},
  devMode: false,
  logLevel: DEFAULT_LOGGER_CONFIG.minLevel,
  logToFileEnabled: DEFAULT_LOGGER_CONFIG.enableFileLogging,
  weightLoggerEnabled: false,
  playbackSpeed: 1,
  lastUsedBrewingScreen: DEFAULT_BREWING_SCREEN_ID,
  updateSettings: (settings) => {
    applyLoggerSettings(settings);
    set((state) => ({ ...state, ...settings }));
    settingsRepository.saveSettingsState(settings);
    logger.info('Updated settings', { keys: Object.keys(settings) });
  },
  loadSettings: async () => {
    logger.info('Loading persisted settings');
    const allSettings = await settingsRepository.getAllSettings();
    const loadedSettings: Partial<SettingsState> = {};

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
      } catch (e) {
        logger.error('Failed to parse scaleConfig', e);
      }
    }

    applyLoggerSettings(loadedSettings);
    set((state) => ({ ...state, ...loadedSettings }));
    logger.info('Persisted settings loaded', { keys: Object.keys(loadedSettings) });
  },

  // WeightLoggerState
  isRecording: false,
  recordingStartTime: null,
  savedRecordings: [],
  startRecording: () => {
    logger.info('Starting weight recording');
    weightLoggerService.startRecording();
    set({ isRecording: true, recordingStartTime: Date.now() });
  },
  stopRecording: async (sessionName, notes) => {
    logger.info('Stopping weight recording', { sessionName, hasNotes: Boolean(notes) });
    weightLoggerService.stopRecording();
    await weightLoggerService.saveRecording(sessionName, notes);
    const recordings = await weightLoggerService.getRecordings();
    set({ isRecording: false, recordingStartTime: null, savedRecordings: recordings });
  },
  discardRecording: () => {
    logger.info('Discarding active weight recording');
    weightLoggerService.stopRecording();
    set({ isRecording: false, recordingStartTime: null });
  },
  refreshRecordings: async () => {
    logger.debug('Refreshing saved recordings');
    const recordings = await weightLoggerService.getRecordings();
    set({ savedRecordings: recordings });
  },
}));
