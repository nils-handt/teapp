import { PeripheralData } from '../../types/ble.types';
import { BluetoothScale } from '../../base/BluetoothScale';
import { Logger } from '../../utils/Logger';
import { ScaleType, SCALE_TIMER_COMMAND } from '../../types/scale.types';
import { bleAdapter } from '../../adapters/BleAdapter';

export class BlackCoffeeScale extends BluetoothScale {
  public static DEVICE_NAME = 'blackcoffee';
  public static DEVICE_NAME_SECOND = 'my_scale';
  public static DATA_SERVICE = '0000ffb0-0000-1000-8000-00805f9b34fb';
  public static DATA_CHARACTERISTIC = '0000ffb2-0000-1000-8000-00805f9b34fb';

  constructor(peripheral: PeripheralData) {
    super(peripheral, ScaleType.BLACKCOFFEE);
    this.logger = new Logger('BlackCoffeeScale');
    this.supportsTaring = false;
    this.supportsTimer = false;
  }

  public static test(peripheral: PeripheralData): boolean {
    const name = peripheral.name.toLowerCase();
    return name.includes(this.DEVICE_NAME) || name.includes(this.DEVICE_NAME_SECOND);
  }

  async setTimer(_command: SCALE_TIMER_COMMAND): Promise<void> {
    this.logger.log('Timer not supported on BlackCoffee scale');
  }

  async connect(): Promise<void> {
    this.logger.log('Connecting...');
    await bleAdapter.connect(this.device_id, this.handleDeviceDisconnect.bind(this));
    await bleAdapter.startNotifications(
      this.device_id,
      BlackCoffeeScale.DATA_SERVICE,
      BlackCoffeeScale.DATA_CHARACTERISTIC,
      this.handleNotifications.bind(this)
    );
  }

  async tare(): Promise<void> {
    this.logger.log('Tare not supported on BlackCoffee scale');
  }

  async setLed(_on: boolean): Promise<void> {
    this.logger.log('SetLed not supported on BlackCoffee scale');
  }

  async getWeight(): Promise<void> {
      // Weight is pushed via notifications
  }

  disconnectTriggered(): void {
    this.logger.log('Disconnecting...');
    bleAdapter.stopNotifications(
      this.device_id,
      BlackCoffeeScale.DATA_SERVICE,
      BlackCoffeeScale.DATA_CHARACTERISTIC
    ).catch(err => this.logger.error('Error stopping notifications', err));
  }

  private handleNotifications(data: ArrayBufferLike): void {
    if (data.byteLength > 14) {
      const hex = Array.from(new Uint8Array(data))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const isNegative = hex[4] === '8' || hex[4] === 'c';
      const isStill = hex[5] === '1';
      const hexWeight = hex.slice(7, 14);
      const weight = ((isNegative ? -1 : 1) * parseInt(hexWeight, 16)) / 1000;
      this.setWeight(weight, isStill);
    } else {
      this.logger.log('Malformed status update received');
    }
  }
}
