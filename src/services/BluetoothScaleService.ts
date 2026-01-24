import { ScanResult } from '@capacitor-community/bluetooth-le';
import { Subscription } from 'rxjs';
import { useStore } from '../stores/useStore';
import { bleAdapter } from './bluetooth/adapters/BleAdapter';
import { BluetoothScale } from './bluetooth/base/BluetoothScale';
import { AVAILABLE_SCALES } from './bluetooth/index';
import { DiscoveredDevice, LimitedPeripheralData, PeripheralData } from './bluetooth/types/ble.types';
import { ScaleType, WeightChangeEvent } from './bluetooth/types/scale.types';
import { Logger } from './bluetooth/utils/Logger';

const logger = new Logger('BluetoothScaleService');
const RECONNECT_DELAY_MS = [1000, 2000, 4000];
const MAX_RECONNECT_ATTEMPTS = 3;

class BluetoothScaleService {
  private static instance: BluetoothScaleService;
  private currentScale: BluetoothScale | null = null;
  private subscriptions: Subscription[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private discoveredDevices = new Map<string, DiscoveredDevice>();

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): BluetoothScaleService {
    if (!BluetoothScaleService.instance) {
      BluetoothScaleService.instance = new BluetoothScaleService();
    }
    return BluetoothScaleService.instance;
  }

  async startScan(): Promise<void> {
    if (this.getConnectionStatus() === 'connected' || useStore.getState().isScanning) {
      logger.log('Scan requested but already connected or scanning.');
      return;
    }

    logger.log('Starting BLE scan...');
    useStore.getState().setIsScanning(true);
    useStore.getState().clearAvailableDevices();
    this.discoveredDevices.clear();

    try {
      await bleAdapter.requestLEScan((result) => this.handleScanResult(result));
      if (this.getConnectionStatus() !== 'connected') {
        useStore.getState().setConnectionStatus('scanning');
      }
    } catch (error) {
      logger.error('Failed to start scan:', error);
      useStore.getState().setIsScanning(false);
      useStore.getState().setConnectionStatus('disconnected');
    }
  }

  async stopScan(): Promise<void> {
    if (!useStore.getState().isScanning) return;

    logger.log('Stopping BLE scan.');
    await bleAdapter.stopLEScan();
    useStore.getState().setIsScanning(false);
    if (this.getConnectionStatus() === 'scanning') {
      useStore.getState().setConnectionStatus('disconnected');
    }
  }

  async connect(deviceId: string): Promise<void> {
    const device = this.discoveredDevices.get(deviceId);
    if (!device || !device.scaleType) {
      throw new Error(`Device ${deviceId} not found or is not a supported scale.`);
    }

    await this.stopScan();
    useStore.getState().setConnectionStatus('connecting');

    const scaleInfo = AVAILABLE_SCALES.find((s) => s.scaleType === device.scaleType);
    if (!scaleInfo) {
      throw new Error(`Implementation for scale type ${device.scaleType} not found.`);
    }

    // The constructor expects PeripheralData, but we only have LimitedPeripheralData from scanning.
    // We cast it for now. The scale implementation should only rely on the fields available in LimitedPeripheralData for connection.
    this.currentScale = new scaleInfo.class(device.peripheral as PeripheralData);
    if (!this.currentScale) {
      throw new Error('Failed to instantiate scale class.');
    }
    logger.log(`Connecting to ${this.currentScale.device_name}...`);

    try {
      await this.currentScale.connect();
      await bleAdapter.connect(deviceId, () => this.handleDisconnect(true));
      this.subscribeToScaleEvents();
      useStore.getState().setConnectionStatus('connected');
      useStore.getState().setConnectedDevice(device);
      this.reconnectAttempts = 0; // Reset on successful manual connection
      logger.log(`Successfully connected to ${this.currentScale.device_name}.`);
    } catch (error) {
      logger.error(`Connection to ${device.name} failed:`, error);
      await this.handleDisconnect(false);
      throw error; // Re-throw to allow UI to handle it
    }
  }

