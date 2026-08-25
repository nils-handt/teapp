import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrewingPhase } from './interfaces/brewing.types';
import {
  brewingTimerNotification,
  selectBrewingTimerNotificationSnapshot,
} from './BrewingTimerNotification';

const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
}));

const capacitorMocks = vi.hoisted(() => ({
  getPlatform: vi.fn(() => 'web'),
  plugin: {
    getSupport: vi.fn().mockResolvedValue({ support: 'promoted-live-update' }),
    requestPermission: vi.fn().mockResolvedValue({ support: 'standard-notification' }),
    show: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    drainDiagnostics: vi.fn().mockResolvedValue({
      records: [{
        timestamp: '2026-08-25T12:00:00.000Z',
        event: 'notification-posted',
        details: { hasPromotableCharacteristics: true, promoted: false },
      }],
    }),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: capacitorMocks.getPlatform },
  registerPlugin: () => capacitorMocks.plugin,
}));

vi.mock('./logging', () => ({
  createLogger: () => loggerMocks,
}));

beforeEach(() => {
  vi.clearAllMocks();
  capacitorMocks.getPlatform.mockReturnValue('web');
});

describe('selectBrewingTimerNotificationSnapshot', () => {
  it('projects an active infusion into a running notification timer', () => {
    expect(selectBrewingTimerNotificationSnapshot({
      activeSession: { sessionId: 'session-1' },
      currentInfusion: { infusionNumber: 3 },
      brewingPhase: BrewingPhase.INFUSION,
      timerValue: 12_345,
    })).toEqual({
      sessionId: 'session-1',
      phase: 'infusion',
      infusionNumber: 3,
      elapsedMs: 12_345,
      running: true,
    });
  });

  it('projects a rest between infusions into a running rest timer', () => {
    expect(selectBrewingTimerNotificationSnapshot({
      activeSession: { sessionId: 'session-1' },
      currentInfusion: { infusionNumber: 2 },
      brewingPhase: BrewingPhase.REST,
      timerValue: 4_500,
    })).toEqual({
      sessionId: 'session-1',
      phase: 'rest',
      infusionNumber: 2,
      elapsedMs: 4_500,
      running: true,
    });
  });

  it('projects a lifted vessel into a paused pouring timer', () => {
    expect(selectBrewingTimerNotificationSnapshot({
      activeSession: { sessionId: 'session-1' },
      currentInfusion: { infusionNumber: 4 },
      brewingPhase: BrewingPhase.INFUSION_VESSEL_LIFTED,
      timerValue: 8_000,
    })).toEqual({
      sessionId: 'session-1',
      phase: 'pouring',
      infusionNumber: 4,
      elapsedMs: 8_000,
      running: false,
    });
  });

  it.each([
    BrewingPhase.IDLE,
    BrewingPhase.SETUP,
    BrewingPhase.READY,
    BrewingPhase.ENDED,
  ])('does not project the %s phase', (brewingPhase) => {
    expect(selectBrewingTimerNotificationSnapshot({
      activeSession: { sessionId: 'session-1' },
      currentInfusion: { infusionNumber: 1 },
      brewingPhase,
      timerValue: 1_000,
    })).toBeNull();
  });

  it('requires both an active session and a current infusion', () => {
    expect(selectBrewingTimerNotificationSnapshot({
      activeSession: null,
      currentInfusion: { infusionNumber: 1 },
      brewingPhase: BrewingPhase.INFUSION,
      timerValue: 1_000,
    })).toBeNull();
    expect(selectBrewingTimerNotificationSnapshot({
      activeSession: { sessionId: 'session-1' },
      currentInfusion: null,
      brewingPhase: BrewingPhase.INFUSION,
      timerValue: 1_000,
    })).toBeNull();
  });

  it('clamps an invalid negative elapsed time to zero', () => {
    expect(selectBrewingTimerNotificationSnapshot({
      activeSession: { sessionId: 'session-1' },
      currentInfusion: { infusionNumber: 1 },
      brewingPhase: BrewingPhase.INFUSION,
      timerValue: -250,
    })?.elapsedMs).toBe(0);
  });
});

