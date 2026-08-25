import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import {
  brewingTimerNotification,
  selectBrewingTimerNotificationSnapshot,
  type BrewingTimerNotification,
  type BrewingTimerNotificationSnapshot,
} from '../services/BrewingTimerNotification';
import { brewingStore } from '../stores/useBrewingStore';

const semanticKey = (snapshot: BrewingTimerNotificationSnapshot): string => [
  snapshot.sessionId,
  snapshot.phase,
  snapshot.infusionNumber,
  snapshot.running,
].join(':');

class BrewingTimerNotificationController {
  private appActive = true;
  private enabled = false;
  private snapshot: BrewingTimerNotificationSnapshot | null = null;
  private observedKey: string | null = null;
  private observedElapsedMs: number | null = null;
  private presentedKey: string | null = null;
  private operations: Promise<void> = Promise.resolve();

  constructor(private readonly notification: BrewingTimerNotification) {}

  public reconcileStartup(): Promise<void> {
    this.presentedKey = null;
    return this.enqueue(async () => {
      await this.notification.cancel();
      await this.notification.flushDiagnostics();
    });
  }

  public update(
    enabled: boolean,
    snapshot: BrewingTimerNotificationSnapshot | null,
  ): Promise<void> {
    const nextObservedKey = snapshot ? semanticKey(snapshot) : null;
    const timerAnchorReset = snapshot !== null
      && this.observedKey === nextObservedKey
      && this.observedElapsedMs !== null
      && snapshot.elapsedMs < this.observedElapsedMs;

    this.enabled = enabled;
    this.snapshot = snapshot;
    this.observedKey = nextObservedKey;
    this.observedElapsedMs = snapshot?.elapsedMs ?? null;
    return this.reconcileBackground(timerAnchorReset);
  }

  public setAppActive(appActive: boolean): Promise<void> {
    if (this.appActive === appActive) return this.operations;

    this.appActive = appActive;
    if (appActive) {
      this.presentedKey = null;
      return this.enqueue(async () => {
        await this.notification.cancel();
        await this.notification.flushDiagnostics();
      });
    }

    return this.reconcileBackground();
  }

  private reconcileBackground(forceShow = false): Promise<void> {
    if (this.appActive) return this.operations;

    if (!this.enabled || !this.snapshot) {
      if (this.presentedKey === null) return this.operations;
      this.presentedKey = null;
      return this.enqueue(() => this.notification.cancel());
    }

    const nextKey = semanticKey(this.snapshot);
    if (this.presentedKey === nextKey && !forceShow) return this.operations;

    this.presentedKey = nextKey;
    const snapshot = this.snapshot;
    return this.enqueue(() => this.notification.show(snapshot));
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.operations.then(operation, operation);
    this.operations = next.catch(() => undefined);
    return this.operations;
  }
}

export const createBrewingTimerNotificationController = (
  notification: BrewingTimerNotification,
): BrewingTimerNotificationController => new BrewingTimerNotificationController(notification);

export const useBrewingTimerNotification = (enabled: boolean): void => {
  const controllerRef = useRef<BrewingTimerNotificationController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createBrewingTimerNotificationController(brewingTimerNotification);
  }
  const controller = controllerRef.current;

  useEffect(() => {
    const updateFromStore = () => {
      void controller.update(
        enabled,
        selectBrewingTimerNotificationSnapshot(brewingStore.getState()),
      );
    };

    updateFromStore();
    return brewingStore.subscribe(updateFromStore);
  }, [controller, enabled]);

  useEffect(() => {
    let disposed = false;
    let observedStateChange = false;
    let listenerHandle: PluginListenerHandle | null = null;

    void controller.reconcileStartup();
    void App.addListener('appStateChange', ({ isActive }) => {
      observedStateChange = true;
      void controller.setAppActive(isActive);
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
        return;
      }
      listenerHandle = handle;
    }).catch(() => undefined);

    void App.getState().then(({ isActive }) => {
      if (!disposed && !observedStateChange) {
        void controller.setAppActive(isActive);
      }
    }).catch(() => undefined);

    return () => {
      disposed = true;
      void listenerHandle?.remove();
      void controller.setAppActive(true);
    };
  }, [controller]);
};