  async disconnect(): Promise<void> {
    if (!this.currentScale) return;
    logger.log(`Disconnecting from ${this.currentScale.device_name}...`);
    await this.currentScale.disconnectTriggered();
    await this.handleDisconnect(false);
  }

  async tare(): Promise<void> {
    if (!this.currentScale || this.getConnectionStatus() !== 'connected') {
      throw new Error('Not connected to any scale.');
    }
    await this.currentScale.tare();
  }

  getConnectionStatus() {
    return useStore.getState().connectionStatus;
  }

  getConnectedDevice() {
    return useStore.getState().connectedDevice;
  }

  private handleScanResult(scanResult: ScanResult) {
    if (!scanResult.device.name || this.discoveredDevices.has(scanResult.device.deviceId)) {
      return;
    }

    const peripheral = this.convertScanResultToPeripheral(scanResult);
    const scaleType = this.identifyScale(peripheral);

    if (scaleType) {
      const discoveredDevice: DiscoveredDevice = {
        id: scanResult.device.deviceId,
        name: scanResult.device.name,
        rssi: scanResult.rssi || 0,
        scaleType,
        peripheral,
      };
      this.discoveredDevices.set(discoveredDevice.id, discoveredDevice);
      useStore.getState().addDiscoveredDevice(discoveredDevice);
      logger.log(`Found scale: ${discoveredDevice.name} (${scaleType})`);
    }
  }

  private identifyScale(peripheral: LimitedPeripheralData): ScaleType | null {
    for (const scale of AVAILABLE_SCALES) {
      if (scale.class.test(peripheral as PeripheralData)) {
        return scale.scaleType;
      }
    }
    return null;
  }

  private convertScanResultToPeripheral(scanResult: ScanResult): LimitedPeripheralData {
    return {
      id: scanResult.device.deviceId,
      name: scanResult.device.name || 'Unknown Device',
      advertising: scanResult.rawAdvertisement as any,
      rssi: scanResult.rssi || 0,
    };
  }

  private subscribeToScaleEvents() {
    if (!this.currentScale) return;
    this.cleanup();

    this.subscriptions.push(
      this.currentScale.weightChange.subscribe((event: WeightChangeEvent) => {
        useStore.getState().setCurrentWeight(event.weight.actual);
      }),
      this.currentScale.tareEvent.subscribe(() => logger.log('Tare event received')),
      this.currentScale.timerEvent.subscribe(() => logger.log('Timer event received')),
      this.currentScale.flowChange.subscribe(() => logger.log('Flow change event received'))
    );
  }

  private async handleDisconnect(unexpected: boolean) {
    const lastConnectedDevice = this.getConnectedDevice();
    this.cleanup();

    useStore.getState().setConnectionStatus('disconnected');
    useStore.getState().setConnectedDevice(null);
    useStore.getState().setCurrentWeight(0);

    if (unexpected && lastConnectedDevice) {
      logger.log('Unexpected disconnection. Attempting to reconnect...');
      this.attemptReconnect(lastConnectedDevice.id);
    } else {
      logger.log('Scale disconnected.');
      // If it was a manual disconnect, cancel any pending reconnects
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectAttempts = 0;
    }
  }

  private attemptReconnect(deviceId: string) {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('Max reconnection attempts reached. Giving up.');
      this.reconnectAttempts = 0;
      return;
    }

    const delay = RECONNECT_DELAY_MS[this.reconnectAttempts];
    this.reconnectAttempts++;

    logger.log(`Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect(deviceId);
      } catch {
        logger.error(`Reconnect attempt ${this.reconnectAttempts} failed.`);
        // connect() calls handleDisconnect on failure, which will schedule the next attempt
      }
    }, delay);
  }

  private cleanup() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
    if (this.currentScale) {
      this.currentScale.cleanup();
      this.currentScale = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const bluetoothScaleService = BluetoothScaleService.getInstance();
