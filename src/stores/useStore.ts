import { create } from 'zustand';
import { DiscoveredDevice } from '../services/bluetooth/types/ble.types';
import { weightLoggerService } from '../services/WeightLoggerService';
import { settingsRepository } from '../repositories/SettingsRepository';
import { sessionRepository } from '../repositories/SessionRepository';
import { BrewingPhase } from '../services/interfaces/brewing.types';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Infusion } from '../entities/Infusion.entity';

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
}

interface HistoryState {
  sessionList: BrewingSession[];
  selectedSession: BrewingSession | null;
  loadHistory: () => Promise<void>;
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

type StoreState = BluetoothState & BrewingState & HistoryState & SettingsState & WeightLoggerState;

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

  // HistoryState
  sessionList: [],
  selectedSession: null,
  loadHistory: async () => {
    const sessions = await sessionRepository.getAllSessions();
    set({ sessionList: sessions });
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