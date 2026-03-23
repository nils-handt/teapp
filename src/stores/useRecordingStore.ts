import { useStore as useZustandStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { weightLoggerService } from '../services/WeightLoggerService';
import { createLogger } from '../services/logging';

const logger = createLogger('RecordingStore');

export interface RecordingStoreState {
  isRecording: boolean;
  recordingStartTime: number | null;
  savedRecordings: string[];
}

export interface RecordingStoreActions {
  startRecording: () => void;
  stopRecording: (sessionName: string, notes?: string) => Promise<void>;
  discardRecording: () => void;
  refreshRecordings: () => Promise<void>;
}

export type RecordingStore = RecordingStoreState & RecordingStoreActions;

export const initialRecordingStoreState: RecordingStoreState = {
  isRecording: false,
  recordingStartTime: null,
  savedRecordings: [],
};

export const recordingStore = createStore<RecordingStore>()((set) => ({
  ...initialRecordingStoreState,
  startRecording: () => {
    logger.info('Starting weight recording');
    weightLoggerService.startRecording();
    set({ isRecording: true, recordingStartTime: Date.now() });
  },
  stopRecording: async (sessionName, notes) => {
    logger.info('Stopping weight recording', { sessionName, hasNotes: Boolean(notes) });
    weightLoggerService.stopRecording();
    await weightLoggerService.saveRecording(sessionName, notes);
    const recordings = await weightLoggerService.getRecordings();
    set({ isRecording: false, recordingStartTime: null, savedRecordings: recordings });
  },
  discardRecording: () => {
    logger.info('Discarding active weight recording');
    weightLoggerService.stopRecording();
    set({ isRecording: false, recordingStartTime: null });
  },
  refreshRecordings: async () => {
    logger.debug('Refreshing saved recordings');
    const recordings = await weightLoggerService.getRecordings();
    set({ savedRecordings: recordings });
  },
}));

export const useRecordingStore = <T>(selector: (state: RecordingStore) => T): T =>
  useZustandStore(recordingStore, selector);
