import { DataSource } from 'typeorm';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { BrewingVessel } from '../entities/BrewingVessel.entity';
import { Infusion } from '../entities/Infusion.entity';
import { ScaleDevice } from '../entities/ScaleDevice.entity';
import { Settings } from '../entities/Settings.entity';
import { Tea } from '../entities/Tea.entity';
import { BaselineSchema1710000000000 } from './migrations/1710000000000-BaselineSchema';
import { AddTeaEntity1720000000000 } from './migrations/1720000000000-AddTeaEntity';
import { WebPersistenceSubscriber } from './WebPersistenceSubscriber';

export const sqliteConnection = new SQLiteConnection(CapacitorSQLite);

export const AppDataSource = new DataSource({
    type: 'capacitor',
    driver: sqliteConnection,
    database: 'teapp',
    mode: 'no-encryption',
    synchronize: false,
    migrationsRun: true,
    logging: false,
    entities: [
        BrewingSession,
        BrewingVessel,
        Infusion,
        ScaleDevice,
        Settings,
        Tea
    ],
    migrations: [
        BaselineSchema1710000000000,
        AddTeaEntity1720000000000
    ],
    subscribers: [
        WebPersistenceSubscriber
    ],
});
