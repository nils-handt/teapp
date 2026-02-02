import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { bluetoothScaleService } from './BluetoothScaleService';
import { Subscription } from 'rxjs';
import { Capacitor } from '@capacitor/core';

export interface WeightDataPoint {
    timestamp: number;
    weight: number;
}

export interface RecordingSession {
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
        if (this.isRecording) return;

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

        console.log('Weight recording started');
    }

    public stopRecording(): WeightDataPoint[] {
        if (!this.isRecording) return [];

        this.isRecording = false;
        this.recordingStartTime = null;

        if (this.weightSubscription) {
            this.weightSubscription.unsubscribe();
            this.weightSubscription = null;
        }

        console.log(`Weight recording stopped. Captured ${this.currentSessionData.length} data points.`);
        return [...this.currentSessionData];
    }

    public async saveRecording(sessionName: string, notes: string = ''): Promise<void> {
        const dataToSave = this.isRecording ? [...this.currentSessionData] : this.currentSessionData;

        if (dataToSave.length === 0) {
            console.warn('No data to save');
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
            console.log(`Recording saved to recordings/${fileName}`);
        } catch (e) {
            console.error('Error saving recording:', e);
            throw e;
        }
    }

    public async getRecordings(): Promise<string[]> {
        try {
            const result = await Filesystem.readdir({
                path: 'recordings',
                directory: Directory.Data
            });
            return result.files.map(f => f.name);
        } catch {
            // Directory might not exist yet
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
            return JSON.parse(result.data as string);
        } catch (e) {
            console.error('Error loading recording:', e);
            return null;
        }
    }

    public async deleteRecording(fileName: string): Promise<void> {
        try {
            await Filesystem.deleteFile({
                path: `recordings/${fileName}`,
                directory: Directory.Data
            });
        } catch (e) {
            console.error('Error deleting recording:', e);
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
                return result.uri;
            }

            const result = await Filesystem.getUri({
                path: `recordings/${fileName}`,
                directory: Directory.Data
            });
            return result.uri;
        } catch (e) {
            console.error('Error getting recording URI:', e);
            throw e;
        }
    }
}

export const weightLoggerService = new WeightLoggerService();
