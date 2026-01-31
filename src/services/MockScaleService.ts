import { Subject } from 'rxjs';
import { useStore } from '../stores/useStore';
import { DiscoveredDevice } from './bluetooth/types/ble.types';
import { IScaleService } from './interfaces/IScaleService';
import { Logger } from './bluetooth/utils/Logger';

const logger = new Logger('MockScaleService');

interface RecordingData {
    timestamp: number;
    weight: number;
}

export class MockScaleService implements IScaleService {
    public weight$ = new Subject<number>();

    private recording: RecordingData[] = [];
    private isPlaying = false;
    private startTime = 0;
    private recordingDuration = 0;
    private lastEmitIndex = 0;
    private timeoutId: NodeJS.Timeout | null = null;
    private currentVirtualTime = 0;
    private loop = false;

    constructor() { }

    async initialize(): Promise<void> {
        logger.log('MockScaleService initialized.');
        // No auto-connect logic for mock yet, or maybe load default recording?
    }

    async connectNewDevice(): Promise<void> {
        // For mock, this is effectively "Select Recording" or just "Connect" if a recording is loaded.
        // Since UI will handle file upload separately, this might just simulate a connection delay.
        await this.connect({
            id: 'mock-device-id',
            name: 'Mock Scale',
            rssi: -50,
            scaleType: undefined, // Type check might need loose typing or Mock type
            peripheral: { id: 'mock', name: 'Mock', advertising: new ArrayBuffer(0), rssi: -50 }
        } as any);
    }

    async connect(device: DiscoveredDevice): Promise<void> {
        logger.log(`Connecting to mock device: ${device.name}`);
        useStore.getState().setConnectionStatus('connecting');
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
        useStore.getState().setConnectionStatus('connected');
        useStore.getState().setConnectedDevice(device);
        logger.log('Mock device connected.');

        if (this.recording.length > 0) {
            this.startReplay();
        }
    }

    async disconnect(): Promise<void> {
        logger.log('Disconnecting mock device...');
        this.stopReplay();
        useStore.getState().setConnectionStatus('disconnected');
        useStore.getState().setConnectedDevice(null);
        useStore.getState().setCurrentWeight(0);
    }

    async tare(): Promise<void> {
        logger.log('Mock tare called - no-op for now');
    }

    getConnectionStatus() {
        return useStore.getState().connectionStatus;
    }

    getConnectedDevice() {
        return useStore.getState().connectedDevice;
    }

    // Mock Specific Methods

    loadRecording(data: RecordingData[]) {
        if (!data || data.length === 0) {
            logger.error('Invalid recording data loaded.');
            return;
        }
        // Normalize timestamps to start at 0 if they are absolute, or assume they are relative/series
        // The sample recording has absolute timestamps. We should normalize them.
        const firstTimestamp = data[0].timestamp;
        this.recording = data.map(d => ({
            timestamp: d.timestamp - firstTimestamp,
            weight: d.weight
        }));
        this.recordingDuration = this.recording[this.recording.length - 1].timestamp;

        logger.log(`Loaded recording with ${this.recording.length} samples. Duration: ${this.recordingDuration}ms`);
    }

    startReplay() {
        if (this.isPlaying) return;
        if (this.recording.length === 0) {
            logger.log('No recording loaded to play.');
            return;
        }

        this.isPlaying = true;
        // Resume from current virtual time
        this.startTime = Date.now() - this.currentVirtualTime;

        // If we were at end, reset (unless explicitly paused, but here startReplay implies play)
        if (this.currentVirtualTime >= this.recordingDuration) {
            this.startTime = Date.now();
            this.currentVirtualTime = 0;
            this.lastEmitIndex = 0;
        }

        this.scheduleNext();
    }

    pauseReplay() {
        this.isPlaying = false;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        // Save current virtual time relative to when we started
        if (this.startTime > 0) {
            this.currentVirtualTime = Date.now() - this.startTime;
        }
    }

    stopReplay() {
        this.pauseReplay();
        this.currentVirtualTime = 0;
        this.lastEmitIndex = 0;
        this.startTime = 0;
    }

    private scheduleNext = () => {
        if (!this.isPlaying) return;

        const now = Date.now();
        this.currentVirtualTime = now - this.startTime;

        if (this.currentVirtualTime > this.recordingDuration) {
            if (this.loop) {
                this.startTime = now;
                this.currentVirtualTime = 0;
                this.lastEmitIndex = 0;
                logger.log('Looping replay.');
            } else {
                logger.log('Replay finished.');
                this.pauseReplay();
                // Ensure we emit the final state
                this.currentVirtualTime = this.recordingDuration;
                return;
            }
        }

        // Emit events relevant for current time
        while (
            this.lastEmitIndex < this.recording.length &&
            this.recording[this.lastEmitIndex].timestamp <= this.currentVirtualTime
        ) {
            const sample = this.recording[this.lastEmitIndex];
            this.emitWeight(sample.weight);
            this.lastEmitIndex++;
        }

        // Calculate delay to next event
        if (this.lastEmitIndex < this.recording.length) {
            const nextEvent = this.recording[this.lastEmitIndex];
            // When should this event happen?
            const targetTime = this.startTime + nextEvent.timestamp;
            const delay = Math.max(0, targetTime - Date.now());

            this.timeoutId = setTimeout(this.scheduleNext, delay);
        } else {
            // End of recording reached, wait until duration end to loop or finish?
            // Actually the duration check at top handles it. We can just schedule a check for end.
            const delay = Math.max(0, (this.startTime + this.recordingDuration) - Date.now());
            this.timeoutId = setTimeout(this.scheduleNext, delay + 10); // +10 buffer
        }
    }

    private emitWeight(weight: number) {
        useStore.getState().setCurrentWeight(weight);
        this.weight$.next(weight);
    }
}
