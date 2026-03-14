import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';

class KeepAwakeService {
  private static instance: KeepAwakeService;
  private isActive = false;
  private isSupported: boolean | null = null;

  public static getInstance(): KeepAwakeService {
    if (!KeepAwakeService.instance) {
      KeepAwakeService.instance = new KeepAwakeService();
    }
    return KeepAwakeService.instance;
  }

  private isAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  private async ensureSupported(): Promise<boolean> {
    if (!this.isAndroid()) return false;
    if (this.isSupported !== null) return this.isSupported;

    try {
      const result = await KeepAwake.isSupported();
      this.isSupported = result.isSupported;
    } catch {
      this.isSupported = false;
    }

    return this.isSupported;
  }

  public async keepAwake(): Promise<void> {
    if (!this.isAndroid()) return;
    if (this.isActive) return;
    if (!(await this.ensureSupported())) return;

    await KeepAwake.keepAwake();
    this.isActive = true;
  }

  public async allowSleep(): Promise<void> {
    if (!this.isAndroid()) return;
    if (!this.isActive) return;
    if (!(await this.ensureSupported())) {
      this.isActive = false;
      return;
    }

    await KeepAwake.allowSleep();
    this.isActive = false;
  }

  public resetForTest(): void {
    this.isActive = false;
    this.isSupported = null;
  }
}

export const keepAwakeService = KeepAwakeService.getInstance();
