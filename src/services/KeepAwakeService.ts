import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { createLogger } from './logging';

const logger = createLogger('KeepAwakeService');

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
      logger.info('Resolved keep-awake support', { isSupported: this.isSupported });
    } catch (error) {
      this.isSupported = false;
      logger.error('Failed to determine keep-awake support', error);
    }

    return this.isSupported;
  }

  public async keepAwake(): Promise<void> {
    if (!this.isAndroid()) {
      logger.debug('Skipping keep-awake because the current platform is not Android');
      return;
    }
    if (this.isActive) {
      logger.debug('Skipping keep-awake because it is already active');
      return;
    }
    if (!(await this.ensureSupported())) {
      logger.warn('Skipping keep-awake because the feature is not supported');
      return;
    }

    try {
      await KeepAwake.keepAwake();
      this.isActive = true;
      logger.info('Keep-awake enabled');
    } catch (error) {
      logger.error('Failed to enable keep-awake', error);
      throw error;
    }
  }

  public async allowSleep(): Promise<void> {
    if (!this.isAndroid()) {
      logger.debug('Skipping allowSleep because the current platform is not Android');
      return;
    }
    if (!this.isActive) {
      logger.debug('Skipping allowSleep because keep-awake is not active');
      return;
    }
    if (!(await this.ensureSupported())) {
      this.isActive = false;
      logger.warn('Resetting keep-awake state because the feature is not supported');
      return;
    }

    try {
      await KeepAwake.allowSleep();
      this.isActive = false;
      logger.info('Keep-awake disabled');
    } catch (error) {
      logger.error('Failed to disable keep-awake', error);
      throw error;
    }
  }

  public resetForTest(): void {
    this.isActive = false;
    this.isSupported = null;
  }
}

export const keepAwakeService = KeepAwakeService.getInstance();
