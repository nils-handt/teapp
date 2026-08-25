import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrewingSession } from '../entities/BrewingSession.entity';
import type { Infusion } from '../entities/Infusion.entity';
import type {
  BrewingTimerNotification,
  BrewingTimerNotificationSnapshot,
} from '../services/BrewingTimerNotification';
import { BrewingPhase } from '../services/interfaces/brewing.types';
import { brewingStore, initialBrewingStoreState } from '../stores/useBrewingStore';
import {
  createBrewingTimerNotificationController,
  useBrewingTimerNotification,
} from './useBrewingTimerNotification';

const appMocks = vi.hoisted(() => ({
  listener: null as ((state: { isActive: boolean }) => void) | null,
  remove: vi.fn().mockResolvedValue(undefined),
  getState: vi.fn().mockResolvedValue({ isActive: true }),
  addListener: vi.fn((_eventName: string, listener: (state: { isActive: boolean }) => void) => {
    appMocks.listener = listener;
    return Promise.resolve({ remove: appMocks.remove });
  }),
}));

const singletonNotificationMocks = vi.hoisted(() => ({
  getSupport: vi.fn().mockResolvedValue('standard-notification'),
  requestPermission: vi.fn().mockResolvedValue('standard-notification'),
  show: vi.fn().mockResolvedValue(undefined),
  cancel: vi.fn().mockResolvedValue(undefined),
  flushDiagnostics: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: appMocks.addListener,
    getState: appMocks.getState,
  },
}));

vi.mock('../services/BrewingTimerNotification', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/BrewingTimerNotification')>(),
  brewingTimerNotification: singletonNotificationMocks,
}));

const infusionSnapshot: BrewingTimerNotificationSnapshot = {
  sessionId: 'session-1',
  phase: 'infusion',
  infusionNumber: 2,
  elapsedMs: 3_500,
  running: true,
};

const createNotification = (): BrewingTimerNotification => ({
  getSupport: vi.fn().mockResolvedValue('standard-notification'),
  requestPermission: vi.fn().mockResolvedValue('standard-notification'),
  show: vi.fn().mockResolvedValue(undefined),
  cancel: vi.fn().mockResolvedValue(undefined),
  flushDiagnostics: vi.fn().mockResolvedValue(undefined),
});

afterEach(() => {
  brewingStore.setState(initialBrewingStoreState);
  appMocks.listener = null;
  vi.clearAllMocks();
});

