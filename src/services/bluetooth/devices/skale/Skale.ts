import { PeripheralData } from '../../types/ble.types';
import { BluetoothScale } from '../../base/BluetoothScale';
import { ScaleType, SCALE_TIMER_COMMAND } from '../../types/scale.types';
import { bleAdapter } from '../../adapters/BleAdapter';

export class Skale extends BluetoothScale {
  public static SERVICE_UUID = 'FF08';
  public static WRITE_CHAR_UUID = 'EF80';
  public static READ_CHAR_UUID = 'EF81';

  constructor(peripheral: PeripheralData) {
    super(peripheral, ScaleType.SKALE);
    this.supportsTimer = false;
  }

  public static test(peripheral: PeripheralData): boolean {
    return peripheral.name.toLowerCase().startsWith('skale');
  }

  async connect(): Promise<void> {
    await bleAdapter.connect(this.device_id, this.disconnectTriggered.bind(this));
    await bleAdapter.startNotifications(this.device_id, Skale.SERVICE_UUID, Skale.READ_CHAR_UUID, this.handleNotifications.bind(this));
    await this.setLed(true);
    await this.displayCurrentWeight();
    await this.setGrams();
  }

  async tare(): Promise<void> {
    const command = [0x10];
    await this.write(command);
    setTimeout(() => this.write(command), 200);
  }

  async setLed(on: boolean): Promise<void> {
    const command = on ? [0xed] : [0xee];
    await this.write(command);
    setTimeout(() => this.write(command), 200);
  }

  async setTimer(_command: SCALE_TIMER_COMMAND): Promise<void> {
    // Not supported
  }

  async getWeight(): Promise<void> {
    // Weight is pushed via notifications
  }

  disconnectTriggered(): void {
    bleAdapter.stopNotifications(this.device_id, Skale.SERVICE_UUID, Skale.READ_CHAR_UUID)
      .catch(err => this.logger.error('Error stopping notifications', err));
  }

  async displayCurrentWeight(): Promise<void> {
    const command = [0xec];
    await this.write(command);
    setTimeout(() => this.write(command), 200);
  }

  async setGrams(): Promise<void> {
    const command = [0x03];
    await this.write(command);
    setTimeout(() => this.write(command), 200);
  }

  private async write(bytes: number[]): Promise<void> {
    const buffer = bleAdapter.numbersToData(bytes);
    await bleAdapter.write(this.device_id, Skale.SERVICE_UUID, Skale.WRITE_CHAR_UUID, buffer);
  }

  private handleNotifications(data: ArrayBufferLike): void {
    const scaleData = new Int8Array(data);
    const uScaleData = new Uint8Array(data);
    let newWeight = (uScaleData[2] << 8) + uScaleData[1];
    if (newWeight > 2001) {
      newWeight = (scaleData[2] << 8) + scaleData[1];
    }
    this.setWeight(newWeight / 10, true); // Stability not indicated
  }
}
