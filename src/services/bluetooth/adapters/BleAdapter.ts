import { BleClient, BleDevice, RequestBleDeviceOptions, ScanResult } from '@capacitor-community/bluetooth-le';
import { UUID } from '../types/ble.types';
import { Logger } from '../utils/Logger';

const logger = new Logger('BleAdapter');

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

  async getDevices(): Promise<BleDevice[]> {
    await this.ensureInitialized();
    try {
      return await BleClient.getDevices([]);
    } catch (error) {
      logger.error('Error getting devices:', error);
      return [];
    }
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
      logger.error(`Error stopping notifications for characteristic ${characteristic}:`, error);
    }
  }

  // Helper to convert number array to ArrayBuffer for writing
  numbersToData(numbers: number[]): ArrayBufferLike {
    return new Uint8Array(numbers).buffer;
  }
}

export const bleAdapter = BleAdapter.getInstance();
