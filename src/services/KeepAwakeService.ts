import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { createLogger } from './logging';

const logger = createLogger('KeepAwakeService');

type WakeLockSentinelLike = EventTarget & {
  addEventListener?: EventTarget['addEventListener'];
  release: () => Promise<void>;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

class KeepAwakeService {
  private static instance: KeepAwakeService;
  private isActive = false;
  private isSupported: boolean | null = null;
  private webWakeLockDesired = false;
  private webWakeLock: WakeLockSentinelLike | null = null;
  private webVisibilityChangeHandler: (() => void) | null = null;

  public static getInstance(): KeepAwakeService {
    if (!KeepAwakeService.instance) {
      KeepAwakeService.instance = new KeepAwakeService();
    }
    return KeepAwakeService.instance;
  }

  private isAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  private isWeb(): boolean {
    return Capacitor.getPlatform() === 'web';
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

  private ensureWebVisibilityListener(): void {
    if (this.webVisibilityChangeHandler || typeof document === 'undefined') return;

    this.webVisibilityChangeHandler = () => {
      if (document.visibilityState === 'visible' && this.webWakeLockDesired && !this.webWakeLock) {
        void this.requestWebWakeLock();
      }
    };

    document.addEventListener('visibilitychange', this.webVisibilityChangeHandler);
  }

  private removeWebVisibilityListener(): void {
    if (!this.webVisibilityChangeHandler || typeof document === 'undefined') return;

    document.removeEventListener('visibilitychange', this.webVisibilityChangeHandler);
    this.webVisibilityChangeHandler = null;
  }

  private async requestWebWakeLock(): Promise<void> {
    if (this.webWakeLock) {
      logger.debug('Skipping web wake lock request because it is already active');
      return;
    }

    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      logger.warn('Skipping web wake lock because the Screen Wake Lock API is not supported');
      return;
    }

    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      logger.debug('Deferring web wake lock request until the document is visible');
      return;
    }

    try {
      const wakeLock = await (navigator as NavigatorWithWakeLock).wakeLock?.request('screen');
      if (!wakeLock) return;

      this.webWakeLock = wakeLock;
      this.isActive = true;
      wakeLock.addEventListener?.('release', () => {
        if (this.webWakeLock === wakeLock) {
          this.webWakeLock = null;
          this.isActive = false;
          logger.info('Web wake lock released');
        }
      });
      logger.info('Web wake lock enabled');
    } catch (error) {
      this.webWakeLock = null;
      this.isActive = false;
      logger.error('Failed to enable web wake lock', error);
    }
  }

  public async keepAwake(): Promise<void> {
    if (this.isWeb()) {
      this.webWakeLockDesired = true;
      this.ensureWebVisibilityListener();
      await this.requestWebWakeLock();
      return;
    }

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
    if (this.isWeb()) {
      this.webWakeLockDesired = false;
      this.removeWebVisibilityListener();

      const wakeLock = this.webWakeLock;
      this.webWakeLock = null;
      this.isActive = false;

      if (!wakeLock) {
        logger.debug('Skipping web wake lock release because it is not active');
        return;
      }

      try {
        await wakeLock.release();
        logger.info('Web wake lock disabled');
      } catch (error) {
        logger.error('Failed to disable web wake lock', error);
        throw error;
      }
      return;
    }

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
    this.webWakeLockDesired = false;
    this.webWakeLock = null;
    this.removeWebVisibilityListener();
  }
}

export const keepAwakeService = KeepAwakeService.getInstance();
