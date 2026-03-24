import { BleClient, BleDevice, RequestBleDeviceOptions, ScanResult } from '@capacitor-community/bluetooth-le';
import { UUID } from '../types/ble.types';
import { createLogger } from '../../logging';

const logger = createLogger('BleAdapter');

type WebBluetoothDeviceLike = BluetoothDevice & {
  watchAdvertisements?: (options?: { signal?: AbortSignal }) => Promise<void>;
};

type WebBluetoothLike = Bluetooth & {
  getDevices?: () => Promise<BluetoothDevice[]>;
};

export interface RememberedDeviceSupport {
  canRestoreDevices: boolean;
  canWatchAdvertisements: boolean;
}

export interface AdvertisementWatchResult {
  status: 'advertisement-received' | 'device-not-restored' | 'unsupported' | 'timeout' | 'error';
  error?: string;
  observedAt?: string;
}

interface RequestLEScanParams {
  callback: (result: ScanResult) => void;
  options?: RequestBleDeviceOptions;
}

class BleAdapter {
  private static instance: BleAdapter;
  private initialized = false;

  private constructor() {
    // Constructor is now empty, initialization is done explicitly.
  }

  public static getInstance(): BleAdapter {
    if (!BleAdapter.instance) {
      BleAdapter.instance = new BleAdapter();
    }
    return BleAdapter.instance;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    try {
      await BleClient.initialize();
      this.initialized = true;
    } catch (error) {
      logger.error('Error initializing BleClient:', error);
      throw new Error('BLE initialization failed. Make sure Bluetooth is enabled.');
    }
  }

  async requestLEScan({ callback, options = { allowDuplicates: false } }: RequestLEScanParams): Promise<void> {
    await this.ensureInitialized();
    try {
      await BleClient.requestLEScan(options, callback);
    } catch (error) {
      logger.error('Error starting BLE scan:', error);
      throw new Error('Failed to start BLE scan. Please grant permissions and ensure Bluetooth is on.');
    }
  }

  async requestDevice(options?: RequestBleDeviceOptions): Promise<BleDevice> {
    await this.ensureInitialized();
    try {
      return await BleClient.requestDevice(options);
    } catch (error) {
      logger.error('Error requesting BLE device:', error);
      throw error;
    }
  }

  async getDevices(deviceIds: string[] = []): Promise<BleDevice[]> {
    await this.ensureInitialized();
    try {
      return await BleClient.getDevices(deviceIds);
    } catch (error) {
      logger.error('Error getting devices:', error);
      return [];
    }
  }

  getRememberedDeviceSupport(): RememberedDeviceSupport {
    const bluetooth = this.getNavigatorBluetooth();
    const canRestoreDevices = Boolean(bluetooth && typeof bluetooth.getDevices === 'function');
    const bluetoothDeviceCtor = (globalThis as Record<string, unknown>).BluetoothDevice as
      | { prototype?: { watchAdvertisements?: unknown } }
      | undefined;
    const canWatchAdvertisements = Boolean(
      bluetoothDeviceCtor?.prototype && typeof bluetoothDeviceCtor.prototype.watchAdvertisements === 'function'
    );

    return {
      canRestoreDevices,
      canWatchAdvertisements,
    };
  }

