import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const filesystemMocks = vi.hoisted(() => ({
    mkdir: vi.fn().mockResolvedValue(undefined),
    appendFile: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue({ uri: 'file://log' }),
}));

vi.mock('@capacitor/filesystem', () => ({
    Directory: { Data: 'DATA' },
    Encoding: { UTF8: 'utf8' },
    Filesystem: filesystemMocks,
}));

import {
    configureLogger,
    createLogger,
    flushLoggerWrites,
    resetLoggerForTest,
} from './logger';

describe('logger', () => {
    beforeEach(() => {
        resetLoggerForTest();
        vi.clearAllMocks();
        filesystemMocks.mkdir.mockReset().mockResolvedValue(undefined);
        filesystemMocks.appendFile.mockReset().mockResolvedValue(undefined);
        filesystemMocks.writeFile.mockReset().mockResolvedValue({ uri: 'file://log' });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('filters entries below the configured minimum level', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const logger = createLogger('TestScope');

        configureLogger({ minLevel: 'warn' });

        logger.info('This should be filtered');
        logger.warn('This should be logged');

        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[WARN] [TestScope] This should be logged')
        );
    });

    it('routes every emitted level through console.log', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const logger = createLogger('ConsoleSink');

        logger.debug('debug');
        logger.info('info');
        logger.warn('warn');
        logger.error('error');

        expect(consoleSpy).toHaveBeenCalledTimes(4);
        expect(consoleSpy.mock.calls.map((call) => call[0])).toEqual([
            expect.stringContaining('[DEBUG] [ConsoleSink] debug'),
            expect.stringContaining('[INFO] [ConsoleSink] info'),
            expect.stringContaining('[WARN] [ConsoleSink] warn'),
            expect.stringContaining('[ERROR] [ConsoleSink] error'),
        ]);
    });

    it('appends emitted entries to the daily log file when file logging is enabled', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-21T12:34:56.000Z'));
        const logger = createLogger('FileSink');

        configureLogger({ enableFileLogging: true });
        logger.info('Persist this entry', { count: 1 });
        await flushLoggerWrites();

        expect(filesystemMocks.mkdir).toHaveBeenCalledWith({
            path: 'logs',
            directory: 'DATA',
            recursive: true,
        });
        expect(filesystemMocks.appendFile).toHaveBeenCalledWith(expect.objectContaining({
            path: 'logs/app-2026-03-21.log',
            directory: 'DATA',
            encoding: 'utf8',
        }));

        const [{ data }] = filesystemMocks.appendFile.mock.calls[0];
        expect(data).toContain('"scope":"FileSink"');
        expect(data).toContain('"message":"Persist this entry"');
        expect(data).toContain('"count":1');
    });

    it('keeps appending when the log directory already exists', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const logger = createLogger('FileSink');
        filesystemMocks.mkdir
            .mockResolvedValueOnce(undefined)
            .mockRejectedValue(new Error('Current directory does already exist.'));

        configureLogger({ enableFileLogging: true });
        logger.info('First entry');
        logger.info('Second entry');
        await flushLoggerWrites();

        expect(filesystemMocks.appendFile).toHaveBeenCalledTimes(2);
        expect(consoleSpy).not.toHaveBeenCalledWith(
            '[LOGGER_FILE_SINK] Failed to write log entry',
            expect.anything()
        );
    });

    it('reports other log directory creation failures', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const logger = createLogger('FileSink');
        filesystemMocks.mkdir.mockRejectedValue(new Error('Permission denied.'));

        configureLogger({ enableFileLogging: true });
        logger.info('Blocked entry');
        await flushLoggerWrites();

        expect(filesystemMocks.appendFile).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            '[LOGGER_FILE_SINK] Failed to write log entry',
            expect.objectContaining({ message: 'Permission denied.' })
        );
    });

    it('serializes error metadata before sending it to the console sink', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const logger = createLogger('Serializer');
        const error = new Error('Boom');

        logger.error('Something broke', error);

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[ERROR] [Serializer] Something broke'),
            expect.objectContaining({
                name: 'Error',
                message: 'Boom',
                stack: expect.any(String),
            })
        );
    });
});
