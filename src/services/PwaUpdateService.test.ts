import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPwaUpdateController } from './PwaUpdateService';

describe('PwaUpdateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies an available update immediately when no brewing session is active', async () => {
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    const controller = createPwaUpdateController();
    controller.notifyUpdateAvailable(updateServiceWorker);

    await controller.applyUpdate({ hasActiveBrewingSession: false });

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    expect(controller.getSnapshot().status).toBe('updating');
  });

  it('defers update activation while a brewing session is active', async () => {
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    const controller = createPwaUpdateController();
    controller.notifyUpdateAvailable(updateServiceWorker);

    const applied = await controller.applyUpdate({ hasActiveBrewingSession: true });

    expect(applied).toBe(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();
    expect(controller.getSnapshot().status).toBe('update-deferred');
  });

  it('announces offline readiness without requiring a reload', () => {
    const controller = createPwaUpdateController();

    controller.notifyOfflineReady();

    expect(controller.getSnapshot()).toMatchObject({
      hasOfflineReadyMessage: true,
      status: 'offline-ready',
    });
  });

  it('keeps the offline-ready prompt pending when an update is discovered immediately afterward', () => {
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    const controller = createPwaUpdateController();

    controller.notifyOfflineReady();
    controller.notifyUpdateAvailable(updateServiceWorker);

    expect(controller.getSnapshot()).toMatchObject({
      hasOfflineReadyMessage: true,
      hasUpdateAvailable: true,
      status: 'offline-ready',
    });
  });
});
