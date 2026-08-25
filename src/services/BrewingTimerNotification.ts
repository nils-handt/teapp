import { Capacitor, registerPlugin } from '@capacitor/core';
import { BrewingPhase } from './interfaces/brewing.types';
import { createLogger } from './logging';

const logger = createLogger('BrewingTimerNotification');

export type BrewingTimerNotificationSnapshot = {
  sessionId: string;
  phase: 'infusion' | 'pouring' | 'rest';
  infusionNumber: number;
  elapsedMs: number;
  running: boolean;
};

export type BrewingTimerNotificationSupport =
  | 'promoted-live-update'
  | 'standard-notification'
  | 'permission-required'
  | 'disabled'
  | 'unsupported-platform';

export type BrewingTimerDiagnosticRecord = {
  timestamp: string;
  event: string;
  details: Record<string, unknown>;
};

export interface BrewingTimerNotification {
  getSupport(): Promise<BrewingTimerNotificationSupport>;
  requestPermission(): Promise<BrewingTimerNotificationSupport>;
  show(snapshot: BrewingTimerNotificationSnapshot): Promise<void>;
  cancel(): Promise<void>;
  flushDiagnostics(): Promise<void>;
}

type NativeBrewingTimerNotification = {
  getSupport(): Promise<{ support: BrewingTimerNotificationSupport }>;
  requestPermission(): Promise<{ support: BrewingTimerNotificationSupport }>;
  show(snapshot: BrewingTimerNotificationSnapshot): Promise<void>;
  cancel(): Promise<void>;
  drainDiagnostics(): Promise<{ records: BrewingTimerDiagnosticRecord[] }>;
};

const nativeBrewingTimerNotification = registerPlugin<NativeBrewingTimerNotification>(
  'BrewingTimerNotification',
);

const isAndroid = (): boolean => Capacitor.getPlatform() === 'android';

const flushNativeDiagnostics = async (): Promise<void> => {
  const { records } = await nativeBrewingTimerNotification.drainDiagnostics();
  for (const record of records) {
    logger.debug('Android brewing timer diagnostic', record);
  }
};

export const brewingTimerNotification: BrewingTimerNotification = {
  async getSupport() {
    if (!isAndroid()) return 'unsupported-platform';

    try {
      const support = (await nativeBrewingTimerNotification.getSupport()).support;
      await flushNativeDiagnostics();
      return support;
    } catch (error) {
      logger.error('Failed to determine brewing timer notification support', error);
      return 'disabled';
    }
  },

  async requestPermission() {
    if (!isAndroid()) return 'unsupported-platform';

    try {
      const support = (await nativeBrewingTimerNotification.requestPermission()).support;
      await flushNativeDiagnostics();
      return support;
    } catch (error) {
      logger.error('Failed to request brewing timer notification permission', error);
      return 'disabled';
    }
  },

  async show(snapshot) {
    if (!isAndroid()) return;

    try {
      await nativeBrewingTimerNotification.show(snapshot);
      await flushNativeDiagnostics();
    } catch (error) {
      logger.error('Failed to show brewing timer notification', error);
    }
  },

  async cancel() {
    if (!isAndroid()) return;

    try {
      await nativeBrewingTimerNotification.cancel();
      await flushNativeDiagnostics();
    } catch (error) {
      logger.error('Failed to cancel brewing timer notification', error);
    }
  },

  async flushDiagnostics() {
    if (!isAndroid()) return;

    try {
      await flushNativeDiagnostics();
    } catch (error) {
      logger.error('Failed to flush brewing timer notification diagnostics', error);
    }
  },
};

type BrewingTimerNotificationState = {
  activeSession: { sessionId: string } | null;
  currentInfusion: { infusionNumber: number } | null;
  brewingPhase: BrewingPhase;
  timerValue: number;
};

export const selectBrewingTimerNotificationSnapshot = (
  state: BrewingTimerNotificationState,
): BrewingTimerNotificationSnapshot | null => {
  if (!state.activeSession || !state.currentInfusion) {
    return null;
  }

  const phase = state.brewingPhase === BrewingPhase.INFUSION
    ? 'infusion'
    : state.brewingPhase === BrewingPhase.REST
      ? 'rest'
      : state.brewingPhase === BrewingPhase.INFUSION_VESSEL_LIFTED
        ? 'pouring'
      : null;

  if (!phase) return null;

  return {
    sessionId: state.activeSession.sessionId,
    phase,
    infusionNumber: state.currentInfusion.infusionNumber,
    elapsedMs: Math.max(0, state.timerValue),
    running: phase !== 'pouring',
  };
};
