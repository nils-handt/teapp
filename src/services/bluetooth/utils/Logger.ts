import { Subject } from 'rxjs';

const DEBUG = true; // Make this configurable later

export class Logger {
  private static logEnabled = DEBUG;
  private static logSubject = new Subject<{ level: string; message: string; optionalParams: unknown[] }>();

  constructor(private prefix: string) { }

  public static enableLog(): void {
    this.logEnabled = true;
  }

  public static disableLog(): void {
    this.logEnabled = false;
  }

  public static isLogEnabled(): boolean {
    return this.logEnabled;
  }

  public static attachOnLog(callback: (log: { level: string; message: string }) => void): void {
    this.logSubject.subscribe(callback);
  }

  private logMessage(level: string, message: string, optionalParams: unknown[]): void {
    if (Logger.logEnabled) {
      const log = { level, message: `[${this.prefix}] ${message}`, optionalParams };
      console.log(log.message, ...optionalParams);
      Logger.logSubject.next(log);
    }
  }

  public log(message: string, ...optionalParams: unknown[]): void {
    this.logMessage('log', message, optionalParams);
  }

  public info(message: string, ...optionalParams: unknown[]): void {
    this.logMessage('info', message, optionalParams);
  }

  public error(message: string, ...optionalParams: unknown[]): void {
    this.logMessage('error', message, optionalParams);
  }

  public debug(message: string, ...optionalParams: unknown[]): void {
    this.logMessage('debug', message, optionalParams);
  }
}
