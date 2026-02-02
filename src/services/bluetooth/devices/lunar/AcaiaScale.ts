import { Characteristic } from '../../types/ble.types';
import { SCALE_CHARACTERISTIC_UUID, PYXIS_RX_CHARACTERISTIC_UUID, PYXIS_TX_CHARACTERISTIC_UUID, MAGIC1, MAGIC2 } from './constants';
import { Button, DecoderResultType, MessageType, ParsedMessage, ScaleMessageType, Units } from './common';
import { Logger } from '../../utils/Logger';
import { Decoder } from './decoder';
import { bleAdapter } from '../../adapters/BleAdapter';
import { to128bitUUID } from '../../utils/helpers'; // Assuming a helper for UUID conversion

export enum EventType {
  WEIGHT,
  TIMER_START,
  TIMER_STOP,
  TIMER_RESET,
  TARE,
  SETTINGS,
}

const HEARTBEAT_INTERVAL = 1000;

export class AcaiaScale {
  private readonly device_id: string;
  private rx_char_uuid: string = '';
  private tx_char_uuid: string = '';
  private weight_uuid: string = '';
  private isPyxisStyle: boolean = false;
  private readonly characteristics: Characteristic[];
  private decoder: Decoder;
  private readonly logger: Logger;
  private connected: boolean = false;
  private last_heartbeat: number = 0;
  private command_queue: ArrayBuffer[] = [];

  public weight: number | null = 0;
  public battery: number | null = 0;
  public units: Units | null = null;
  public auto_off: boolean | null = null;
  public beep_on: boolean | null = null;

  private callback: (eventType: EventType, data?: unknown) => void;

  constructor(deviceId: string, characteristics: Characteristic[], callback: (eventType: EventType, data?: unknown) => void) {
    this.device_id = deviceId;
    this.characteristics = characteristics;
    this.callback = callback;
    this.logger = new Logger('AcaiaScale');
    this.decoder = new Decoder();

    if (!this.findBLEUUIDs()) {
      throw new Error('Cannot find weight service and characteristics on the scale');
    }
  }

  public async connect() {
    if (this.connected) return;

    await bleAdapter.startNotifications(this.device_id, this.weight_uuid, this.rx_char_uuid, this.handleNotification.bind(this));
    this.connected = true;
    await this.initScales();
    this.startHeartbeatMonitor();
    this.logger.log('Acaia Scale Connected');
  }

  public disconnectTriggered() {
    this.logger.debug('Scale disconnect triggered');
    this.connected = false;
    this.stopHeartbeatMonitor();
  }

  public tare() {
    if (!this.connected) return;
    this.command_queue.push(this.encode(4, [0])); // encodeTare
  }

  public startTimer() {
    if (!this.connected) return;
    this.command_queue.push(this.encode(13, [0, 0])); // encodeStartTimer
  }

  public stopTimer() {
    if (!this.connected) return;
    this.command_queue.push(this.encode(13, [0, 2])); // encodeStopTimer
  }

  public resetTimer() {
    if (!this.connected) return;
    this.command_queue.push(this.encode(13, [0, 1])); // encodeResetTimer
  }

  private findBLEUUIDs(): boolean {
    let foundRx = false;
    let foundTx = false;
    for (const char of this.characteristics) {
      if (to128bitUUID(char.characteristic) === to128bitUUID(SCALE_CHARACTERISTIC_UUID)) {
        this.rx_char_uuid = char.characteristic.toLowerCase();
        this.tx_char_uuid = char.characteristic.toLowerCase();
        this.weight_uuid = char.service.toLowerCase();
        this.isPyxisStyle = false;
        foundRx = true;
        foundTx = true;
      } else if (to128bitUUID(char.characteristic) === to128bitUUID(PYXIS_RX_CHARACTERISTIC_UUID)) {
        this.rx_char_uuid = char.characteristic.toLowerCase();
        foundRx = true;
      } else if (to128bitUUID(char.characteristic) === to128bitUUID(PYXIS_TX_CHARACTERISTIC_UUID)) {
        this.tx_char_uuid = char.characteristic.toLowerCase();
        this.weight_uuid = char.service.toLowerCase();
        this.isPyxisStyle = true;
        foundTx = true;
      }
      if (foundRx && foundTx) return true;
    }
    return false;
  }

