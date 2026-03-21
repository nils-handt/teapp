import { MAGIC1, MAGIC2 } from './constants';
import {
  Button,
  Message,
  MessageType,
  ParsedMessage,
  ScaleMessageType,
  Settings,
  Units,
  DecoderResult,
  DecoderResultType,
} from './common';
import { Logger } from '../../utils/Logger';

export class Decoder {
  private readonly log: Logger;
  private packet: ArrayBufferLike = new ArrayBuffer(0);

  constructor() {
    this.log = new Logger('AcaiaDecoder');
  }

  public process(buffer: ArrayBufferLike): DecoderResult | null {
    this.addBuffer(buffer);
    const messages = this.processMessages();
    if (messages.length) {
      return { type: DecoderResultType.DECODE_RESULT, data: messages };
    }
    return null;
  }

  private processMessages(): ParsedMessage[] {
    const msgs: ParsedMessage[] = [];
    while (true) {
      let msg;
      [msg, this.packet] = this.decode(this.packet);
      if (!msg) {
        break;
      } else {
        msgs.push(msg);
      }
    }
    return msgs;
  }

  private addBuffer(buffer: ArrayBufferLike): void {
    if (this.packet && this.packet.byteLength > 0) {
      const tmp = new Uint8Array(this.packet.byteLength + buffer.byteLength);
      tmp.set(new Uint8Array(this.packet), 0);
      tmp.set(new Uint8Array(buffer), this.packet.byteLength);
      this.packet = tmp.buffer;
    } else {
      this.packet = buffer;
    }
  }

  private decode(buffer: ArrayBufferLike): [ParsedMessage | null, ArrayBufferLike] {
    const bytes = new Uint8Array(buffer);
    let messageStart = -1;

    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === MAGIC1 && bytes[i + 1] === MAGIC2) {
        messageStart = i;
        break;
      }
    }

    if (messageStart < 0 || bytes.length - messageStart < 6) {
      return [null, buffer];
    }

    const messageEnd = messageStart + bytes[messageStart + 3] + 5;
    if (messageEnd > bytes.length) {
      return [null, buffer];
    }

    const cmd = bytes[messageStart + 2];
    const remainingBuffer = bytes.slice(messageEnd).buffer;

    if (cmd === 12) {
      const msgType = bytes[messageStart + 4];
      const payloadIn = bytes.slice(messageStart + 5, messageEnd);
      return [this.parseMessage(msgType, payloadIn.buffer), remainingBuffer];
    }

    if (cmd === 8) {
      return [this.parseSettings(bytes.slice(messageStart + 3).buffer), remainingBuffer];
    }

    this.log.debug(`Non-event notification message command ${cmd}`);
    return [null, remainingBuffer];
  }

  private parseMessage(msgType: ScaleMessageType, buffer: ArrayBuffer): Message | null {
    const payload = new Uint8Array(buffer);
    let weight: number | null = null;
    let button: Button | null = null;
    let time = 0;

    switch (msgType) {
      case ScaleMessageType.WEIGHT:
        weight = this.decodeWeight(payload);
        break;
      case ScaleMessageType.HEARTBEAT:
        if (payload[2] === 5) weight = this.decodeWeight(payload.slice(3));
        else if (payload[2] === 7) time = this.decodeTime(payload.slice(3));
        break;
      case ScaleMessageType.TIMER:
        time = this.decodeTime(payload);
        break;
      case ScaleMessageType.TARE_START_STOP_RESET:
        if (payload[0] === 0 && payload[1] === 5) {
          button = Button.TARE;
          weight = this.decodeWeight(payload.slice(2));
        } else if (payload[0] === 8 && payload[1] === 5) {
          button = Button.START;
          weight = this.decodeWeight(payload.slice(2));
        } else if (payload[0] === 10 && payload[1] === 7) {
          button = Button.STOP;
          time = this.decodeTime(payload.slice(2));
          weight = this.decodeWeight(payload.slice(6));
        } else if (payload[0] === 9 && payload[1] === 7) {
          button = Button.RESET;
          time = this.decodeTime(payload.slice(2));
          weight = this.decodeWeight(payload.slice(6));
        } else {
          button = Button.UNKNOWN;
        }
        break;
      default:
        this.log.warn(`Unknown message type ${msgType}`);
        break;
    }

    return { type: MessageType.MESSAGE, msgType, weight, button, time };
  }

  private decodeWeight(payload: Uint8Array): number {
    let value = ((payload[1] & 0xff) << 8) + (payload[0] & 0xff);
    const unit = payload[4] & 0xff;
    if (unit === 1) value /= 10.0;
    else if (unit === 2) value /= 100.0;
    else if (unit === 3) value /= 1000.0;
    else if (unit === 4) value /= 10000.0;
    if ((payload[5] & 2) === 2) value *= -1;
    return value;
  }

  private decodeTime(payload: Uint8Array): number {
    let value = (payload[0] & 0xff) * 60;
    value += payload[1];
    value += payload[2] / 10.0;
    return value * 1000;
  }

  private parseSettings(buffer: ArrayBuffer): Settings {
    const payload = new Uint8Array(buffer);
    const battery = payload[1] & 127;
    const units = payload[2] === 2 ? Units.GRAMS : payload[2] === 5 ? Units.OUNCES : null;
    const autoOff = !!(payload[4] * 5);
    const beepOn = payload[6] === 1;
    return { type: MessageType.SETTINGS, battery, units, autoOff, beepOn };
  }
}
