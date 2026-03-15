import { PeripheralData } from '../../types/ble.types';
import { BluetoothScale } from '../../base/BluetoothScale';
import { Logger } from '../../utils/Logger';
import { ScaleType, SCALE_TIMER_COMMAND } from '../../types/scale.types';
import { bleAdapter } from '../../adapters/BleAdapter';
import { numberToUUID } from '@capacitor-community/bluetooth-le';

export class BokooScale extends BluetoothScale {
  public static DEVICE_NAME = 'bookoo_sc';
  public static SERVICE_UUID = numberToUUID(0x0FFE);
  public static CHAR_UUID = numberToUUID(0xFF11);
  public static CMD_UUID = numberToUUID(0xFF12);

  constructor(peripheral: PeripheralData) {
    super(peripheral, ScaleType.BOKOO);
    this.logger = new Logger('BokooScale');
    this.supportsTimer = true;
  }

  public static test(peripheral: PeripheralData): boolean {
    return peripheral.name.toLowerCase().includes(this.DEVICE_NAME);
  }

  async connect(): Promise<void> {
    this.logger.log('Connecting...');
    await bleAdapter.connect(this.device_id, this.handleDeviceDisconnect.bind(this));
    await bleAdapter.startNotifications(
      this.device_id,
      BokooScale.SERVICE_UUID,
      BokooScale.CHAR_UUID,
      this.handleNotifications.bind(this)
    );
  }

  async tare(): Promise<void> {
    await this.write(new Uint8Array([0x03, 0x0a, 0x01, 0x00, 0x00, 0x08]));
  }

  async setLed(_on: boolean): Promise<void> {
    // Not supported
  }

  async getWeight(): Promise<void> {
    // Weight is pushed via notifications
  }

  disconnectTriggered(): void {
    this.logger.log('Disconnecting...');
    bleAdapter.stopNotifications(
      this.device_id,
      BokooScale.SERVICE_UUID,
      BokooScale.CHAR_UUID
    ).catch(err => this.logger.error('Error stopping notifications', err));
  }

  async setTimer(command: SCALE_TIMER_COMMAND): Promise<void> {
    this.logger.log('Setting Timer command ' + command + '...');
    if (command === SCALE_TIMER_COMMAND.START) {
      await this.write(new Uint8Array([0x03, 0x0a, 0x04, 0x00, 0x00, 0x0a]));
    } else if (command === SCALE_TIMER_COMMAND.STOP) {
      await this.write(new Uint8Array([0x03, 0x0a, 0x05, 0x00, 0x00, 0x0d]));
    } else if (command === SCALE_TIMER_COMMAND.RESET) {
      await this.write(new Uint8Array([0x03, 0x0a, 0x06, 0x00, 0x00, 0x0c]));
    }
  }

  private async write(bytes: Uint8Array): Promise<void> {
    await bleAdapter.write(
      this.device_id,
      BokooScale.SERVICE_UUID,
      BokooScale.CMD_UUID,
      bytes.buffer
    );
  }

  private handleNotifications(data: ArrayBufferLike): void {
    const view = new Uint8Array(data);
    if (view.length === 20) {
      this.batteryLevel = view[13];
      let weight = (view[7] << 16) + (view[8] << 8) + view[9];
      if (view[6] === 45) { // ASCII for '-'
        weight = weight * -1;
      }
      this.setWeight(weight / 100, true); // Stability not indicated, default to true
    }
  }
}
