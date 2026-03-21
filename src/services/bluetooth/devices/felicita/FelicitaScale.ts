import { PeripheralData } from '../../types/ble.types';
import { BluetoothScale } from '../../base/BluetoothScale';
import { ScaleType, SCALE_TIMER_COMMAND } from '../../types/scale.types';
import { bleAdapter } from '../../adapters/BleAdapter';
import * as Felicita from './constants';

export class FelicitaScale extends BluetoothScale {

  constructor(peripheral: PeripheralData) {
    super(peripheral, ScaleType.FELICITA);
    this.supportsTimer = true;
  }

  public static test(peripheral: PeripheralData): boolean {
    return peripheral.name.toLowerCase().includes(Felicita.DEVICE_NAME.toLowerCase());
  }

  async connect(): Promise<void> {
    await bleAdapter.connect(this.device_id, this.handleDeviceDisconnect.bind(this));
    await bleAdapter.startNotifications(this.device_id, Felicita.DATA_SERVICE, Felicita.DATA_CHARACTERISTIC, this.handleNotifications.bind(this));
    this.logger.info('Felicita scale connected');
  }

  async tare(): Promise<void> {
    this.logger.info('Taring');
    await this.write([Felicita.CMD_TARE]);
  }

  async setLed(_on: boolean): Promise<void> {
    // Not supported
  }

  async setTimer(command: SCALE_TIMER_COMMAND): Promise<void> {
    this.logger.info(`Setting timer command ${command}`);
    if (command === SCALE_TIMER_COMMAND.START) {
      await this.write([Felicita.CMD_START_TIMER]);
    } else if (command === SCALE_TIMER_COMMAND.STOP) {
      await this.write([Felicita.CMD_STOP_TIMER]);
    } else {
      await this.write([Felicita.CMD_RESET_TIMER]);
    }
  }

  async getWeight(): Promise<void> {
    // Weight is pushed via notifications
  }

  disconnectTriggered(): void {
    this.logger.info('Disconnecting');
    bleAdapter.stopNotifications(this.device_id, Felicita.DATA_SERVICE, Felicita.DATA_CHARACTERISTIC)
      .catch(err => this.logger.error('Error stopping notifications', err));
  }

  private async write(bytes: number[]): Promise<void> {
    const buffer = bleAdapter.numbersToData(bytes);
    await bleAdapter.write(this.device_id, Felicita.DATA_SERVICE, Felicita.DATA_CHARACTERISTIC, buffer);
  }

  private handleNotifications(data: ArrayBufferLike): void {
    const view = new Uint8Array(data);
    if (view.length < 18) {
      this.logger.warn('Malformed status update received');
      return;
    }

    const weightStr = this.getWeightFromFelicitaRawStatus(view);
    const weight = parseFloat(weightStr) / 100;
    this.setWeight(weight, true); // Stability not indicated

    this.batteryLevel = this.getBatteryPercentageFromFelicitaRawStatus(view);
  }

  private getBatteryPercentageFromFelicitaRawStatus(view: Uint8Array): number {
    const batteryLevel = Math.round(
      ((view[15] - Felicita.MIN_BATTERY_LEVEL) / (Felicita.MAX_BATTERY_LEVEL - Felicita.MIN_BATTERY_LEVEL)) * 100
    );
    return batteryLevel;
  }

  private getWeightFromFelicitaRawStatus(view: Uint8Array): string {
    return Array.from(view.slice(3, 9))
      .map(value => value - 48)
      .join('');
  }
}
