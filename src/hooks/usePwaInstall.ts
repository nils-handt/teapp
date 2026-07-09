import { useSyncExternalStore } from 'react';
import {
  pwaInstallController,
  type PwaInstallSnapshot,
} from '../services/PwaInstallService';

export const usePwaInstall = (): PwaInstallSnapshot & {
  promptInstall: () => Promise<boolean>;
} => {
  const snapshot = useSyncExternalStore(
    pwaInstallController.subscribe,
    pwaInstallController.getSnapshot,
    pwaInstallController.getSnapshot,
  );

  return {
    ...snapshot,
    promptInstall: pwaInstallController.promptInstall.bind(pwaInstallController),
  };
};
