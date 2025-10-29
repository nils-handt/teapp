import { create } from 'zustand';

// As per ARCHITECTURE.md
interface BluetoothState {
  connectedDevice: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  currentWeight: number;
  availableDevices: any[];
  setConnectionStatus: (status: BluetoothState['connectionStatus']) => void;
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
  updateSettings: (settings: Partial<SettingsState>) => void;
}

type StoreState = BluetoothState & BrewingState & HistoryState & SettingsState;

export const useStore = create<StoreState>((set) => ({
  // BluetoothState
  connectedDevice: null,
  connectionStatus: 'disconnected',
  currentWeight: 0,
  availableDevices: [],
  setConnectionStatus: (status) => set({ connectionStatus: status }),

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
  updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
}));