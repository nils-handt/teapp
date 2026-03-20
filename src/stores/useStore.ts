import { create } from 'zustand';
import { DiscoveredDevice } from '../services/bluetooth/types/ble.types';
import { weightLoggerService } from '../services/WeightLoggerService';
import { settingsRepository } from '../repositories/SettingsRepository';
import { sessionRepository } from '../repositories/SessionRepository';
import { BrewingPhase } from '../services/interfaces/brewing.types';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Infusion } from '../entities/Infusion.entity';
import { brewingSessionService } from '../services/brewing/BrewingSessionService';
import {
  DEFAULT_BREWING_SCREEN_ID,
  isBrewingScreenId,
  type BrewingScreenId,
} from '../constants/brewingScreens';

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
  timerStatus: 'stopped',
  brewingPhase: BrewingPhase.IDLE,
  timerValue: 0,

  setBrewingState: (newState) => set((state) => ({ ...state, ...newState })),
  restoreActiveSession: async () => {
    const activeSession = await sessionRepository.getActiveSession();

    if (activeSession) {
      brewingSessionService.restoreSession(activeSession);
      set({
        activeSession: brewingSessionService.session$.value,
        currentInfusion: brewingSessionService.currentInfusion$.value,
        brewingPhase: brewingSessionService.state$.value,
        timerValue: brewingSessionService.timer$.value,
        timerStatus: 'stopped',
      });
      return;
    }

    brewingSessionService.clearSession();
    set({
      activeSession: null,
      currentInfusion: null,
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
  weightLoggerEnabled: false,
  playbackSpeed: 1,
  lastUsedBrewingScreen: DEFAULT_BREWING_SCREEN_ID,
  updateSettings: (settings) => {
    set((state) => ({ ...state, ...settings }));
    settingsRepository.saveSettingsState(settings);
  },
  loadSettings: async () => {
    const allSettings = await settingsRepository.getAllSettings();
    const loadedSettings: Partial<SettingsState> = {};

    if (allSettings['devMode']) {
      loadedSettings.devMode = allSettings['devMode'] === 'true';
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
        console.error('Failed to parse scaleConfig', e);
      }
    }

    set((state) => ({ ...state, ...loadedSettings }));
  },

  // WeightLoggerState
  isRecording: false,
  recordingStartTime: null,
  savedRecordings: [],
  startRecording: () => {
    weightLoggerService.startRecording();
    set({ isRecording: true, recordingStartTime: Date.now() });
  },
  stopRecording: async (sessionName, notes) => {
    weightLoggerService.stopRecording();
    await weightLoggerService.saveRecording(sessionName, notes);
    const recordings = await weightLoggerService.getRecordings();
    set({ isRecording: false, recordingStartTime: null, savedRecordings: recordings });
  },
  discardRecording: () => {
    weightLoggerService.stopRecording();
    set({ isRecording: false, recordingStartTime: null });
  },
  refreshRecordings: async () => {
    const recordings = await weightLoggerService.getRecordings();
    set({ savedRecordings: recordings });
  },
}));
