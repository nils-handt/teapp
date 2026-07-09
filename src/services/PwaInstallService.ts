export type PwaInstallStatus =
  | 'unsupported'
  | 'available'
  | 'installing'
  | 'installed'
  | 'dismissed';

export type BeforeInstallPromptChoice = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

export type BeforeInstallPromptEventLike = Pick<Event, 'preventDefault'> & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
};

export type PwaInstallSnapshot = {
  canPrompt: boolean;
  status: PwaInstallStatus;
};

type Listener = () => void;

type PwaInstallControllerOptions = {
  isStandalone?: () => boolean;
};

class PwaInstallController {
  private deferredPrompt: BeforeInstallPromptEventLike | null = null;
  private listeners = new Set<Listener>();
  private snapshot: PwaInstallSnapshot;

  constructor(private readonly options: PwaInstallControllerOptions = {}) {
    this.snapshot = this.options.isStandalone?.()
      ? { canPrompt: false, status: 'installed' }
      : { canPrompt: false, status: 'unsupported' };
  }

  public getSnapshot = (): PwaInstallSnapshot => this.snapshot;

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public captureInstallPrompt = (event: BeforeInstallPromptEventLike): void => {
    if (this.snapshot.status === 'installed') return;

    event.preventDefault();
    this.deferredPrompt = event;
    this.setSnapshot({ canPrompt: true, status: 'available' });
  };

  public markInstalled = (): void => {
    this.deferredPrompt = null;
    this.setSnapshot({ canPrompt: false, status: 'installed' });
  };

  public async promptInstall(): Promise<boolean> {
    const promptEvent = this.deferredPrompt;
    if (!promptEvent) {
      return false;
    }

    this.setSnapshot({ canPrompt: false, status: 'installing' });
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    this.deferredPrompt = null;

    if (choice.outcome === 'accepted') {
      this.setSnapshot({ canPrompt: false, status: 'installed' });
      return true;
    }

    this.setSnapshot({ canPrompt: false, status: 'dismissed' });
    return false;
  }

  private setSnapshot(snapshot: PwaInstallSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}

const isStandaloneDisplay = (): boolean => {
  if (typeof window === 'undefined') return false;

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || navigatorWithStandalone.standalone === true;
};

export const createPwaInstallController = (
  options: PwaInstallControllerOptions = {},
): PwaInstallController => new PwaInstallController(options);

export const pwaInstallController = createPwaInstallController({
  isStandalone: isStandaloneDisplay,
});

export const initializePwaInstallController = (): void => {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (event) => {
    pwaInstallController.captureInstallPrompt(event as unknown as BeforeInstallPromptEventLike);
  });
  window.addEventListener('appinstalled', () => {
    pwaInstallController.markInstalled();
  });
};
