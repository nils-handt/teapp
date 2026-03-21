import { PeripheralData } from '../../types/ble.types';
import { BluetoothScale } from '../../base/BluetoothScale';
import { ScaleType, SCALE_TIMER_COMMAND } from '../../types/scale.types';
import { bleAdapter } from '../../adapters/BleAdapter';

export class WeighMyBruScale extends BluetoothScale {
  public static DEVICE_NAME = 'WeighMyBru';
  public static SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  public static CHAR_UUID = '6e400004-b5a3-f393-e0a9-e50e24dcca9e';
  public static CMD_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

  constructor(peripheral: PeripheralData) {
    super(peripheral, ScaleType.WEIGHMYBRU);
    this.supportsTimer = true;
  }

  public static test(peripheral: PeripheralData): boolean {
    return peripheral.name.toLowerCase().includes(this.DEVICE_NAME.toLowerCase());
  }

  async connect(): Promise<void> {
    await bleAdapter.connect(this.device_id, this.handleDeviceDisconnect.bind(this));
    await bleAdapter.startNotifications(
      this.device_id,
      WeighMyBruScale.SERVICE_UUID,
      WeighMyBruScale.CHAR_UUID,
      this.handleNotifications.bind(this)
    );
  }

  async tare(): Promise<void> {
    await this.write(new Uint8Array([0x03, 0x0a, 0x01, 0x01, 0x00]));
  }

  async setLed(_on: boolean): Promise<void> {
    // Not supported
  }

  async setTimer(command: SCALE_TIMER_COMMAND): Promise<void> {
    this.logger.info(`Setting timer command ${command}`);
    if (command === SCALE_TIMER_COMMAND.START) {
      await this.write(new Uint8Array([0x03, 0x0a, 0x02, 0x01, 0x00]));
    } else if (command === SCALE_TIMER_COMMAND.STOP) {
      await this.write(new Uint8Array([0x03, 0x0a, 0x03, 0x01, 0x00]));
    } else if (command === SCALE_TIMER_COMMAND.RESET) {
      await this.write(new Uint8Array([0x03, 0x0a, 0x04, 0x01, 0x00]));
    }
  }

  async getWeight(): Promise<void> {
    // Weight is pushed via notifications
  }

  disconnectTriggered(): void {
    bleAdapter.stopNotifications(
      this.device_id,
      WeighMyBruScale.SERVICE_UUID,
      WeighMyBruScale.CHAR_UUID
    ).catch(err => this.logger.error('Error stopping notifications', err));
  }

  private async write(bytes: Uint8Array): Promise<void> {
    const buffer = bleAdapter.numbersToData(Array.from(bytes));
    await bleAdapter.write(this.device_id, WeighMyBruScale.SERVICE_UUID, WeighMyBruScale.CMD_UUID, buffer);
  }

  private handleNotifications(data: ArrayBufferLike): void {
    if (data.byteLength >= 4) {
      const weight = new DataView(data).getFloat32(0, true);
      this.setWeight(weight, true); // Stability not indicated
    }
  }
}
