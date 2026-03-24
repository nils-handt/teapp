interface BluetoothRemoteGATTServerLike {
  connected?: boolean;
}

interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServerLike | null;
  watchAdvertisements?: (options?: { signal?: AbortSignal }) => Promise<void>;
}

interface Bluetooth {
  getDevices?: () => Promise<BluetoothDevice[]>;
  requestDevice?: (...args: unknown[]) => Promise<BluetoothDevice>;
}

interface Navigator {
  bluetooth?: Bluetooth;
}

interface Window {
  BluetoothDevice?: {
    prototype?: {
      watchAdvertisements?: unknown;
    };
  };
}
