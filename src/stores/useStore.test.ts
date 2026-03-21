import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore, type StoreState } from './useStore';
import { weightLoggerService } from '../services/WeightLoggerService';
import { sessionRepository } from '../repositories/SessionRepository';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Infusion } from '../entities/Infusion.entity';
import { DiscoveredDevice, LimitedPeripheralData } from '../services/bluetooth/types/ble.types';
import { settingsRepository } from '../repositories/SettingsRepository';
import { DEFAULT_BREWING_SCREEN_ID } from '../constants/brewingScreens';
import { brewingSessionService } from '../services/brewing/BrewingSessionService';
import { BrewingPhase } from '../services/interfaces/brewing.types';
import { configureLogger, DEFAULT_LOGGER_CONFIG } from '../services/logging';

const mockBrewingSessionService = vi.hoisted(() => ({
    state$: { value: 'idle' },
    session$: { value: null as BrewingSession | null },
    currentInfusion$: { value: null },
    timer$: { value: 0 },
    restoreSession: vi.fn(),
    clearSession: vi.fn(),
}));

const mockLogger = vi.hoisted(() => ({
    configureLogger: vi.fn(),
    createLogger: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
    })),
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
        getKnownTeaNames: vi.fn(),
        deleteSession: vi.fn(),
        getSessionsByTeaName: vi.fn(),
        saveSession: vi.fn(),
    }
}));

vi.mock('../services/brewing/BrewingSessionService', () => ({
    brewingSessionService: mockBrewingSessionService,
}));

vi.mock('../services/logging', async () => {
    const actual = await vi.importActual<typeof import('../services/logging')>('../services/logging');

    return {
        ...actual,
        configureLogger: mockLogger.configureLogger,
        createLogger: mockLogger.createLogger,
    };
});

// Mock SettingsRepository
vi.mock('../repositories/SettingsRepository', () => ({
    settingsRepository: {
        saveSettingsState: vi.fn(),
        getAllSettings: vi.fn().mockResolvedValue({}),
    }
}));

type MutableSubject<T> = {
    value: T;
};

