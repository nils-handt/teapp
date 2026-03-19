import { DataSource } from 'typeorm';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { BrewingVessel } from '../entities/BrewingVessel.entity';
import { Infusion } from '../entities/Infusion.entity';
import { ScaleDevice } from '../entities/ScaleDevice.entity';
import { Settings } from '../entities/Settings.entity';
import { WebPersistenceSubscriber } from './WebPersistenceSubscriber';

export const sqliteConnection = new SQLiteConnection(CapacitorSQLite);

export const AppDataSource = new DataSource({
    type: 'capacitor',
    driver: sqliteConnection,
    database: 'teapp',
    mode: 'no-encryption',
    synchronize: true, // todo: set to false and use migrations
    logging: false,
    entities: [
        BrewingSession,
        BrewingVessel,
        Infusion,
        ScaleDevice,
        Settings
    ],
    migrations: [],
    subscribers: [
        WebPersistenceSubscriber
    ],
});
