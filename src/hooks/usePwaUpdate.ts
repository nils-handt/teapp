import { useSyncExternalStore } from 'react';
import {
  pwaUpdateController,
  type PwaUpdateSnapshot,
} from '../services/PwaUpdateService';

export const usePwaUpdate = (): PwaUpdateSnapshot & {
  applyUpdate: (options: { hasActiveBrewingSession: boolean }) => Promise<boolean>;
  dismissOfflineReady: () => void;
  dismissUpdate: () => void;
} => {
  const snapshot = useSyncExternalStore(
    pwaUpdateController.subscribe,
    pwaUpdateController.getSnapshot,
    pwaUpdateController.getSnapshot,
  );

  return {
    ...snapshot,
    applyUpdate: pwaUpdateController.applyUpdate.bind(pwaUpdateController),
    dismissOfflineReady: pwaUpdateController.dismissOfflineReady.bind(pwaUpdateController),
    dismissUpdate: pwaUpdateController.dismissUpdate.bind(pwaUpdateController),
  };
};
