import { PeripheralData } from '../../types/ble.types';
import { BluetoothScale } from '../../base/BluetoothScale';
import { ScaleType, SCALE_TIMER_COMMAND } from '../../types/scale.types';
import { AcaiaScale, EventType } from './AcaiaScale';

export class LunarScale extends BluetoothScale {
  private scale: AcaiaScale;

  constructor(peripheral: PeripheralData) {
    super(peripheral, ScaleType.LUNAR);
    this.scale = new AcaiaScale(peripheral.id, peripheral.characteristics, this.onEvent.bind(this));
  }

  public static test(peripheral: PeripheralData): boolean {
    const name = peripheral.name.toUpperCase();
    return ['ACAIA', 'LUNAR', 'PYXIS', 'PROCH', 'PEARL', 'CINCO'].includes(name.slice(0, 5));
  }

  disconnectTriggered(): void {
    this.scale.disconnectTriggered();
  }

  async connect(): Promise<void> {
    await this.scale.connect();
  }

  async tare(): Promise<void> {
    this.scale.tare();
  }

  async setLed(_on: boolean): Promise<void> {
    // Not supported through this wrapper
  }

  async setTimer(command: SCALE_TIMER_COMMAND): Promise<void> {
    if (command === SCALE_TIMER_COMMAND.START) this.scale.startTimer();
    else if (command === SCALE_TIMER_COMMAND.STOP) this.scale.stopTimer();
    else this.scale.resetTimer();
  }

  async getWeight(): Promise<void> {
    // Weight is pushed via events
  }

  private onEvent(eventType: EventType, data: unknown) {
    switch (eventType) {
      case EventType.WEIGHT:
        this.setWeight(data as number, true); // Acaia doesn't seem to provide stability flag
        break;
      case EventType.TARE:
        this.tareEventSubject.next({ timestamp: Date.now() });
        break;
      case EventType.TIMER_START:
        this.timerEventSubject.next({ command: SCALE_TIMER_COMMAND.START, timestamp: Date.now() });
        break;
      case EventType.TIMER_STOP:
        this.timerEventSubject.next({ command: SCALE_TIMER_COMMAND.STOP, timestamp: Date.now() });
        break;
      case EventType.TIMER_RESET:
        this.timerEventSubject.next({ command: SCALE_TIMER_COMMAND.RESET, timestamp: Date.now() });
        break;
      case EventType.SETTINGS: {
        const settings = data as { battery?: number };
        if (settings.battery) this.batteryLevel = settings.battery;
        break;
      }
    }
  }
}
