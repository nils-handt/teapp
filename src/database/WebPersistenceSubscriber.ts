import { EntitySubscriberInterface, EventSubscriber } from 'typeorm';
import { Capacitor } from '@capacitor/core';
import { sqliteConnection } from './dataSource';

@EventSubscriber()
export class WebPersistenceSubscriber implements EntitySubscriberInterface {

    async afterTransactionCommit() {
        await this.saveToStore();
    }

    private async saveToStore() {
        if (Capacitor.getPlatform() === 'web') {
            try {
                await sqliteConnection.saveToStore('teapp');
            } catch (err) {
                console.error('Failed to save to store', err);
            }
        }
    }
}
