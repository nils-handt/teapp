import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { bluetoothScaleService } from './BluetoothScaleService';
import { Subscription } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { createLogger } from './logging';

const logger = createLogger('WeightLoggerService');

interface WeightDataPoint {
    timestamp: number;
    weight: number;
}

interface RecordingSession {
    name: string;
    date: string;
    notes?: string;
    data: WeightDataPoint[];
}

class WeightLoggerService {
    private isRecording = false;
    private currentSessionData: WeightDataPoint[] = [];
    private weightSubscription: Subscription | null = null;
    public recordingStartTime: number | null = null;

    public startRecording() {
        if (this.isRecording) {
            logger.debug('Ignoring startRecording because a recording is already active');
            return;
        }

        this.isRecording = true;
        this.currentSessionData = [];
        this.recordingStartTime = Date.now();

        // Subscribe to weight updates
        this.weightSubscription = bluetoothScaleService.weight$.subscribe(weight => {
            if (this.isRecording) {
                this.currentSessionData.push({
                    timestamp: Date.now(),
                    weight: weight
                });
            }
        });

        logger.info('Weight recording started');
    }

    public stopRecording(): WeightDataPoint[] {
        if (!this.isRecording) {
            logger.debug('Ignoring stopRecording because there is no active recording');
            return [];
        }

        this.isRecording = false;
        this.recordingStartTime = null;

        if (this.weightSubscription) {
            this.weightSubscription.unsubscribe();
            this.weightSubscription = null;
        }

        logger.info('Weight recording stopped', { capturedPoints: this.currentSessionData.length });
        return [...this.currentSessionData];
    }

    public async saveRecording(sessionName: string, notes: string = ''): Promise<void> {
        const dataToSave = this.isRecording ? [...this.currentSessionData] : this.currentSessionData;

        if (dataToSave.length === 0) {
            logger.warn('Skipping recording save because there is no data to persist', { sessionName });
            return;
        }

        const session: RecordingSession = {
            name: sessionName,
            date: new Date().toISOString(),
            notes,
            data: dataToSave
        };

        const fileName = `recording_${Date.now()}_${sessionName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;

        try {
            await Filesystem.writeFile({
                path: `recordings/${fileName}`,
                data: JSON.stringify(session, null, 2),
                directory: Directory.Data,
                encoding: Encoding.UTF8,
                recursive: true
            });
            logger.info('Recording saved', { fileName, sessionName, capturedPoints: dataToSave.length });
        } catch (e) {
            logger.error('Failed to save recording', e);
            throw e;
        }
    }

    public async getRecordings(): Promise<string[]> {
        try {
            const result = await Filesystem.readdir({
                path: 'recordings',
                directory: Directory.Data
            });
            logger.debug('Loaded recording file list', { count: result.files.length });
            return result.files.map(f => f.name);
        } catch {
            // Directory might not exist yet
            logger.debug('Recording directory does not exist yet');
            return [];
        }
    }

    public async loadRecording(fileName: string): Promise<RecordingSession | null> {
        try {
            const result = await Filesystem.readFile({
                path: `recordings/${fileName}`,
                directory: Directory.Data,
                encoding: Encoding.UTF8
            });
            logger.info('Loaded recording', { fileName });
            return JSON.parse(result.data as string);
        } catch (e) {
            logger.error('Failed to load recording', { fileName, error: e });
            return null;
        }
    }

    public async deleteRecording(fileName: string): Promise<void> {
        try {
            await Filesystem.deleteFile({
                path: `recordings/${fileName}`,
                directory: Directory.Data
            });
            logger.info('Deleted recording', { fileName });
        } catch (e) {
            logger.error('Failed to delete recording', { fileName, error: e });
            throw e;
        }
    }

    public async getRecordingUri(fileName: string): Promise<string> {
        try {
            if (Capacitor.getPlatform() === 'android') {
                await Filesystem.copy({
                    from: `recordings/${fileName}`,
                    to: fileName,
                    directory: Directory.Data,
                    toDirectory: Directory.Cache
                });
                const result = await Filesystem.getUri({
                    path: fileName,
                    directory: Directory.Cache
                });
                logger.info('Resolved Android recording URI', { fileName });
                return result.uri;
            }

            const result = await Filesystem.getUri({
                path: `recordings/${fileName}`,
                directory: Directory.Data
            });
            logger.info('Resolved recording URI', { fileName });
            return result.uri;
        } catch (e) {
            logger.error('Failed to resolve recording URI', { fileName, error: e });
            throw e;
        }
    }
}

export const weightLoggerService = new WeightLoggerService();
