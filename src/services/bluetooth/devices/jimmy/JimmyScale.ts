import { PeripheralData } from '../../types/ble.types';
import { BluetoothScale } from '../../base/BluetoothScale';
import { ScaleType, SCALE_TIMER_COMMAND } from '../../types/scale.types';
import { bleAdapter } from '../../adapters/BleAdapter';

enum JimmyUnit {
  GRAM = 'g',
  OUNCE = 'oz',
}

enum JimmyMode {
  SCALE_ONLY = 0x01,
  TIMER_SCALE = 0x02,
  POUR_OVER = 0x03,
  ESPRESSO_1 = 0x04,
  ESPRESSO_2 = 0x05,
  ESPRESSO_3 = 0x06,
}

export class JimmyScale extends BluetoothScale {
  public static SERVICE_UUID = '06c31822-8682-4744-9211-febc93e3bece';
  public static WRITE_CHAR_UUID = '06c31823-8682-4744-9211-febc93e3bece';
  public static READ_CHAR_UUID = '06c31824-8682-4744-9211-febc93e3bece';

  private unit?: JimmyUnit = undefined;
  private mode?: JimmyMode = undefined;

  constructor(peripheral: PeripheralData) {
    super(peripheral, ScaleType.JIMMY);
    this.supportsTimer = false; // Timer control is not standard
  }

  public static test(peripheral: PeripheralData): boolean {
    return peripheral.name.toLowerCase().startsWith('hiroia');
  }

  async connect(): Promise<void> {
    await bleAdapter.connect(this.device_id, this.disconnectTriggered.bind(this));
    await bleAdapter.startNotifications(this.device_id, JimmyScale.SERVICE_UUID, JimmyScale.READ_CHAR_UUID, this.handleNotifications.bind(this));
    setTimeout(async () => {
      await this.setUnit(JimmyUnit.GRAM);
      await this.setMode(JimmyMode.SCALE_ONLY);
    }, 500);
  }

  async tare(): Promise<void> {
    const tareCommand = [0x07, 0x00];
    await this.write(tareCommand);
    setTimeout(() => {
      this.write(tareCommand);
    }, 200);
  }

  async setLed(_on: boolean): Promise<void> {
    // Not supported
  }

  async setTimer(_command: SCALE_TIMER_COMMAND): Promise<void> {
    this.logger.log('Standard timer commands not supported by Jimmy scale');
  }

  async getWeight(): Promise<void> {
    // Weight is pushed via notifications
  }

  disconnectTriggered(): void {
    bleAdapter.stopNotifications(this.device_id, JimmyScale.SERVICE_UUID, JimmyScale.READ_CHAR_UUID)
      .catch(err => this.logger.error('Error stopping notifications', err));
  }

  private async write(bytes: number[]): Promise<void> {
    const buffer = bleAdapter.numbersToData(bytes);
    await bleAdapter.write(this.device_id, JimmyScale.SERVICE_UUID, JimmyScale.WRITE_CHAR_UUID, buffer);
  }

  private handleNotifications(data: ArrayBufferLike): void {
    const buf = new Uint8Array(data);
    const mode = buf[0];
    const sign = buf[6];
    const msw = buf[5];
    const lsw = buf[4];
    let weight = 256 * msw + lsw;

    if (sign === 255) { // negative weight
      weight = (65536 - weight) * -1;
    }

    if (mode > 0x08) {
      this.unit = JimmyUnit.OUNCE;
      this.setWeight(weight / 1000, true);
      this.mode = mode - 0x08;
    } else {
      this.unit = JimmyUnit.GRAM;
      this.setWeight(weight / 10, true);
      this.mode = mode;
    }
  }

  private async setUnit(unit: JimmyUnit): Promise<void> {
    if (this.unit !== unit) {
      const toggleUnit = [0x0b, 0x00];
      await this.write(toggleUnit);
      setTimeout(() => this.setUnit(unit), 250);
    }
  }

  private async setMode(mode: JimmyMode): Promise<void> {
    if (this.mode !== mode) {
      const toggleMode = [0x04, 0x00];
      await this.write(toggleMode);
      setTimeout(() => this.setMode(mode), 250);
    }
  }
}