  async waitForDeviceAdvertisement(deviceId: string, timeoutMs: number): Promise<AdvertisementWatchResult> {
    await this.ensureInitialized();

    const support = this.getRememberedDeviceSupport();
    if (!support.canRestoreDevices || !support.canWatchAdvertisements) {
      logger.warn('Web Bluetooth advertisement watching is unavailable for remembered reconnect', {
        deviceId,
        support,
      });
      return { status: 'unsupported' };
    }

    const device = await this.findWebBluetoothDevice(deviceId);
    if (!device) {
      logger.warn('Could not restore web Bluetooth device before advertisement watch', { deviceId });
      return { status: 'device-not-restored' };
    }

    if (device.gatt?.connected) {
      return {
        status: 'advertisement-received',
        observedAt: new Date().toISOString(),
      };
    }

    return new Promise<AdvertisementWatchResult>((resolve) => {
      const abortController = new AbortController();
      let settled = false;

      const finish = (result: AdvertisementWatchResult) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutHandle);
        device.removeEventListener('advertisementreceived', handleAdvertisement);
        try {
          abortController.abort();
        } catch {
          // Ignore abort failures during cleanup.
        }
        resolve(result);
      };

      const handleAdvertisement = () => {
        finish({
          status: 'advertisement-received',
          observedAt: new Date().toISOString(),
        });
      };

      const timeoutHandle = setTimeout(() => {
        logger.warn('Timed out waiting for Bluetooth advertisement from remembered device', { deviceId, timeoutMs });
        finish({ status: 'timeout' });
      }, timeoutMs);

      device.addEventListener('advertisementreceived', handleAdvertisement, { once: true });
      device.watchAdvertisements?.({ signal: abortController.signal }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes('abort')) {
          return;
        }

        logger.error(`Error watching advertisements for device ${deviceId}:`, error);
        finish({
          status: 'error',
          error: message,
        });
      });
    });
  }

  async stopLEScan(): Promise<void> {
    await this.ensureInitialized();
    try {
      await BleClient.stopLEScan();
    } catch (error) {
      logger.error('Error stopping BLE scan:', error);
    }
  }

  async connect(deviceId: string, onDisconnect?: () => void): Promise<void> {
    await this.ensureInitialized();
    try {
      await BleClient.connect(deviceId, onDisconnect);
    } catch (error) {
      logger.error(`Error connecting to device ${deviceId}:`, error);
      throw new Error(`Connection to device ${deviceId} failed.`);
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    await this.ensureInitialized();
    try {
      await BleClient.disconnect(deviceId);
    } catch (error) {
      logger.error(`Error disconnecting from device ${deviceId}:`, error);
    }
  }

  async write(
    deviceId: string,
    service: UUID,
    characteristic: UUID,
    data: ArrayBufferLike
  ): Promise<void> {
    await this.ensureInitialized();
    try {
      const dataView = new DataView(data);
      await BleClient.write(deviceId, service, characteristic, dataView);
    } catch (error) {
      logger.error(`Error writing to characteristic ${characteristic}:`, error);
    }
  }

  async startNotifications(
    deviceId: string,
    service: UUID,
    characteristic: UUID,
    callback: (data: ArrayBufferLike) => void
  ): Promise<void> {
    await this.ensureInitialized();
    try {
      await BleClient.startNotifications(deviceId, service, characteristic, (dataView) => {
        callback(dataView.buffer);
      });
    } catch (error) {
      logger.error(`Error starting notifications for characteristic ${characteristic}:`, error);
    }
  }

  async stopNotifications(
    deviceId: string,
    service: UUID,
    characteristic: UUID
  ): Promise<void> {
    await this.ensureInitialized();
    try {
      await BleClient.stopNotifications(deviceId, service, characteristic);
    } catch (error) {
      if (this.isExpectedDisconnectedError(error)) {
        logger.debug(`Notifications already stopped for characteristic ${characteristic}.`, error);
        return;
      }
      logger.error(`Error stopping notifications for characteristic ${characteristic}:`, error);
    }
  }

  // Helper to convert number array to ArrayBuffer for writing
  numbersToData(numbers: number[]): ArrayBufferLike {
    return new Uint8Array(numbers).buffer;
  }

  private getNavigatorBluetooth(): WebBluetoothLike | null {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      return null;
    }

    return navigator.bluetooth as WebBluetoothLike;
  }

  private async findWebBluetoothDevice(deviceId: string): Promise<WebBluetoothDeviceLike | null> {
    const bluetooth = this.getNavigatorBluetooth();
    if (!bluetooth || typeof bluetooth.getDevices !== 'function') {
      return null;
    }

    try {
      const devices = await bluetooth.getDevices();
      return (devices.find((device) => device.id === deviceId) as WebBluetoothDeviceLike | undefined) ?? null;
    } catch (error) {
      logger.error(`Error restoring web Bluetooth device ${deviceId} for advertisement watch:`, error);
      return null;
    }
  }

  private isExpectedDisconnectedError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();
    const mentionsDisconnect = normalized.includes('gatt server is disconnected')
      || normalized.includes('server is disconnected')
      || normalized.includes('device is disconnected')
      || normalized.includes('cannot retrieve services')
      || normalized.includes('(re)connect first');

    return mentionsDisconnect;
  }
}

export const bleAdapter = BleAdapter.getInstance();
