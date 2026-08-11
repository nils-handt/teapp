import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => {
    const events: string[] = [];
    const dataSource = {
        destroy: vi.fn(),
        initialize: vi.fn(),
        isInitialized: true,
    };
    const sqliteConnection = {
        closeConnection: vi.fn(),
        createConnection: vi.fn(),
        importFromJson: vi.fn(),
        isConnection: vi.fn(),
        isJsonValid: vi.fn(),
        retrieveConnection: vi.fn(),
    };
    return { dataSource, events, sqliteConnection };
});

vi.mock('../database/dataSource', () => ({
    AppDataSource: testState.dataSource,
    sqliteConnection: testState.sqliteConnection,
}));

vi.mock('./logging', () => ({
    createLogger: () => ({ error: vi.fn(), info: vi.fn() }),
}));

import { backupService, type BackupData } from './BackupService';

const validBackup: BackupData = {
    database: 'teapp',
    mode: 'full',
    tables: [],
    version: 1,
};

describe('BackupService.importData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        testState.events.length = 0;
        testState.dataSource.isInitialized = true;
        testState.dataSource.destroy.mockImplementation(async () => {
            testState.events.push('destroy');
            testState.dataSource.isInitialized = false;
        });
        testState.dataSource.initialize.mockImplementation(async () => {
            testState.events.push('initialize');
            testState.dataSource.isInitialized = true;
            return testState.dataSource;
        });
        testState.sqliteConnection.isJsonValid.mockImplementation(async () => {
            testState.events.push('validate');
            return { result: true };
        });
        testState.sqliteConnection.isConnection.mockImplementation(async () => {
            testState.events.push('isConnection');
            return { result: true };
        });
        testState.sqliteConnection.closeConnection.mockImplementation(async () => {
            testState.events.push('closeConnection');
        });
        testState.sqliteConnection.importFromJson.mockImplementation(async () => {
            testState.events.push('import');
            return { changes: { changes: 3 } };
        });
    });

    it('validates before tearing down and removes the named connection before import', async () => {
        await backupService.importData(validBackup);

        expect(testState.events).toEqual([
            'validate',
            'destroy',
            'isConnection',
            'closeConnection',
            'import',
        ]);
        expect(testState.dataSource.initialize).not.toHaveBeenCalled();
    });

    it('does not tear down the active connection for structurally invalid data', async () => {
        await expect(backupService.importData({ database: 'teapp' } as BackupData))
            .rejects.toThrow('Invalid backup file format');

        expect(testState.sqliteConnection.isJsonValid).not.toHaveBeenCalled();
        expect(testState.dataSource.destroy).not.toHaveBeenCalled();
    });

    it('does not tear down the active connection when SQLite rejects the JSON', async () => {
        testState.sqliteConnection.isJsonValid.mockResolvedValue({ result: false });

        await expect(backupService.importData(validBackup))
            .rejects.toThrow('Invalid JSON data for SQLite import');

        expect(testState.dataSource.destroy).not.toHaveBeenCalled();
    });

    it('reinitializes the data source when import fails after teardown', async () => {
        testState.sqliteConnection.importFromJson.mockImplementation(async () => {
            testState.events.push('import');
            throw new Error('native import failed');
        });

        await expect(backupService.importData(validBackup)).rejects.toThrow('native import failed');

        expect(testState.events).toEqual([
            'validate',
            'destroy',
            'isConnection',
            'closeConnection',
            'import',
            'initialize',
        ]);
    });
});
