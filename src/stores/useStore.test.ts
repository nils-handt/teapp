import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from './useStore';
import { weightLoggerService } from '../services/WeightLoggerService';
import { sessionRepository } from '../repositories/SessionRepository';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { DiscoveredDevice, LimitedPeripheralData } from '../services/bluetooth/types/ble.types';

// Mock WeightLoggerService
vi.mock('../services/WeightLoggerService', () => ({
    weightLoggerService: {
        startRecording: vi.fn(),
        stopRecording: vi.fn(),
        saveRecording: vi.fn(),
        getRecordings: vi.fn().mockResolvedValue(['rec1.json']),
    }
}));

// Mock SessionRepository
vi.mock('../repositories/SessionRepository', () => ({
    sessionRepository: {
        getAllSessions: vi.fn(),
        getSessionById: vi.fn(),
        deleteSession: vi.fn(),
        getSessionsByTeaName: vi.fn(),
    }
}));

// Mock SettingsRepository
vi.mock('../repositories/SettingsRepository', () => ({
    settingsRepository: {
        saveSettingsState: vi.fn(),
        getAllSettings: vi.fn().mockResolvedValue({}),
    }
}));


describe('useStore', () => {
    beforeEach(() => {
        // Reset store state
        useStore.setState({
            connectedDevice: null,
            connectionStatus: 'disconnected',
            currentWeight: 0,
            availableDevices: [],
            isScanning: false,
            // Settings
            scaleConfig: {},
            devMode: false,
            // WeightLogger
            isRecording: false,
            recordingStartTime: null,
            savedRecordings: [],
            // History
            sessionList: [],
            selectedSession: null,
        });
        vi.clearAllMocks();
    });

    describe('Bluetooth Slice', () => {
        const mockPeripheral: LimitedPeripheralData = {
            id: 'test', name: 'Test', advertising: new ArrayBuffer(0), rssi: -50
        };
        const device: DiscoveredDevice = {
            id: 'test', name: 'Test', rssi: -50, scaleType: null, peripheral: mockPeripheral
        };

        it('should add discovered device', () => {
            useStore.getState().addDiscoveredDevice(device);
            expect(useStore.getState().availableDevices).toContainEqual(device);
        });

        it('should update existing device', () => {
            useStore.getState().addDiscoveredDevice(device);
            const updatedDevice = { ...device, rssi: -40 };
            useStore.getState().addDiscoveredDevice(updatedDevice);

            expect(useStore.getState().availableDevices).toHaveLength(1);
            expect(useStore.getState().availableDevices[0].rssi).toBe(-40);
        });

        it('should set connection status', () => {
            useStore.getState().setConnectionStatus('connecting');
            expect(useStore.getState().connectionStatus).toBe('connecting');
        });

        it('should set connected device', () => {
            useStore.getState().setConnectedDevice(device);
            expect(useStore.getState().connectedDevice).toEqual(device);
        });
    });

    describe('Settings Slice', () => {
        it('should update settings', () => {
            useStore.getState().updateSettings({ devMode: true, playbackSpeed: 2 });
            expect(useStore.getState().devMode).toBe(true);
            expect(useStore.getState().playbackSpeed).toBe(2);
        });
    });

    describe('WeightLogger Slice', () => {
        it('should start recording', () => {
            useStore.getState().startRecording();

            expect(weightLoggerService.startRecording).toHaveBeenCalled();
            expect(useStore.getState().isRecording).toBe(true);
            expect(useStore.getState().recordingStartTime).not.toBeNull();
        });

        it('should stop recording and save', async () => {
            useStore.setState({ isRecording: true, recordingStartTime: 12345 });

            await useStore.getState().stopRecording('My Session', 'Notes');

            expect(weightLoggerService.stopRecording).toHaveBeenCalled();
            expect(weightLoggerService.saveRecording).toHaveBeenCalledWith('My Session', 'Notes');
            expect(weightLoggerService.getRecordings).toHaveBeenCalled();

            expect(useStore.getState().isRecording).toBe(false);
            expect(useStore.getState().recordingStartTime).toBeNull();
            expect(useStore.getState().savedRecordings).toEqual(['rec1.json']);
        });
    });

    describe('History Slice', () => {
        const mockSessions = [new BrewingSession(), new BrewingSession()];
        const mockSession = new BrewingSession();

        it('should load history', async () => {
            (sessionRepository.getAllSessions as any).mockResolvedValue(mockSessions);

            await useStore.getState().loadHistory();

            expect(sessionRepository.getAllSessions).toHaveBeenCalled();
            expect(useStore.getState().sessionList).toBe(mockSessions);
        });

        it('should select session', async () => {
            (sessionRepository.getSessionById as any).mockResolvedValue(mockSession);

            await useStore.getState().selectSession('123');

            expect(sessionRepository.getSessionById).toHaveBeenCalledWith('123');
            expect(useStore.getState().selectedSession).toBe(mockSession);
        });

        it('should delete session', async () => {
            (sessionRepository.getAllSessions as any).mockResolvedValue(mockSessions);

            await useStore.getState().deleteSession('123');

            expect(sessionRepository.deleteSession).toHaveBeenCalledWith('123');
            expect(sessionRepository.getAllSessions).toHaveBeenCalled();
            expect(useStore.getState().sessionList).toBe(mockSessions);
            expect(useStore.getState().selectedSession).toBeNull();
        });

        it('should filter history by tea', async () => {
            (sessionRepository.getSessionsByTeaName as any).mockResolvedValue(mockSessions);

            await useStore.getState().filterHistoryByTea('Oolong');

            expect(sessionRepository.getSessionsByTeaName).toHaveBeenCalledWith('Oolong');
            expect(useStore.getState().sessionList).toBe(mockSessions);
        });
    });
});
