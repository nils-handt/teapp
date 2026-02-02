import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { MockScaleService } from './MockScaleService';
import { useStore } from '../stores/useStore';

// Mock the store
vi.mock('../stores/useStore', () => ({
    useStore: {
        getState: vi.fn(),
    },
}));

describe('MockScaleService', () => {
    let service: MockScaleService;
    let mockSetCurrentWeight: Mock;
    let mockSetConnectionStatus: Mock;
    let mockSetConnectedDevice: Mock;

    const originalRecordingData = [
        { "timestamp": 1760000001000, "weight": 50 },
        { "timestamp": 1760000002000, "weight": 100 },
        { "timestamp": 1760000003000, "weight": 25 }
    ];

    const fastRecordingData = [
        { "timestamp": 1760000000001, "weight": 10 },
        { "timestamp": 1760000000002, "weight": 20 },
        { "timestamp": 1760000000003, "weight": 30 }
    ];

    const slowRecordingData = [
        { "timestamp": 1760000000000, "weight": 5 },
        { "timestamp": 1760000010000, "weight": 10 }, // 10s later
        { "timestamp": 1760000020000, "weight": 15 }  // another 10s later
    ];

    beforeEach(() => {
        vi.useFakeTimers();

        // Setup store mocks
        mockSetCurrentWeight = vi.fn();
        mockSetConnectionStatus = vi.fn();
        mockSetConnectedDevice = vi.fn();

        (useStore.getState as Mock).mockReturnValue({
            playbackSpeed: 1,
            setConnectionStatus: mockSetConnectionStatus,
            setConnectedDevice: mockSetConnectedDevice,
            setCurrentWeight: mockSetCurrentWeight,
        });

        service = new MockScaleService();
        service.initialize();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    const verifyReplay = (data: { timestamp: number, weight: number }[], speed: number = 1) => {
        service.loadRecording(data);
        if (speed !== 1) {
            service.setPlaybackSpeed(speed);
        }
        service.startReplay();

        // Initial emission
        expect(mockSetCurrentWeight).toHaveBeenLastCalledWith(data[0].weight);

        for (let i = 1; i < data.length; i++) {
            const previousTime = data[i - 1].timestamp;
            const currentTime = data[i].timestamp;

            // Calculate delay based on original timestamps
            const rawDiff = currentTime - previousTime;

            // Adjust for playback speed
            // if speed is 2x, we wait half the time
            const waitTime = rawDiff / speed;

            // Advance time
            vi.advanceTimersByTime(waitTime);

            // Assertion
            expect(mockSetCurrentWeight).toHaveBeenLastCalledWith(data[i].weight);
        }
    };

    it('should replay weights in correct order for original recording', () => {
        verifyReplay(originalRecordingData);
    });

    it('should replay weights in correct order for fast recording (1ms delay)', () => {
        verifyReplay(fastRecordingData);
    });

    it('should replay weights in correct order for slow recording (10s delay)', () => {
        verifyReplay(slowRecordingData);
    });

    it('should respect playback speed (2x)', () => {
        // Using original data but running at 2x speed
        verifyReplay(originalRecordingData, 2);
    });
});
