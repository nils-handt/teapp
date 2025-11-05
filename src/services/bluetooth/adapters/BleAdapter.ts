import { BleClient } from '@capacitor-community/bluetooth-le';
import { UUID } from '../types/ble.types';

class BleAdapter {
  private static instance: BleAdapter;

  private constructor() {
    BleClient.initialize();
  }

  public static getInstance(): BleAdapter {
    if (!BleAdapter.instance) {
      BleAdapter.instance = new BleAdapter();
    }
    return BleAdapter.instance;
  }

  async connect(deviceId: string, onDisconnect?: () => void): Promise<void> {
    await BleClient.connect(deviceId, onDisconnect);
  }

  async disconnect(deviceId: string): Promise<void> {
    await BleClient.disconnect(deviceId);
  }

  async write(
    deviceId: string,
    service: UUID,
    characteristic: UUID,
    data: ArrayBufferLike
  ): Promise<void> {
    const dataView = new DataView(data);
    await BleClient.write(deviceId, service, characteristic, dataView);
  }

  async startNotifications(
    deviceId: string,
    service: UUID,
    characteristic: UUID,
    callback: (data: ArrayBufferLike) => void
  ): Promise<void> {
    await BleClient.startNotifications(deviceId, service, characteristic, (dataView) => {
      callback(dataView.buffer);
    });
  }

  async stopNotifications(
    deviceId: string,
    service: UUID,
    characteristic: UUID
  ): Promise<void> {
    await BleClient.stopNotifications(deviceId, service, characteristic);
  }

  // Helper to convert number array to ArrayBuffer for writing
  numbersToData(numbers: number[]): ArrayBufferLike {
    return new Uint8Array(numbers).buffer
  }
}

export const bleAdapter = BleAdapter.getInstance();
