import { PeripheralData } from '../../types/ble.types';
import { BluetoothScale } from '../../base/BluetoothScale';
import { ScaleType, SCALE_TIMER_COMMAND } from '../../types/scale.types';
import { bleAdapter } from '../../adapters/BleAdapter';

const WRITE_SERVICE_UUID = 'fff0';
const WRITE_CHAR_UUID = '36f5';
const READ_SERVICE_UUID = 'fff0';
const READ_CHAR_UUID = 'fff4';
const HEADER = 0x03;

export class DecentScale extends BluetoothScale {
  private tareCounter: number = 0;
  private apiVersion: string | undefined = undefined;
  private heartbeatTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  constructor(peripheral: PeripheralData) {
    super(peripheral, ScaleType.DECENT);
    this.supportsTimer = true;
  }

  public static test(peripheral: PeripheralData): boolean {
    return peripheral.name.toLowerCase().startsWith('decent');
  }

  async connect(): Promise<void> {
    await bleAdapter.connect(this.device_id, this.handleDeviceDisconnect.bind(this));
    await this.setLed(true, true);
    await this.attachNotification();
    this.startHeartbeatMonitor();
  }

  async tare(): Promise<void> {
    const command = this.buildTareCommand();
    await this.write(command);
    setTimeout(async () => {
      await this.write(command);
    }, 200);
  }

  async setLed(weightOn: boolean, timerOn: boolean): Promise<void> {
    const command = this.buildLedOnOffCommand(weightOn, timerOn);
    await this.write(command);
    setTimeout(async () => {
      await this.write(command);
    }, 200);
  }

  async setTimer(command: SCALE_TIMER_COMMAND): Promise<void> {
    const timerCommand = this.buildTimerCommand(command);
    await this.write(timerCommand);
    setTimeout(async () => {
      await this.write(timerCommand);
    }, 200);
  }

  async getWeight(): Promise<void> {
    // Weight is pushed via notifications
  }

  disconnectTriggered(): void {
    this.stopHeartbeatMonitor();
    bleAdapter.stopNotifications(this.device_id, READ_SERVICE_UUID, READ_CHAR_UUID)
      .catch(err => this.logger.error('Error stopping notifications', err));
  }

  private getXOR(bytes: Uint8Array): number {
    return bytes.slice(0, 6).reduce((a, b) => a ^ b, 0);
  }

  private buildTareCommand(): Uint8Array {
    const bytes = new Uint8Array(7);
    bytes[0] = HEADER;
    bytes[1] = 0x0f;
    bytes[2] = 0xfd;
    bytes[3] = this.tareCounter;
    bytes[4] = 0x00;
    bytes[5] = 0x01;
    bytes[6] = this.getXOR(bytes);
    this.tareCounter = (this.tareCounter + 1) % 256;
    return bytes;
  }

  private buildLedOnOffCommand(weightLedOn: boolean, timerLedOn: boolean): Uint8Array {
    const bytes = new Uint8Array(7);
    bytes[0] = HEADER;
    bytes[1] = 0x0a;
    bytes[2] = weightLedOn ? 0x01 : 0x00;
    bytes[3] = timerLedOn ? 0x01 : 0x00;
    bytes[4] = 0x00;
    bytes[5] = 0x00;
    bytes[6] = this.getXOR(bytes);
    return bytes;
  }

  private buildTimerCommand(command: SCALE_TIMER_COMMAND): Uint8Array {
    const bytes = new Uint8Array(7);
    bytes[0] = HEADER;
    bytes[1] = 0x0b;
    if (command === SCALE_TIMER_COMMAND.START) bytes[2] = 0x03;
    else if (command === SCALE_TIMER_COMMAND.RESET) bytes[2] = 0x02;
    else bytes[2] = 0x00; // STOP
    bytes[3] = 0x00;
    bytes[4] = 0x00;
    bytes[5] = 0x00;
    bytes[6] = this.getXOR(bytes);
    return bytes;
  }

  private async write(bytes: Uint8Array): Promise<void> {
    await bleAdapter.write(this.device_id, WRITE_SERVICE_UUID, WRITE_CHAR_UUID, bytes.buffer);
  }

  private async attachNotification(): Promise<void> {
    await bleAdapter.startNotifications(this.device_id, READ_SERVICE_UUID, READ_CHAR_UUID, this.handleNotifications.bind(this));
  }

  private handleNotifications(data: ArrayBufferLike): void {
    const uScaleData = new Uint8Array(data);
    if (this.apiVersion === undefined) {
      if (data.byteLength === 10) this.apiVersion = '>1.3';
      else if (data.byteLength === 7) this.apiVersion = '<1.3';
      this.logger.info(`Determined Decent API version: ${this.apiVersion}`);
    }

    if (uScaleData[1] === 0xce || uScaleData[1] === 0xca) {
      const dataview = new DataView(uScaleData.buffer);
      const newWeight = dataview.getInt16(2, false) ?? 0;
      const weightIsStable = uScaleData[1] === 0xce;
      this.setWeight(newWeight / 10.0, weightIsStable);
    } else if (uScaleData[1] === 0xaa && uScaleData[2] === 0x02) {
      // Timer button pressed - Beanconqueror emits null, we should emit the command
      // This requires knowing the state, which we don't have here.
      // For now, we can just log it.
      this.logger.info('Timer button pressed on scale');
    }
  }

  private startHeartbeatMonitor(): void {
    this.heartbeatTimer = setInterval(() => {
      const bytes = new Uint8Array([0x03, 0x0a, 0x03, 0xff, 0xff, 0x00, 0x0a]);
      this.write(bytes).catch(err => this.logger.error('Heartbeat failed', err));
    }, 2000);
  }

  private stopHeartbeatMonitor(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}
