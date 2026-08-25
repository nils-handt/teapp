import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  flushLoggerWrites: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    readFile: testState.readFile,
    readdir: testState.readdir,
  },
}));

vi.mock('./logger', () => ({
  flushLoggerWrites: testState.flushLoggerWrites,
}));

import { createLogExport } from './logExport';

const file = (name: string, type: 'file' | 'directory' = 'file') => ({
  name,
  type,
  size: 0,
  ctime: 0,
  mtime: 0,
  uri: `file://${name}`,
});

describe('createLogExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.flushLoggerWrites.mockResolvedValue(undefined);
  });

  it('flushes pending writes and combines daily logs in chronological name order', async () => {
    testState.readdir.mockResolvedValue({
      files: [
        file('app-2026-08-25.log'),
        file('notes.txt'),
        file('app-2026-08-23.log'),
        file('app-2026-08-24.log', 'directory'),
      ],
    });
    testState.readFile
      .mockResolvedValueOnce({ data: '{"day":23}' })
      .mockResolvedValueOnce({ data: '{"day":25}\n' });

    const result = await createLogExport(new Date('2026-08-25T19:04:05.678Z'));

    expect(testState.flushLoggerWrites).toHaveBeenCalledTimes(1);
    expect(testState.flushLoggerWrites.mock.invocationCallOrder[0]).toBeLessThan(
      testState.readdir.mock.invocationCallOrder[0]
    );
    expect(testState.readFile.mock.calls).toEqual([
      [{ path: 'logs/app-2026-08-23.log', directory: 'DATA', encoding: 'utf8' }],
      [{ path: 'logs/app-2026-08-25.log', directory: 'DATA', encoding: 'utf8' }],
    ]);
    expect(result).toEqual({
      data: '{"day":23}\n{"day":25}\n',
      fileName: 'teapp_logs_2026-08-25T19-04-05-678Z.jsonl',
      sourceFiles: ['app-2026-08-23.log', 'app-2026-08-25.log'],
    });
  });

  it('returns no export when the private log directory does not exist', async () => {
    testState.readdir.mockRejectedValue(Object.assign(new Error('missing'), {
      code: 'OS-PLUG-FILE-0008',
    }));

    await expect(createLogExport()).resolves.toBeNull();
    expect(testState.readFile).not.toHaveBeenCalled();
  });

  it('propagates unexpected filesystem failures', async () => {
    testState.readdir.mockRejectedValue(new Error('permission denied'));

    await expect(createLogExport()).rejects.toThrow('permission denied');
  });
});
