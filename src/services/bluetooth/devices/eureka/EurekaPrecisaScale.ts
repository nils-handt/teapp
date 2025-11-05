// agent messed up here, double check

import {PeripheralData} from '../../types/ble.types';
import {BluetoothScale} from '../../base/BluetoothScale';
import {SCALE_TIMER_COMMAND, ScaleType} from '../../types/scale.types';
import {bleAdapter} from '../../adapters/BleAdapter';

const DATA_SERVICE = 'fff0';
const DATA_CHARACTERISTIC = 'fff1';
const CMD_CHARACTERISTIC = 'fff2';

const DEVICE_NAMES = ['cfs-9002', 'lsj-001'];

const CMD_HEADER = 0xaa;
const CMD_BASE = 0x02;
const CMD_TARE = 0x01;
const CMD_TIMER = 0x02;

export class EurekaPrecisaScale extends BluetoothScale {
  constructor(peripheral: PeripheralData) {
    super(peripheral, ScaleType.EUREKA_PRECISA);
    this.supportsTimer = true;
  }

  public static test(peripheral: PeripheralData): boolean {
    const name = peripheral.name.toLowerCase();
    return DEVICE_NAMES.some(dn => name.startsWith(dn));
  }

  async connect(): Promise<void> {
    await bleAdapter.connect(this.device_id, this.disconnectTriggered.bind(this));
    await bleAdapter.startNotifications(this.device_id, DATA_SERVICE, DATA_CHARACTERISTIC, this.handleNotifications.bind(this));
  }

  async tare(): Promise<void> {
    const command = new Uint8Array([CMD_HEADER, CMD_BASE, CMD_TARE, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xad]);
    await this.write(command);
  }

  async setLed(_on: boolean): Promise<void> {
    // Not supported
  }

  async setTimer(_command: SCALE_TIMER_COMMAND): Promise<void> {
    // This scale seems to only support toggle for timer
    const timerCommand = new Uint8Array([CMD_HEADER, CMD_BASE, CMD_TIMER, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xae]);
    await this.write(timerCommand);
  }

  async getWeight(): Promise<void> {
    // Weight is pushed via notifications
  }

  disconnectTriggered(): void {
    bleAdapter.stopNotifications(this.device_id, DATA_SERVICE, DATA_CHARACTERISTIC)
      .catch(err => this.logger.error('Error stopping notifications', err));
  }

  private async write(bytes: Uint8Array): Promise<void> {
    await bleAdapter.write(this.device_id, DATA_SERVICE, CMD_CHARACTERISTIC, bytes.buffer);
  }

  private handleNotifications(data: ArrayBufferLike): void {
        const view = new DataView(data);
        if (view.byteLength < 11) return;
        const isStable = view.getUint8(1) === 0;
        const weight = view.getInt16(3, true); // Assuming 16-bit signed integer at byte 3, little-endian
        const unit = view.getUint8(5); // 0 = g, 1 = oz, 2 = ml
        let finalWeight = weight;
        if (unit === 1) finalWeight = weight * 28.3495;
        // ml is roughly equivalent to g for water, so no conversion needed for now
        this.setWeight(finalWeight / 10, isStable);
        this.batteryLevel = view.getUint8(9);
    }
}
