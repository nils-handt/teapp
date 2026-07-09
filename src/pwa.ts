import { registerSW } from 'virtual:pwa-register';
import { pwaUpdateController } from './services/PwaUpdateService';
import { createLogger } from './services/logging';

const logger = createLogger('PWA');

const updateServiceWorker = registerSW({
  onNeedRefresh() {
    logger.info('PWA update is available');
    pwaUpdateController.notifyUpdateAvailable(updateServiceWorker);
  },
  onOfflineReady() {
    logger.info('PWA is ready to work offline');
    pwaUpdateController.notifyOfflineReady();
  },
  onRegisterError(error) {
    logger.error('Service worker registration failed', error);
  },
});