const sessionSubject = brewingSessionService.session$ as unknown as MutableSubject<BrewingSession | null>;
const stateSubject = brewingSessionService.state$ as unknown as MutableSubject<BrewingPhase>;
const currentInfusionSubject = brewingSessionService.currentInfusion$ as unknown as MutableSubject<StoreState['currentInfusion']>;
const timerSubject = brewingSessionService.timer$ as unknown as MutableSubject<number>;

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
            logLevel: DEFAULT_LOGGER_CONFIG.minLevel,
            logToFileEnabled: DEFAULT_LOGGER_CONFIG.enableFileLogging,
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
            knownTeaNames: [],
            activeSession: null,
            currentInfusion: null,
            brewingPhase: BrewingPhase.IDLE,
            timerValue: 0,
        });
        vi.clearAllMocks();
        sessionSubject.value = null;
        stateSubject.value = BrewingPhase.IDLE;
        currentInfusionSubject.value = null;
        timerSubject.value = 0;
        vi.mocked(brewingSessionService.restoreSession).mockImplementation((session: BrewingSession) => {
            sessionSubject.value = session;
            stateSubject.value = BrewingPhase.READY;
            currentInfusionSubject.value = null;
            timerSubject.value = 0;
        });
        vi.mocked(brewingSessionService.clearSession).mockImplementation(() => {
            sessionSubject.value = null;
            stateSubject.value = BrewingPhase.IDLE;
            currentInfusionSubject.value = null;
            timerSubject.value = 0;
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
        it('should start with default logger settings before persisted settings load', () => {
            expect(useStore.getState().logLevel).toBe(DEFAULT_LOGGER_CONFIG.minLevel);
            expect(useStore.getState().logToFileEnabled).toBe(DEFAULT_LOGGER_CONFIG.enableFileLogging);
        });

        it('should update settings', () => {
            useStore.getState().updateSettings({ devMode: true, playbackSpeed: 2, lastUsedBrewingScreen: 4 });
            expect(useStore.getState().devMode).toBe(true);
            expect(useStore.getState().playbackSpeed).toBe(2);
            expect(useStore.getState().lastUsedBrewingScreen).toBe(4);
            expect(settingsRepository.saveSettingsState).toHaveBeenCalledWith({ devMode: true, playbackSpeed: 2, lastUsedBrewingScreen: 4 });
            expect(configureLogger).not.toHaveBeenCalled();
        });

        it('should push logger settings into the runtime logger on update', () => {
            useStore.getState().updateSettings({ logLevel: 'warn', logToFileEnabled: true });

            expect(useStore.getState().logLevel).toBe('warn');
            expect(useStore.getState().logToFileEnabled).toBe(true);
            expect(settingsRepository.saveSettingsState).toHaveBeenCalledWith({ logLevel: 'warn', logToFileEnabled: true });
            expect(configureLogger).toHaveBeenCalledWith({ minLevel: 'warn', enableFileLogging: true });
        });

        it('should load persisted brewing screen setting', async () => {
            vi.mocked(settingsRepository.getAllSettings).mockResolvedValue({
                lastUsedBrewingScreen: '5',
                devMode: 'true',
            });

            await useStore.getState().loadSettings();

            expect(useStore.getState().lastUsedBrewingScreen).toBe(5);
            expect(useStore.getState().devMode).toBe(true);
        });

        it('should load persisted logger settings and apply them to the runtime logger', async () => {
            vi.mocked(settingsRepository.getAllSettings).mockResolvedValue({
                logLevel: 'error',
                logToFileEnabled: 'true',
            });

            await useStore.getState().loadSettings();

            expect(useStore.getState().logLevel).toBe('error');
            expect(useStore.getState().logToFileEnabled).toBe(true);
            expect(configureLogger).toHaveBeenCalledWith({ minLevel: 'error', enableFileLogging: true });
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
            vi.mocked(sessionRepository.getAllSessions).mockResolvedValue(mockSessions);

            await useStore.getState().loadHistory();

            expect(sessionRepository.getAllSessions).toHaveBeenCalled();
            expect(useStore.getState().sessionList).toBe(mockSessions);
        });

        it('should load known tea names once by default', async () => {
            vi.mocked(sessionRepository.getKnownTeaNames).mockResolvedValue(['ORT 2015 Gao Jia Shan']);

            await useStore.getState().loadKnownTeaNames();
            await useStore.getState().loadKnownTeaNames();

            expect(sessionRepository.getKnownTeaNames).toHaveBeenCalledTimes(1);
            expect(useStore.getState().knownTeaNames).toEqual(['ORT 2015 Gao Jia Shan']);
        });

        it('should allow known tea names to be refreshed explicitly', async () => {
            vi.mocked(sessionRepository.getKnownTeaNames)
                .mockResolvedValueOnce(['ORT 2015 Gao Jia Shan'])
                .mockResolvedValueOnce(['Morning Sencha']);

            await useStore.getState().loadKnownTeaNames();
            await useStore.getState().loadKnownTeaNames(true);

            expect(sessionRepository.getKnownTeaNames).toHaveBeenCalledTimes(2);
            expect(useStore.getState().knownTeaNames).toEqual(['Morning Sencha']);
        });

        it('should upsert tea names into the known tea name cache', () => {
            useStore.setState({ knownTeaNames: ['Morning Sencha'] });

            useStore.getState().upsertKnownTeaName('ORT 2015 Gao Jia Shan');
            useStore.getState().upsertKnownTeaName('morning sencha');

            expect(useStore.getState().knownTeaNames).toEqual(['morning sencha', 'ORT 2015 Gao Jia Shan']);
        });

        it('should select session', async () => {
            vi.mocked(sessionRepository.getSessionById).mockResolvedValue(mockSession);

            await useStore.getState().selectSession('123');

            expect(sessionRepository.getSessionById).toHaveBeenCalledWith('123');
            expect(useStore.getState().selectedSession).toBe(mockSession);
        });

        it('should delete session', async () => {
            vi.mocked(sessionRepository.getAllSessions).mockResolvedValue(mockSessions);

            await useStore.getState().deleteSession('123');

            expect(sessionRepository.deleteSession).toHaveBeenCalledWith('123');
            expect(sessionRepository.getAllSessions).toHaveBeenCalled();
            expect(useStore.getState().sessionList).toBe(mockSessions);
            expect(useStore.getState().selectedSession).toBeNull();
        });

        it('should filter history by tea', async () => {
            vi.mocked(sessionRepository.getSessionsByTeaName).mockResolvedValue(mockSessions);

            await useStore.getState().filterHistoryByTea('Oolong');

            expect(sessionRepository.getSessionsByTeaName).toHaveBeenCalledWith('Oolong');
            expect(useStore.getState().sessionList).toBe(mockSessions);
        });
    });

    describe('Brewing Slice', () => {
        it('should restore an active session through the brewing service', async () => {
            const activeSession = new BrewingSession();
            activeSession.sessionId = 'active-1';
            vi.mocked(sessionRepository.getActiveSession).mockResolvedValue(activeSession);

            await useStore.getState().restoreActiveSession();

            expect(sessionRepository.getActiveSession).toHaveBeenCalled();
            expect(brewingSessionService.restoreSession).toHaveBeenCalledWith(activeSession);
            expect(brewingSessionService.clearSession).not.toHaveBeenCalled();
            expect(useStore.getState().activeSession).toBe(activeSession);
            expect(useStore.getState().brewingPhase).toBe(BrewingPhase.READY);
        });

        it('should clear stale in-memory brewing state when no active session exists', async () => {
            const staleInfusion = new Infusion();
            staleInfusion.infusionId = 'stale-inf';
            staleInfusion.infusionNumber = 1;
            staleInfusion.waterWeight = 85;
            staleInfusion.startTime = new Date().toISOString();
            staleInfusion.duration = 12;
            staleInfusion.restDuration = 0;
            staleInfusion.wetTeaLeavesWeight = 16;
            staleInfusion.sessionId = 'stale-session';

            useStore.setState({
                activeSession: new BrewingSession(),
                currentInfusion: staleInfusion,
                brewingPhase: BrewingPhase.REST,
                timerValue: 1234,
            });
            vi.mocked(sessionRepository.getActiveSession).mockResolvedValue(null);

            await useStore.getState().restoreActiveSession();

            expect(brewingSessionService.clearSession).toHaveBeenCalled();
            expect(useStore.getState().activeSession).toBeNull();
            expect(useStore.getState().currentInfusion).toBeNull();
            expect(useStore.getState().timerValue).toBe(0);
        });
    });
});