describe('createBrewingTimerNotificationController', () => {
  it('cancels a potentially stale notification during startup reconciliation', async () => {
    const notification = createNotification();
    const controller = createBrewingTimerNotificationController(notification);

    await controller.reconcileStartup();

    expect(notification.cancel).toHaveBeenCalledTimes(1);
  });

  it('shows the current timer in the background and cancels it in the foreground', async () => {
    const notification = createNotification();
    const controller = createBrewingTimerNotificationController(notification);

    await controller.update(true, infusionSnapshot);
    expect(notification.show).not.toHaveBeenCalled();

    await controller.setAppActive(false);
    expect(notification.show).toHaveBeenCalledWith(infusionSnapshot);

    await controller.setAppActive(true);
    expect(notification.cancel).toHaveBeenCalledTimes(1);
  });

  it('does not repost for ordinary elapsed-time ticks', async () => {
    const notification = createNotification();
    const controller = createBrewingTimerNotificationController(notification);

    await controller.update(true, infusionSnapshot);
    await controller.setAppActive(false);
    await controller.update(true, { ...infusionSnapshot, elapsedMs: 3_600 });
    await controller.update(true, { ...infusionSnapshot, elapsedMs: 3_700 });

    expect(notification.show).toHaveBeenCalledTimes(1);
    expect(notification.show).toHaveBeenCalledWith(infusionSnapshot);
  });

  it('reposts when elapsed time decreases within the same phase', async () => {
    const notification = createNotification();
    const controller = createBrewingTimerNotificationController(notification);

    await controller.update(true, infusionSnapshot);
    await controller.setAppActive(false);
    await controller.update(true, { ...infusionSnapshot, elapsedMs: 3_700 });
    await controller.update(true, { ...infusionSnapshot, elapsedMs: 200 });

    expect(notification.show).toHaveBeenCalledTimes(2);
    expect(notification.show).toHaveBeenLastCalledWith({
      ...infusionSnapshot,
      elapsedMs: 200,
    });
  });

  it.each([
    ['session', { sessionId: 'session-2' }],
    ['phase', { phase: 'rest' as const }],
    ['infusion', { infusionNumber: 3 }],
    ['running state', { running: false }],
  ])('reposts when the semantic %s changes', async (_label, change) => {
    const notification = createNotification();
    const controller = createBrewingTimerNotificationController(notification);

    await controller.update(true, infusionSnapshot);
    await controller.setAppActive(false);
    await controller.update(true, { ...infusionSnapshot, ...change, elapsedMs: 4_000 });

    expect(notification.show).toHaveBeenCalledTimes(2);
    expect(notification.show).toHaveBeenLastCalledWith({
      ...infusionSnapshot,
      ...change,
      elapsedMs: 4_000,
    });
  });

  it.each([
    ['the session ends', true, null],
    ['the preference is disabled', false, infusionSnapshot],
  ])('cancels the background timer when %s', async (_label, enabled, snapshot) => {
    const notification = createNotification();
    const controller = createBrewingTimerNotificationController(notification);

    await controller.update(true, infusionSnapshot);
    await controller.setAppActive(false);
    await controller.update(enabled, snapshot);

    expect(notification.cancel).toHaveBeenCalledTimes(1);
  });

  it('serializes a slow background show before the newer foreground cancel', async () => {
    let resolveShow: () => void = () => {};
    let markShowStarted: () => void = () => {};
    const showStarted = new Promise<void>((resolve) => {
      markShowStarted = resolve;
    });
    const notification = createNotification();
    vi.mocked(notification.show).mockImplementation(() => new Promise<void>((resolve) => {
      resolveShow = resolve;
      markShowStarted();
    }));
    const controller = createBrewingTimerNotificationController(notification);

    await controller.update(true, infusionSnapshot);
    const backgroundUpdate = controller.setAppActive(false);
    await showStarted;
    const foregroundUpdate = controller.setAppActive(true);

    expect(notification.cancel).not.toHaveBeenCalled();
    resolveShow();
    await Promise.all([backgroundUpdate, foregroundUpdate]);

    expect(notification.cancel).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notification.show).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(notification.cancel).mock.invocationCallOrder[0]);
  });
});

const HookHarness = ({ enabled }: { enabled: boolean }) => {
  useBrewingTimerNotification(enabled);
  return null;
};

describe('useBrewingTimerNotification', () => {
  it('does not rerender the application root for ordinary timer ticks', async () => {
    const renderSpy = vi.fn();
    const RenderCountingHarness = ({ enabled }: { enabled: boolean }) => {
      renderSpy();
      useBrewingTimerNotification(enabled);
      return null;
    };

    brewingStore.setState({
      activeSession: { sessionId: 'session-render-count' } as BrewingSession,
      currentInfusion: { infusionNumber: 1 } as Infusion,
      brewingPhase: BrewingPhase.INFUSION,
      timerValue: 0,
    });

    render(<RenderCountingHarness enabled />);
    await waitFor(() => expect(appMocks.addListener).toHaveBeenCalled());

    act(() => {
      brewingStore.setState({ timerValue: 100 });
      brewingStore.setState({ timerValue: 200 });
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('projects application brewing state when Capacitor reports the app in the background', async () => {
    brewingStore.setState({
      activeSession: { sessionId: 'session-hook' } as BrewingSession,
      currentInfusion: { infusionNumber: 6 } as Infusion,
      brewingPhase: BrewingPhase.REST,
      timerValue: 9_500,
    });

    render(<HookHarness enabled />);
    await waitFor(() => expect(appMocks.addListener).toHaveBeenCalledWith(
      'appStateChange',
      expect.any(Function),
    ));
    await act(async () => {
      appMocks.listener?.({ isActive: false });
    });

    expect(singletonNotificationMocks.show).toHaveBeenCalledWith({
      sessionId: 'session-hook',
      phase: 'rest',
      infusionNumber: 6,
      elapsedMs: 9_500,
      running: true,
    });
  });
});
