import { Capacitor } from '@capacitor/core';
import { sqliteConnection } from '../database/dataSource';

class BackupService {
    /**
     * Exports the entire database to a JSON object.
     * @returns The exported data as a JSON object.
     */
    public async exportData(): Promise<any> {
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
            return exportData.export;

        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        }
    }

    /**
     * Imports data from a JSON object into the database.
     * @param data The JSON data to import.
     */
    public async importData(data: any): Promise<void> {
        try {
            const dbName = 'teapp';
            // Check connection but don't strictly need it open for import if using plugin directly? 
            // Actually, importFromJson requires the DB to be closed in some versions, or open in others.
            // The documentation says "Import from Json Object".
            // Let's ensure we have a handle to the plugin.

            const isConnection = await sqliteConnection.isConnection(dbName, false);
            if (!isConnection.result) {
                await sqliteConnection.createConnection(dbName, false, 'no-encryption', 1, false);
            }

            // Close the connection before importing to avoid locks/issues with overwrite
            const db = await sqliteConnection.retrieveConnection(dbName, false);
            const isOpen = await db.isDBOpen();
            if (isOpen.result) {
                await db.close();
            }

            // Validating basic structure - data should be the object that exportToJson returns
            if (!data || !data.database || !data.tables) {
                throw new Error('Invalid backup file format');
            }

            // Force overwrite to ensure we start with a clean state matching the backup
            data.overwrite = true;

            const jsonString = JSON.stringify(data);

            // Validate JSON
            const isValid = await sqliteConnection.isJsonValid(jsonString);
            if (!isValid.result) {
                throw new Error('Invalid JSON data for SQLite import');
            }

            // Perform import
            const result = await sqliteConnection.importFromJson(jsonString);

            if (result.changes && result.changes.changes === -1) {
                throw new Error('Import failed');
            }

            if (Capacitor.getPlatform() === 'web') {
                try {
                    await sqliteConnection.saveToStore('teapp');
                } catch (err) {
                    console.error('Failed to save to store', err);
                }
            }

            console.log('Import successful', result);

        } catch (error) {
            console.error('Import failed:', error);
            throw error;
        }
    }
}

export const backupService = new BackupService();
