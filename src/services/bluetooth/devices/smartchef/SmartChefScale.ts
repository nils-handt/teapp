import { PeripheralData } from '../../types/ble.types';
import { BluetoothScale } from '../../base/BluetoothScale';
import { ScaleType, SCALE_TIMER_COMMAND } from '../../types/scale.types';
import { bleAdapter } from '../../adapters/BleAdapter';

export class SmartChefScale extends BluetoothScale {
  public static DEVICE_NAME = 'smartchef';
  public static DATA_SERVICE = 'FFF0';
  public static DATA_CHARACTERISTIC = 'FFF1';

  constructor(peripheral: PeripheralData) {
    super(peripheral, ScaleType.SMARTCHEF);
    this.supportsTaring = false;
    this.supportsTimer = false;
  }

  public static test(peripheral: PeripheralData): boolean {
    return peripheral.name.toLowerCase().includes(this.DEVICE_NAME);
  }

  async connect(): Promise<void> {
    await bleAdapter.connect(this.device_id, this.handleDeviceDisconnect.bind(this));
    await bleAdapter.startNotifications(
      this.device_id,
      SmartChefScale.DATA_SERVICE,
      SmartChefScale.DATA_CHARACTERISTIC,
      this.handleNotifications.bind(this)
    );
  }

  async tare(): Promise<void> {
    this.logger.warn('Tare is not supported on SmartChef scale');
  }

  async setLed(_on: boolean): Promise<void> {
    // Not supported
  }

  async setTimer(_command: SCALE_TIMER_COMMAND): Promise<void> {
    this.logger.warn('Timer is not supported on SmartChef scale');
  }

  async getWeight(): Promise<void> {
    // Weight is pushed via notifications
  }

  disconnectTriggered(): void {
    bleAdapter.stopNotifications(
      this.device_id,
      SmartChefScale.DATA_SERVICE,
      SmartChefScale.DATA_CHARACTERISTIC
    ).catch(err => this.logger.error('Error stopping notifications', err));
  }

  private handleNotifications(data: ArrayBufferLike): void {
    const view = new Uint8Array(data);
    if (view.length > 8) {
      let weight = ((view[5] << 8) + view[6]) / 10;
      if (view[3] > 10) {
        weight = weight * -1;
      }
      this.setWeight(weight, true); // Stability not indicated
    } else {
      this.logger.warn('Malformed status update received');
    }
  }
}
