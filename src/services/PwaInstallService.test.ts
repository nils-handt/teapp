import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPwaInstallController, type BeforeInstallPromptEventLike } from './PwaInstallService';

const createInstallPromptEvent = (outcome: 'accepted' | 'dismissed'): BeforeInstallPromptEventLike => ({
  preventDefault: vi.fn(),
  prompt: vi.fn().mockResolvedValue(undefined),
  userChoice: Promise.resolve({ outcome, platform: 'web' }),
});

describe('PwaInstallService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('becomes available when the browser exposes an install prompt', () => {
    const controller = createPwaInstallController();
    const event = createInstallPromptEvent('accepted');

    controller.captureInstallPrompt(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      canPrompt: true,
      status: 'available',
    });
  });

  it('records a dismissed install prompt so the UI can show browser-menu fallback copy', async () => {
    const controller = createPwaInstallController();
    const event = createInstallPromptEvent('dismissed');
    controller.captureInstallPrompt(event);

    await controller.promptInstall();

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      canPrompt: false,
      status: 'dismissed',
    });
  });

  it('treats standalone display mode as already installed', () => {
    const controller = createPwaInstallController({
      isStandalone: () => true,
    });

    expect(controller.getSnapshot()).toMatchObject({
      canPrompt: false,
      status: 'installed',
    });
  });
});
