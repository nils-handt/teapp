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
    private timeoutId: ReturnType<typeof setTimeout> | null = null;
    private currentVirtualTime = 0;
    private loop = false;
    private playbackSpeed = 1;

    constructor() { }

    async initialize(): Promise<void> {
        logger.log('MockScaleService initialized.');
        // Initialize with store value if possible, but store accessed via hook or getState usually
        const storeSpeed = useStore.getState().playbackSpeed;
        if (storeSpeed) {
            this.playbackSpeed = storeSpeed;
        }
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

    setPlaybackSpeed(speed: number) {
        if (speed <= 0) return;
        logger.log(`Setting playback speed to ${speed}x`);

        // If playing, we need to adjust startTime so that the current virtual time remains the same
        // but future time progresses faster.
        if (this.isPlaying) {
            const now = Date.now();
            // Current virtual time achieved with old speed
            // currentVirtualTime = (now - startTime) * oldSpeed
            // We want new equation to hold:
            // currentVirtualTime = (now - newStartTime) * newSpeed
            // => newStartTime = now - (currentVirtualTime / newSpeed)

            // Recalculate current virtual time based on *actual* elapsed time since last start/adjustment
            // NOTE: This simple linear model (now - start) * speed works if speed is constant.
            // If speed changes dynamic, we need to anchor 'now' as the new base.

            // Let's use the anchor approach:
            // At this moment 'now', we are at 'currentVirtualTime'.
            // We want to continue from 'currentVirtualTime' but with 'newSpeed'.
            // So, effectively, we are treating 'now' as a fresh start point (startTime),
            // but with an initial offset of 'currentVirtualTime'.
            // Wait, the logic in scheduleNext is: currentVirtualTime = (now - this.startTime) * speed is NOT sufficient if speed changes.
            // It assumes speed was constant since startTime.

            // Correct logic for variable speed:
            // 1. Calculate where we are NOW in virtual time.
            this.currentVirtualTime = (now - this.startTime) * this.playbackSpeed;

            // 2. Update speed
            this.playbackSpeed = speed;

            // 3. Reset startTime so that at 'now', (now - startTime) * speed == currentVirtualTime
            // => 0 * speed == currentVirtualTime (Incorrect if we just set startTime=now)
            // We want: (now - newStartTime) * newSpeed = currentVirtualTime
            // => now - newStartTime = currentVirtualTime / newSpeed
            // => newStartTime = now - (currentVirtualTime / newSpeed)

            this.startTime = now - (this.currentVirtualTime / this.playbackSpeed);

            // Cancel current timeout and reschedule immediately to apply new speed
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }
            this.scheduleNext();
        } else {
            this.playbackSpeed = speed;
        }
    }

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
        // Resume logic:
        // We are at this.currentVirtualTime.
        // We want (Date.now() - this.startTime) * this.playbackSpeed = this.currentVirtualTime
        // => this.startTime = Date.now() - (this.currentVirtualTime / this.playbackSpeed)
        this.startTime = Date.now() - (this.currentVirtualTime / this.playbackSpeed);

        // If we were at end, reset
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
        // Save current virtual time
        // currentVirtualTime = (Date.now() - startTime) * speed
        this.currentVirtualTime = (Date.now() - this.startTime) * this.playbackSpeed;
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
        // Virtual time calculation must account for speed
        this.currentVirtualTime = (now - this.startTime) * this.playbackSpeed;

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
            // targetVirtualTime = nextEvent.timestamp
            // We need: (targetRealTime - startTime) * speed = targetVirtualTime
            // => targetRealTime = startTime + (targetVirtualTime / speed)

            const targetRealTime = this.startTime + (nextEvent.timestamp / this.playbackSpeed);
            const delay = Math.max(0, targetRealTime - Date.now());

            this.timeoutId = setTimeout(this.scheduleNext, delay);
        } else {
            // Schedule check for end of duration
            // EndTime = startTime + (duration / speed)
            const endRealTime = this.startTime + (this.recordingDuration / this.playbackSpeed);
            const delay = Math.max(0, endRealTime - Date.now());
            this.timeoutId = setTimeout(this.scheduleNext, delay + 10); // +10 buffer
        }
    }

    private emitWeight(weight: number) {
        useStore.getState().setCurrentWeight(weight);
        this.weight$.next(weight);
    }
}
