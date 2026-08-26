import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  getUri: vi.fn(),
  isPlatform: vi.fn(),
  share: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('@capacitor/share', () => ({
  Share: { share: testState.share },
}));

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    getUri: testState.getUri,
    writeFile: testState.writeFile,
  },
}));

vi.mock('@ionic/react', () => ({
  isPlatform: testState.isPlatform,
}));

vi.mock('../services/logging', () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

import { shareFile } from './fileUtils';

describe('shareFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.isPlatform.mockReturnValue(false);
    testState.writeFile.mockResolvedValue({ uri: 'file:///cache/teapp_logs.jsonl' });
    testState.getUri.mockResolvedValue({ uri: 'file:///cache/teapp_logs.jsonl' });
    testState.share.mockResolvedValue({ activityType: 'com.google.android.apps.docs' });
  });

  it('shares a native file without a generic subject that can replace its filename', async () => {
    await shareFile('teapp_logs.jsonl', '{"message":"test"}', 'text/plain');

    expect(testState.share).toHaveBeenCalledWith({
      text: 'Sharing file: teapp_logs.jsonl',
      url: 'file:///cache/teapp_logs.jsonl',
      dialogTitle: 'Share File',
    });
  });
});
