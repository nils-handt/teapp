import { Subject } from 'rxjs';
import { IScaleService } from './interfaces/IScaleService';
import { RealScaleService } from './RealScaleService';
import { MockScaleService } from './MockScaleService';
import { DiscoveredDevice } from './bluetooth/types/ble.types';
import { createLogger } from './logging';

const logger = createLogger('BluetoothScaleService');

class BluetoothScaleService implements IScaleService {
  private static instance: BluetoothScaleService;
  private realService: RealScaleService;
  private mockService: MockScaleService;
  private activeService: IScaleService;

  public weight$ = new Subject<number>();

  private constructor() {
    this.realService = new RealScaleService();
    this.mockService = new MockScaleService();
    this.activeService = this.realService;

    // Propagate weight updates from active service
    this.realService.weight$.subscribe(w => {
      if (this.activeService === this.realService) this.weight$.next(w);
    });
    this.mockService.weight$.subscribe(w => {
      if (this.activeService === this.mockService) this.weight$.next(w);
    });
  }

  public static getInstance(): BluetoothScaleService {
    if (!BluetoothScaleService.instance) {
      BluetoothScaleService.instance = new BluetoothScaleService();
    }
    return BluetoothScaleService.instance;
  }

  // Proxy methods
  async initialize(): Promise<void> {
    logger.info('Initializing active scale service', { mockMode: this.isMockMode });
    return this.activeService.initialize();
  }

  async connectNewDevice(): Promise<void> {
    logger.info('Requesting connection to a new device', { mockMode: this.isMockMode });
    return this.activeService.connectNewDevice();
  }

  async connect(device: DiscoveredDevice): Promise<void> {
    logger.info('Delegating device connection', { deviceId: device.id, deviceName: device.name, mockMode: this.isMockMode });
    return this.activeService.connect(device);
  }

  async disconnect(): Promise<void> {
    logger.info('Delegating disconnect request', { mockMode: this.isMockMode });
    return this.activeService.disconnect();
  }

  async tare(): Promise<void> {
    logger.info('Delegating tare request', { mockMode: this.isMockMode });
    return this.activeService.tare();
  }

  getConnectionStatus() {
    return this.activeService.getConnectionStatus();
  }

  getConnectedDevice() {
    return this.activeService.getConnectedDevice();
  }

  // Mode switching
  async setMockMode(enabled: boolean) {
    if (this.isMockMode === enabled) {
      logger.debug('Ignoring mock mode switch because the requested mode is already active', { enabled });
      return;
    }

    logger.info('Switching scale service mode', { enabled });

    // Disconnect current service before switching
    if (this.getConnectionStatus() === 'connected' || this.getConnectionStatus() === 'connecting') {
      await this.disconnect();
    }

    if (enabled) {
      this.activeService = this.mockService;
    } else {
      this.activeService = this.realService;
    }

    // Initialize the new service if needed
    await this.activeService.initialize();
    logger.info('Scale service mode switched', { enabled });
  }

  get isMockMode(): boolean {
    return this.activeService === this.mockService;
  }

  // Expose mock service for specific operations (loading recordings)
  get mock(): MockScaleService {
    return this.mockService;
  }
}

export const bluetoothScaleService = BluetoothScaleService.getInstance();
