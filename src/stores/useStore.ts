import { create } from 'zustand';
import { DiscoveredDevice } from '../services/bluetooth/types/ble.types';
import { weightLoggerService } from '../services/WeightLoggerService';

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
  activeSession: any | null;
  currentInfusion: any | null;
  timerStatus: 'stopped' | 'running' | 'paused';
  brewingPhase: 'setup' | 'infusion' | 'rest' | 'ended';
  startSession: () => void;
}

interface HistoryState {
  sessionList: any[];
  selectedSession: any | null;
  loadHistory: () => void;
}

interface SettingsState {
  scaleConfig: any;
  timerPreferences: any;
  devMode: boolean;
  weightLoggerEnabled: boolean;
  playbackSpeed: number;
  updateSettings: (settings: Partial<SettingsState>) => void;
}

interface WeightLoggerState {
  isRecording: boolean;
  recordingStartTime: number | null;
  savedRecordings: string[];
  startRecording: () => void;
  stopRecording: (sessionName: string, notes?: string) => Promise<void>;
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
  brewingPhase: 'ended',
  startSession: () => set({ brewingPhase: 'setup' }),

  // HistoryState
  sessionList: [],
  selectedSession: null,
  loadHistory: () => set({ sessionList: [] }),

  // SettingsState
  scaleConfig: {},
  timerPreferences: {},
  devMode: false,
  weightLoggerEnabled: false,
  playbackSpeed: 1,
  updateSettings: (settings) => set((state) => ({ ...state, ...settings })),

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
  refreshRecordings: async () => {
    const recordings = await weightLoggerService.getRecordings();
    set({ savedRecordings: recordings });
  },
}));