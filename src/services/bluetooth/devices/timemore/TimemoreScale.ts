import { PeripheralData } from '../../types/ble.types';
import { BluetoothScale } from '../../base/BluetoothScale';
import { ScaleType, SCALE_TIMER_COMMAND } from '../../types/scale.types';
import { bleAdapter } from '../../adapters/BleAdapter';

export class TimemoreScale extends BluetoothScale {
  public static DEVICE_NAME = 'timemore scale';
  public static SERVICE_UUID = '181d';
  public static CHAR_UUID = '2a9d';
  public static CMD_UUID = '553f4e49-bf21-4468-9c6c-0e4fb5b17697';

  constructor(peripheral: PeripheralData) {
    super(peripheral, ScaleType.TIMEMORE);
    this.supportsTwoWeights = true;
  }

  public static test(peripheral: PeripheralData): boolean {
    return peripheral.name.toLowerCase().includes(this.DEVICE_NAME);
  }

  async connect(): Promise<void> {
    await bleAdapter.connect(this.device_id, this.disconnectTriggered.bind(this));
    await bleAdapter.startNotifications(
      this.device_id,
      TimemoreScale.SERVICE_UUID,
      TimemoreScale.CHAR_UUID,
      this.handleNotifications.bind(this)
    );
  }

  async tare(): Promise<void> {
    await this.write(new Uint8Array([0x00]));
  }

  async setLed(_on: boolean): Promise<void> {
    // Not supported
  }

  async setTimer(command: SCALE_TIMER_COMMAND): Promise<void> {
    this.logger.log('Setting Timer command ' + command + '...');
    if (command === SCALE_TIMER_COMMAND.START) {
      await this.write(new Uint8Array([0x08]));
    } else if (command === SCALE_TIMER_COMMAND.STOP) {
      await this.write(new Uint8Array([0x09]));
    } else if (command === SCALE_TIMER_COMMAND.RESET) {
      await this.write(new Uint8Array([0x0a]));
    }
  }

  async getWeight(): Promise<void> {
    // Weight is pushed via notifications
  }

  disconnectTriggered(): void {
    bleAdapter.stopNotifications(
      this.device_id,
      TimemoreScale.SERVICE_UUID,
      TimemoreScale.CHAR_UUID
    ).catch(err => this.logger.error('Error stopping notifications', err));
  }

  private async write(bytes: Uint8Array): Promise<void> {
    const buffer = bleAdapter.numbersToData(Array.from(bytes));
    await bleAdapter.write(this.device_id, TimemoreScale.SERVICE_UUID, TimemoreScale.CMD_UUID, buffer);
  }

  private async getInt(buffer: Uint8Array): Promise<number> {
    const bytes = new DataView(new ArrayBuffer(buffer.length));
    for (let i = 0; i < buffer.length; i++) {
      bytes.setUint8(i, buffer[i]);
    }
    return bytes.getInt16(0, true);
  }

  private async handleNotifications(data: ArrayBufferLike): Promise<void> {
    const timemoreRawStatus = new Uint8Array(data);
    const weight = await this.getInt(timemoreRawStatus.slice(1, 4));
    const weight2 = await this.getInt(timemoreRawStatus.slice(5, 8));
    this.setWeight(weight / 10, true); // Stability not indicated
    this.setSecondWeight(weight2 / 10, true); // Stability not indicated
  }
}