describe('brewingTimerNotification', () => {
  it.each(['web', 'ios'])('is an unsupported no-op on %s', async (platform) => {
    capacitorMocks.getPlatform.mockReturnValue(platform);
    const snapshot = {
      sessionId: 'session-1',
      phase: 'infusion' as const,
      infusionNumber: 1,
      elapsedMs: 2_000,
      running: true,
    };

    await expect(brewingTimerNotification.getSupport()).resolves.toBe('unsupported-platform');
    await expect(brewingTimerNotification.requestPermission()).resolves.toBe('unsupported-platform');
    await expect(brewingTimerNotification.show(snapshot)).resolves.toBeUndefined();
    await expect(brewingTimerNotification.cancel()).resolves.toBeUndefined();
    await expect(brewingTimerNotification.flushDiagnostics()).resolves.toBeUndefined();
    expect(capacitorMocks.plugin.getSupport).not.toHaveBeenCalled();
    expect(capacitorMocks.plugin.requestPermission).not.toHaveBeenCalled();
    expect(capacitorMocks.plugin.show).not.toHaveBeenCalled();
    expect(capacitorMocks.plugin.cancel).not.toHaveBeenCalled();
    expect(capacitorMocks.plugin.drainDiagnostics).not.toHaveBeenCalled();
  });

  it('delegates notification operations to the Android bridge', async () => {
    capacitorMocks.getPlatform.mockReturnValue('android');
    const snapshot = {
      sessionId: 'session-2',
      phase: 'rest' as const,
      infusionNumber: 5,
      elapsedMs: 6_500,
      running: true,
    };

    await expect(brewingTimerNotification.getSupport()).resolves.toBe('promoted-live-update');
    await expect(brewingTimerNotification.requestPermission()).resolves.toBe('standard-notification');
    await brewingTimerNotification.show(snapshot);
    await brewingTimerNotification.cancel();

    expect(capacitorMocks.plugin.show).toHaveBeenCalledWith(snapshot);
    expect(capacitorMocks.plugin.cancel).toHaveBeenCalledTimes(1);
  });

  it('drains native Android diagnostics through the existing application logger', async () => {
    capacitorMocks.getPlatform.mockReturnValue('android');

    await brewingTimerNotification.flushDiagnostics();

    expect(capacitorMocks.plugin.drainDiagnostics).toHaveBeenCalledTimes(1);
    expect(loggerMocks.debug).toHaveBeenCalledWith(
      'Android brewing timer diagnostic',
      {
        timestamp: '2026-08-25T12:00:00.000Z',
        event: 'notification-posted',
        details: { hasPromotableCharacteristics: true, promoted: false },
      },
    );
  });

  it('contains Android bridge failures so brewing can continue', async () => {
    capacitorMocks.getPlatform.mockReturnValue('android');
    capacitorMocks.plugin.getSupport.mockRejectedValueOnce(new Error('bridge unavailable'));
    capacitorMocks.plugin.requestPermission.mockRejectedValueOnce(new Error('permission failure'));
    capacitorMocks.plugin.show.mockRejectedValueOnce(new Error('show failure'));
    capacitorMocks.plugin.cancel.mockRejectedValueOnce(new Error('cancel failure'));
    capacitorMocks.plugin.drainDiagnostics.mockRejectedValueOnce(new Error('diagnostics failure'));

    await expect(brewingTimerNotification.getSupport()).resolves.toBe('disabled');
    await expect(brewingTimerNotification.requestPermission()).resolves.toBe('disabled');
    await expect(brewingTimerNotification.show({
      sessionId: 'session-1',
      phase: 'infusion',
      infusionNumber: 1,
      elapsedMs: 0,
      running: true,
    })).resolves.toBeUndefined();
    await expect(brewingTimerNotification.cancel()).resolves.toBeUndefined();
    await expect(brewingTimerNotification.flushDiagnostics()).resolves.toBeUndefined();
  });
});
