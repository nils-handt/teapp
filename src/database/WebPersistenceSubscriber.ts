import { EntitySubscriberInterface, EventSubscriber } from 'typeorm';
import { Capacitor } from '@capacitor/core';
import { sqliteConnection } from './dataSource';
import { createLogger } from '../services/logging';

const logger = createLogger('WebPersistenceSubscriber');

@EventSubscriber()
export class WebPersistenceSubscriber implements EntitySubscriberInterface {

    async afterTransactionCommit() {
        await this.saveToStore();
    }

    async afterRemove() {
        await this.saveToStore();
    }

    private async saveToStore() {
        if (Capacitor.getPlatform() === 'web') {
            try {
                await sqliteConnection.saveToStore('teapp');
            } catch (err) {
                logger.error('Failed to save SQLite state to the web store', err);
            }
        }
    }
}
