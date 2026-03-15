import {Observable, Subject} from 'rxjs';
import {PeripheralData} from '../types/ble.types';
import {
    FlowChangeEvent,
    SCALE_TIMER_COMMAND,
    ScaleType,
    TareEvent,
    TimerEvent,
    Weight,
    WeightChangeEvent
} from '../types/scale.types';
import {Logger} from '../utils/Logger';

export abstract class BluetoothScale {
  protected logger: Logger;
  private disconnectHandler: (() => void | Promise<void>) | null = null;
  public batteryLevel = 100;
  public supportsTaring = true;
  public supportsTwoWeights = false;
  public supportsTimer = false;

  protected weight: Weight = { actual: 0, old: 0, smoothed: 0, oldSmoothed: 0 };
  protected secondWeight: Weight = { actual: 0, old: 0, smoothed: 0, oldSmoothed: 0 };

  protected weightChangeSubject = new Subject<WeightChangeEvent>();
  public weightChange: Observable<WeightChangeEvent> = this.weightChangeSubject.asObservable();

  protected flowChangeSubject = new Subject<FlowChangeEvent>();
  public flowChange: Observable<FlowChangeEvent> = this.flowChangeSubject.asObservable();

  protected timerEventSubject = new Subject<TimerEvent>();
  public timerEvent: Observable<TimerEvent> = this.timerEventSubject.asObservable();

  protected tareEventSubject = new Subject<TareEvent>();
  public tareEvent: Observable<TareEvent> = this.tareEventSubject.asObservable();

  constructor(
    public peripheral: Partial<PeripheralData>,
    public scaleType: ScaleType
  ) {
    this.logger = new Logger(this.scaleType);
  }

  get device_id(): string {
    return this.peripheral.id || '';
  }

  get device_name(): string {
    return this.peripheral.name || '';
  }

  get device_address(): string {
    return this.peripheral.id || ''; // Capacitor uses ID for address
  }

  abstract connect(): Promise<void>;
  abstract tare(): Promise<void>;
  abstract setLed(on: boolean, timerOn?: boolean): Promise<void>;
  abstract setTimer(command: SCALE_TIMER_COMMAND): Promise<void>;
  abstract getWeight(): Promise<void>;
  abstract disconnectTriggered(): Promise<void> | void;

  public setDisconnectHandler(handler: (() => void | Promise<void>) | null): void {
    this.disconnectHandler = handler;
  }

  public cleanup(): void {
    this.weightChangeSubject.complete();
    this.flowChangeSubject.complete();
    this.timerEventSubject.complete();
    this.tareEventSubject.complete();
  }

  protected async handleDeviceDisconnect(): Promise<void> {
    try {
      await this.disconnectTriggered();
    } catch (error) {
      this.logger.error('Error during disconnect cleanup', error);
    }

    if (this.disconnectHandler) {
      await this.disconnectHandler();
    }
  }

  protected setWeight(weight: number, stable: boolean): void {
    this.weight.old = this.weight.actual;
    this.weight.actual = weight;
    this.weight.oldSmoothed = this.weight.smoothed;
    this.weight.smoothed = this.getSmoothedWeight(this.weight.actual, this.weight.old, this.weight.oldSmoothed);
    this.weightChangeSubject.next({ weight: this.weight, stable, timestamp: Date.now() });
  }

  protected setSecondWeight(weight: number, _stable: boolean): void {
    this.secondWeight.old = this.secondWeight.actual;
    this.secondWeight.actual = weight;
    this.secondWeight.oldSmoothed = this.secondWeight.smoothed;
    this.secondWeight.smoothed = this.getSmoothedWeight(this.secondWeight.actual, this.secondWeight.old, this.secondWeight.oldSmoothed);
    // Note: Beanconqueror emits a second event here. Decide if needed.
  }

  protected triggerFlow(): void {
    this.flowChangeSubject.next({ timestamp: Date.now() });
  }

  protected triggerSecondFlow(): void {
    // Note: Beanconqueror emits a second event here. Decide if needed.
  }

  public setDoubleWeight(value: boolean): void {
    this.supportsTwoWeights = value;
  }

  public resetSmoothedValue(): void {
    this.weight.smoothed = this.weight.actual;
  }

  private getSmoothedWeight(actual: number, old: number, oldSmoothed: number): number {
    const alpha = 0.2; // Smoothing factor
    if (Math.abs(actual - old) > 10) {
      return actual;
    }
    return alpha * actual + (1 - alpha) * oldSmoothed;
  }
}
