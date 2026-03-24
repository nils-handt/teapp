interface BluetoothRemoteGATTServer {
  connected?: boolean;
  connect?: () => Promise<BluetoothRemoteGATTServer>;
  disconnect?: () => void;
}

interface BluetoothRemoteGATTCharacteristic {
  startNotifications?: () => Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer | null;
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
  BluetoothRemoteGATTServer?: {
    prototype?: {
      connect?: unknown;
      disconnect?: unknown;
    };
  };
  BluetoothRemoteGATTCharacteristic?: {
    prototype?: {
      startNotifications?: unknown;
    };
  };
}
