import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from './useStore';
import { weightLoggerService } from '../services/WeightLoggerService';
import { sessionRepository } from '../repositories/SessionRepository';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { DiscoveredDevice, LimitedPeripheralData } from '../services/bluetooth/types/ble.types';
import { settingsRepository } from '../repositories/SettingsRepository';
import { DEFAULT_BREWING_SCREEN_ID } from '../constants/brewingScreens';
import { brewingSessionService } from '../services/brewing/BrewingSessionService';
import { BrewingPhase } from '../services/interfaces/brewing.types';

const mockBrewingSessionService = vi.hoisted(() => ({
    state$: { value: 'idle' },
    session$: { value: null as BrewingSession | null },
    currentInfusion$: { value: null },
    timer$: { value: 0 },
    restoreSession: vi.fn(),
    clearSession: vi.fn(),
}));

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
        getActiveSession: vi.fn(),
        getSessionById: vi.fn(),
        deleteSession: vi.fn(),
        getSessionsByTeaName: vi.fn(),
        saveSession: vi.fn(),
    }
}));

vi.mock('../services/brewing/BrewingSessionService', () => ({
    brewingSessionService: mockBrewingSessionService,
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
            weightLoggerEnabled: false,
            playbackSpeed: 1,
            lastUsedBrewingScreen: DEFAULT_BREWING_SCREEN_ID,
            // WeightLogger
            isRecording: false,
            recordingStartTime: null,
            savedRecordings: [],
            // History
            sessionList: [],
            selectedSession: null,
            activeSession: null,
            currentInfusion: null,
            brewingPhase: 'idle' as any,
            timerValue: 0,
        });
        vi.clearAllMocks();
        (brewingSessionService.session$ as any).value = null;
        (brewingSessionService.state$ as any).value = BrewingPhase.IDLE;
        (brewingSessionService.currentInfusion$ as any).value = null;
        (brewingSessionService.timer$ as any).value = 0;
        (brewingSessionService.restoreSession as any).mockImplementation((session: BrewingSession) => {
            (brewingSessionService.session$ as any).value = session;
            (brewingSessionService.state$ as any).value = BrewingPhase.READY;
            (brewingSessionService.currentInfusion$ as any).value = null;
            (brewingSessionService.timer$ as any).value = 0;
        });
        (brewingSessionService.clearSession as any).mockImplementation(() => {
            (brewingSessionService.session$ as any).value = null;
            (brewingSessionService.state$ as any).value = BrewingPhase.IDLE;
            (brewingSessionService.currentInfusion$ as any).value = null;
            (brewingSessionService.timer$ as any).value = 0;
        });
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
            useStore.getState().updateSettings({ devMode: true, playbackSpeed: 2, lastUsedBrewingScreen: 4 });
            expect(useStore.getState().devMode).toBe(true);
            expect(useStore.getState().playbackSpeed).toBe(2);
            expect(useStore.getState().lastUsedBrewingScreen).toBe(4);
            expect(settingsRepository.saveSettingsState).toHaveBeenCalledWith({ devMode: true, playbackSpeed: 2, lastUsedBrewingScreen: 4 });
        });

        it('should load persisted brewing screen setting', async () => {
            (settingsRepository.getAllSettings as any).mockResolvedValue({
                lastUsedBrewingScreen: '5',
                devMode: 'true',
            });

            await useStore.getState().loadSettings();

            expect(useStore.getState().lastUsedBrewingScreen).toBe(5);
            expect(useStore.getState().devMode).toBe(true);
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

    describe('Brewing Slice', () => {
        it('should restore an active session through the brewing service', async () => {
            const activeSession = new BrewingSession();
            activeSession.sessionId = 'active-1';
            (sessionRepository.getActiveSession as any).mockResolvedValue(activeSession);

            await useStore.getState().restoreActiveSession();

            expect(sessionRepository.getActiveSession).toHaveBeenCalled();
            expect(brewingSessionService.restoreSession).toHaveBeenCalledWith(activeSession);
            expect(brewingSessionService.clearSession).not.toHaveBeenCalled();
            expect(useStore.getState().activeSession).toBe(activeSession);
            expect(useStore.getState().brewingPhase).toBe(BrewingPhase.READY);
        });

        it('should clear stale in-memory brewing state when no active session exists', async () => {
            useStore.setState({
                activeSession: new BrewingSession(),
                currentInfusion: {} as BrewingSession['infusions'][number],
                brewingPhase: 'rest' as any,
                timerValue: 1234,
            });
            (sessionRepository.getActiveSession as any).mockResolvedValue(null);

            await useStore.getState().restoreActiveSession();

            expect(brewingSessionService.clearSession).toHaveBeenCalled();
            expect(useStore.getState().activeSession).toBeNull();
            expect(useStore.getState().currentInfusion).toBeNull();
            expect(useStore.getState().timerValue).toBe(0);
        });
    });
});
