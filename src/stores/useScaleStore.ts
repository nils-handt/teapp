import { useStore as useZustandStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { DiscoveredDevice } from '../services/bluetooth/types/ble.types';

export type ConnectionStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected';

export interface ScaleStoreState {
  connectedDevice: DiscoveredDevice | null;
  connectionStatus: ConnectionStatus;
  currentWeight: number;
  availableDevices: DiscoveredDevice[];
  isScanning: boolean;
}

export interface ScaleStoreActions {
  setConnectionStatus: (status: ConnectionStatus) => void;
  setAvailableDevices: (devices: DiscoveredDevice[]) => void;
  addDiscoveredDevice: (device: DiscoveredDevice) => void;
  clearAvailableDevices: () => void;
  setConnectedDevice: (device: DiscoveredDevice | null) => void;
  setCurrentWeight: (weight: number) => void;
  setIsScanning: (scanning: boolean) => void;
}

export type ScaleStore = ScaleStoreState & ScaleStoreActions;

export const initialScaleStoreState: ScaleStoreState = {
  connectedDevice: null,
  connectionStatus: 'disconnected',
  currentWeight: 0,
  availableDevices: [],
  isScanning: false,
};

export const scaleStore = createStore<ScaleStore>()((set, get) => ({
  ...initialScaleStoreState,
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setAvailableDevices: (devices) => set({ availableDevices: devices }),
  addDiscoveredDevice: (device) => {
    const existing = get().availableDevices.find((candidate) => candidate.id === device.id);

    if (existing) {
      set((state) => ({
        availableDevices: state.availableDevices.map((candidate) =>
          candidate.id === device.id ? { ...candidate, ...device } : candidate
        ),
      }));
      return;
    }

    set((state) => ({ availableDevices: [...state.availableDevices, device] }));
  },
  clearAvailableDevices: () => set({ availableDevices: [] }),
  setConnectedDevice: (device) => set({ connectedDevice: device }),
  setCurrentWeight: (weight) => set({ currentWeight: weight }),
  setIsScanning: (scanning) => set({ isScanning: scanning }),
}));

export const useScaleStore = <T>(selector: (state: ScaleStore) => T): T =>
  useZustandStore(scaleStore, selector);
