import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/WeightLoggerService', () => ({
  weightLoggerService: {
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    saveRecording: vi.fn(),
    getRecordings: vi.fn().mockResolvedValue(['rec1.json']),
  },
}));

import { weightLoggerService } from '../services/WeightLoggerService';
import { initialRecordingStoreState, recordingStore } from './useRecordingStore';

describe('useRecordingStore', () => {
  beforeEach(() => {
    recordingStore.setState(initialRecordingStoreState);
    vi.clearAllMocks();
    vi.mocked(weightLoggerService.getRecordings).mockResolvedValue(['rec1.json']);
  });

  it('starts recording and captures a start timestamp', () => {
    recordingStore.getState().startRecording();

    expect(weightLoggerService.startRecording).toHaveBeenCalled();
    expect(recordingStore.getState().isRecording).toBe(true);
    expect(recordingStore.getState().recordingStartTime).not.toBeNull();
  });

  it('stops recording, saves it, and refreshes the saved recordings list', async () => {
    recordingStore.setState({ isRecording: true, recordingStartTime: 12345 });

    await recordingStore.getState().stopRecording('My Session', 'Notes');

    expect(weightLoggerService.stopRecording).toHaveBeenCalled();
    expect(weightLoggerService.saveRecording).toHaveBeenCalledWith('My Session', 'Notes');
    expect(weightLoggerService.getRecordings).toHaveBeenCalled();
    expect(recordingStore.getState().isRecording).toBe(false);
    expect(recordingStore.getState().recordingStartTime).toBeNull();
    expect(recordingStore.getState().savedRecordings).toEqual(['rec1.json']);
  });

  it('refreshes recordings without mutating active recording state', async () => {
    vi.mocked(weightLoggerService.getRecordings).mockResolvedValue(['rec2.json']);

    await recordingStore.getState().refreshRecordings();

    expect(recordingStore.getState().savedRecordings).toEqual(['rec2.json']);
    expect(recordingStore.getState().isRecording).toBe(false);
  });
});
