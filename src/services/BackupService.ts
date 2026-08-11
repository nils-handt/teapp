import { AppDataSource, sqliteConnection } from '../database/dataSource';
import { createLogger } from './logging';

const logger = createLogger('BackupService');

export interface BackupData {
    database: string;
    tables: unknown[];
    overwrite?: boolean;
    [key: string]: unknown;
}

export const isBackupData = (value: unknown): value is BackupData => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const backupData = value as Partial<BackupData>;
    return typeof backupData.database === 'string' && Array.isArray(backupData.tables);
};

class BackupService {
    /**
     * Exports the entire database to a JSON object.
     * @returns The exported data as a JSON object.
     */
    public async exportData(): Promise<BackupData> {
        logger.info('Starting database export');

        try {
            // Create a connection to the database if not already open
            // In this app, the connection is usually managed by TypeORM, but we need the raw connection for export
            const dbName = 'teapp'; // Matches the database name in dataSource.ts

            // Check if connection exists, if not create/retrieve it
            const isConnection = await sqliteConnection.isConnection(dbName, false);
            if (!isConnection.result) {
                await sqliteConnection.createConnection(dbName, false, 'no-encryption', 1, false);
            }

            const db = await sqliteConnection.retrieveConnection(dbName, false);

            if (!db) {
                throw new Error('Could not retrieve database connection');
            }

            // Opens the connection if it appears closed, but TypeORM should keep it open.
            // However, capacitor-sqlite might need explicit open for some operations if not using the TypeORM driver wrapper directly here?
            // Actually, standard practice with this plugin:
            const isOpen = await db.isDBOpen();
            if (!isOpen.result) {
                await db.open();
            }

            const exportData = await db.exportToJson('full');
            if (!exportData.export || !isBackupData(exportData.export)) {
                throw new Error('Export returned invalid backup data');
            }

            logger.info('Database export completed');
            return exportData.export;

        } catch (error) {
            logger.error('Database export failed', error);
            throw error;
        }
    }

    /**
     * Imports data from a JSON object into the database.
     * @param data The JSON data to import.
     */
    public async importData(data: BackupData): Promise<void> {
        logger.info('Starting database import');

        const dbName = 'teapp';
        let dataSourceWasDestroyed = false;

        try {
            if (!isBackupData(data)) {
                throw new Error('Invalid backup file format');
            }

            // Force overwrite to ensure we start with a clean state matching the backup
            const backupData: BackupData = { ...data, overwrite: true };

            const jsonString = JSON.stringify(backupData);

            // Validate JSON
            const isValid = await sqliteConnection.isJsonValid(jsonString);
            if (!isValid.result) {
                throw new Error('Invalid JSON data for SQLite import');
            }

            // TypeORM closes the database handle, but the Capacitor SQLite
            // wrapper keeps a named connection registered until it is removed
            // explicitly. Leaving either layer alive makes native reloads fail.
            if (AppDataSource.isInitialized) {
                await AppDataSource.destroy();
                dataSourceWasDestroyed = true;
            }

            const isConnection = await sqliteConnection.isConnection(dbName, false);
            if (isConnection.result) {
                await sqliteConnection.closeConnection(dbName, false);
            }

            // Perform import
            const result = await sqliteConnection.importFromJson(jsonString);

            if (result.changes && result.changes.changes === -1) {
                throw new Error('Import failed');
            }

            logger.info('Database import completed', { changes: result.changes });

        } catch (error) {
            // Validation happens before teardown. Once teardown starts, recover
            // a usable connection if import fails so the current UI is not left
            // attached to a destroyed DataSource.
            if (dataSourceWasDestroyed && !AppDataSource.isInitialized) {
                try {
                    await AppDataSource.initialize();
                } catch (recoveryError) {
                    logger.error('Failed to recover database connection after import failure', recoveryError);
                }
            }
            logger.error('Database import failed', error);
            throw error;
        }
    }
}

export const backupService = new BackupService();
