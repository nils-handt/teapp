export type PwaUpdateStatus =
  | 'idle'
  | 'offline-ready'
  | 'update-available'
  | 'update-deferred'
  | 'updating'
  | 'error';

export type PwaUpdateSnapshot = {
  hasOfflineReadyMessage: boolean;
  hasUpdateAvailable: boolean;
  status: PwaUpdateStatus;
};

type Listener = () => void;
type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

class PwaUpdateController {
  private listeners = new Set<Listener>();
  private updateServiceWorker: UpdateServiceWorker | null = null;
  private snapshot: PwaUpdateSnapshot = {
    hasOfflineReadyMessage: false,
    hasUpdateAvailable: false,
    status: 'idle',
  };

  public getSnapshot = (): PwaUpdateSnapshot => this.snapshot;

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public notifyOfflineReady(): void {
    this.setSnapshot({
      hasOfflineReadyMessage: true,
      hasUpdateAvailable: this.snapshot.hasUpdateAvailable,
      status: 'offline-ready',
    });
  }

  public notifyUpdateAvailable(updateServiceWorker: UpdateServiceWorker): void {
    this.updateServiceWorker = updateServiceWorker;
    const hasOfflineReadyMessage = this.snapshot.hasOfflineReadyMessage;
    this.setSnapshot({
      hasOfflineReadyMessage,
      hasUpdateAvailable: true,
      status: hasOfflineReadyMessage ? 'offline-ready' : 'update-available',
    });
  }

  public dismissOfflineReady(): void {
    this.setSnapshot({
      ...this.snapshot,
      hasOfflineReadyMessage: false,
      status: this.snapshot.hasUpdateAvailable ? 'update-available' : 'idle',
    });
  }

  public dismissUpdate(): void {
    this.setSnapshot({
      ...this.snapshot,
      hasUpdateAvailable: false,
      status: this.snapshot.hasOfflineReadyMessage ? 'offline-ready' : 'idle',
    });
  }

  public async applyUpdate(options: { hasActiveBrewingSession: boolean }): Promise<boolean> {
    if (!this.updateServiceWorker) {
      return false;
    }

    if (options.hasActiveBrewingSession) {
      this.setSnapshot({
        ...this.snapshot,
        hasUpdateAvailable: true,
        status: 'update-deferred',
      });
      return false;
    }

    this.setSnapshot({
      ...this.snapshot,
      hasUpdateAvailable: false,
      status: 'updating',
    });

    try {
      await this.updateServiceWorker(true);
      return true;
    } catch {
      this.setSnapshot({
        ...this.snapshot,
        hasUpdateAvailable: true,
        status: 'error',
      });
      return false;
    }
  }

  private setSnapshot(snapshot: PwaUpdateSnapshot): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}

export const createPwaUpdateController = (): PwaUpdateController => new PwaUpdateController();

export const pwaUpdateController = createPwaUpdateController();