  private handleNotification(value: ArrayBufferLike) {
    if (!this.connected) return;
    const result = this.decoder.process(value);
    if (result && result.type === DecoderResultType.DECODE_RESULT) {
      this.messageParseCallback(result.data);
    }
    this.heartbeat();
  }

  private startHeartbeatMonitor() {
    // This logic is now handled inside the heartbeat itself
  }

  private stopHeartbeatMonitor() {
    // Handled by connected flag
  }

  private messageParseCallback(messages: ParsedMessage[]) {
    messages.forEach((msg) => {
      if (msg.type === MessageType.SETTINGS) {
        this.battery = msg.battery;
        this.units = msg.units;
        this.auto_off = msg.autoOff;
        this.beep_on = msg.beepOn;
        this.callback(EventType.SETTINGS, msg);
      } else if (msg.type === MessageType.MESSAGE) {
        if (msg.msgType === ScaleMessageType.WEIGHT) {
          this.weight = msg.weight;
          this.callback(EventType.WEIGHT, this.weight);
        } else if (msg.msgType === ScaleMessageType.TARE_START_STOP_RESET) {
          switch (msg.button) {
            case Button.TARE: this.callback(EventType.TARE); break;
            case Button.START: this.callback(EventType.TIMER_START); break;
            case Button.STOP: this.callback(EventType.TIMER_STOP); break;
            case Button.RESET: this.callback(EventType.TIMER_RESET); break;
          }
        }
      }
    });
  }

  private async initScales() {
    await this.ident();
    this.last_heartbeat = Date.now();
  }

  private async write(data: ArrayBuffer, _withoutResponse = false) {
    if (!this.connected) return;
    return bleAdapter.write(this.device_id, this.weight_uuid, this.tx_char_uuid, data);
  }

  private async ident() {
    await this.write(this.encode(11, this.isPyxisStyle ? [0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x30, 0x31, 0x32, 0x33, 0x34] : Array(15).fill(0x2d)), true);
    await new Promise(r => setTimeout(r, 100));
    await this.write(this.encode(12, [0, 1, 1, 2, 2, 5, 3, 4]), true);
  }

  private heartbeat() {
    if (!this.connected) return;

    while (this.command_queue.length) {
      const packet = this.command_queue.shift();
      if (packet) this.write(packet, true).catch(e => this.logger.error('Error writing command', e));
    }

    if (Date.now() >= this.last_heartbeat + HEARTBEAT_INTERVAL) {
      this.last_heartbeat = Date.now();
      const heartbeatPayload = this.isPyxisStyle ? this.encode(11, Array(15).fill(0x2d)) : this.encode(0, [2, 0]);
      this.write(heartbeatPayload, this.isPyxisStyle).catch(e => this.logger.error('Heartbeat failed', e));
    }
  }

  private encode(msgType: number, payload: number[]): ArrayBuffer {
    const bytes = new Uint8Array(5 + payload.length);
    bytes[0] = MAGIC1;
    bytes[1] = MAGIC2;
    bytes[2] = msgType;
    let cksum1 = 0;
    let cksum2 = 0;
    for (let i = 0; i < payload.length; i++) {
      const val = payload[i] & 0xff;
      bytes[3 + i] = val;
      if (i % 2 === 0) cksum1 += val;
      else cksum2 += val;
    }
    bytes[payload.length + 3] = cksum1 & 0xff;
    bytes[payload.length + 4] = cksum2 & 0xff;
    return bytes.buffer;
  }
}
