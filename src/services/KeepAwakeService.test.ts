import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { keepAwakeService } from './KeepAwakeService';

const platformMocks = vi.hoisted(() => ({
  getPlatform: vi.fn(() => 'web'),
}));

const keepAwakeMocks = vi.hoisted(() => ({
  allowSleep: vi.fn().mockResolvedValue(undefined),
  isSupported: vi.fn().mockResolvedValue({ isSupported: true }),
  keepAwake: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: platformMocks.getPlatform,
  },
}));

vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: keepAwakeMocks,
}));

describe('KeepAwakeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformMocks.getPlatform.mockReturnValue('web');
    keepAwakeService.resetForTest();
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('uses the Screen Wake Lock API on web when keeping the display awake', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    });

    await keepAwakeService.keepAwake();

    expect(request).toHaveBeenCalledWith('screen');
    expect(vi.mocked(KeepAwake.keepAwake)).not.toHaveBeenCalled();
    expect(vi.mocked(Capacitor.getPlatform)).toHaveBeenCalled();
  });

  it('releases the web wake lock when allowing sleep again', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: vi.fn().mockResolvedValue({ release }),
      },
    });

    await keepAwakeService.keepAwake();
    await keepAwakeService.allowSleep();

    expect(release).toHaveBeenCalledTimes(1);
    expect(vi.mocked(KeepAwake.allowSleep)).not.toHaveBeenCalled();
  });

  it('keeps using the native Capacitor plugin on Android', async () => {
    platformMocks.getPlatform.mockReturnValue('android');

    await keepAwakeService.keepAwake();

    expect(vi.mocked(KeepAwake.isSupported)).toHaveBeenCalled();
    expect(vi.mocked(KeepAwake.keepAwake)).toHaveBeenCalled();
  });
});
