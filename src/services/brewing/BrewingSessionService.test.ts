import { describe, it, expect, vi, beforeEach, afterEach, onTestFailed, onTestFinished } from 'vitest';
import { brewingSessionService } from './BrewingSessionService';
import { BrewingPhase } from '../interfaces/brewing.types';
import { bluetoothScaleService } from '../BluetoothScaleService';
import { sessionRepository } from '../../repositories/SessionRepository'; // We need to mock this
import { brewingVesselRepository } from '../../repositories/BrewingVesselRepository';
import { BrewingSession } from '../../entities/BrewingSession.entity';
import { BrewingVessel } from '../../entities/BrewingVessel.entity';
import { Infusion } from '../../entities/Infusion.entity';

// Mock dependencies
vi.mock('../../repositories/SessionRepository', () => ({
    sessionRepository: {
        saveSession: vi.fn(),
    },
}));

vi.mock('../../repositories/BrewingVesselRepository', () => ({
    brewingVesselRepository: {
        findSimilarVessel: vi.fn(),
        saveBrewingVessel: vi.fn(),
    },
}));

import fs from 'fs';
import path from 'path';

type ScenarioActionName = 'confirmSetupDone' | 'endSession' | 'startSession';

type ScenarioAction = {
    action: ScenarioActionName;
    timestamp: number;
};

type ScenarioDataPoint = {
    timestamp: number;
    weight: number;
};

type ScenarioFile = {
    actions?: ScenarioAction[];
    data: ScenarioDataPoint[];
};

type ExpectedInfusionResult = {
    duration: number | string;
    restDuration?: number | string | null;
    waterWeight: number | string;
    wetTeaLeavesWeight: number | string;
};

type ExpectedSessionResult = {
    currentWasteWater?: number | string | null;
    dryTeaLeavesWeight: number | string;
    infusions: ExpectedInfusionResult[];
    lidWeight: number | string;
    status: string;
    teaName: string;
    vesselWeight: number | string;
};

type SerializableInfusion = Omit<Infusion, 'session'> & {
    session?: BrewingSession;
};

const stripSessionReference = (infusion: Infusion): Omit<Infusion, 'session'> => {
    const serializableInfusion: SerializableInfusion = { ...infusion };
    delete serializableInfusion.session;
    return serializableInfusion;
};

const toSerializableSession = (session: BrewingSession | null) => (
    session
        ? {
            ...session,
            infusions: session.infusions.map(stripSessionReference),
        }
        : null
);

describe('BrewingSessionService', () => {
    const flushAsyncWork = async () => {
        await Promise.resolve();
        await Promise.resolve();
    };

    beforeEach(() => {
        vi.useFakeTimers();
        brewingSessionService.resetForTest();
        vi.clearAllMocks();
        vi.mocked(brewingVesselRepository.findSimilarVessel).mockResolvedValue(null);
    });

    afterEach(async () => {
        vi.useRealTimers();

        // Ensure mock scale stops emitting between tests
        if (bluetoothScaleService.mock) {
            bluetoothScaleService.mock.stopReplay();
        }
        await bluetoothScaleService.disconnect();
    });

    it('should be in ENDED state after reset', () => {
        expect(brewingSessionService.state$.value).toBe(BrewingPhase.ENDED);
    });

    it('should transition to SETUP when starting a session', () => {
        brewingSessionService.startSession('Test Tea');
        expect(brewingSessionService.state$.value).toBe(BrewingPhase.SETUP);
        expect(brewingSessionService.session$.value?.teaName).toBe('Test Tea');
    });

    it('should restore a saved session with setup data into READY', () => {
        const session = new BrewingSession();
        session.sessionId = 'restored-ready';
        session.status = 'active';
        session.startTime = new Date().toISOString();
        session.teaName = 'Recovered Tea';
        session.infusions = [];
        session.vesselWeight = 95;
        session.lidWeight = 12;
        session.trayWeight = 0;
        session.dryTeaLeavesWeight = 6;
        session.currentWasteWater = 0;

        brewingSessionService.restoreSession(session);

        expect(brewingSessionService.session$.value?.sessionId).toBe('restored-ready');
        expect(brewingSessionService.state$.value).toBe(BrewingPhase.READY);
        expect(brewingSessionService.currentInfusion$.value).toBeNull();
        expect(brewingSessionService.timer$.value).toBe(0);
    });

    it('should restore a saved session with prior infusions into REST', () => {
        const session = new BrewingSession();
        session.sessionId = 'restored-rest';
        session.status = 'active';
        session.startTime = new Date().toISOString();
        session.teaName = 'Recovered Tea';
        session.vesselWeight = 95;
        session.lidWeight = 12;
        session.trayWeight = 0;
        session.dryTeaLeavesWeight = 6;
        session.currentWasteWater = 4;

        const infusion = new Infusion();
        infusion.infusionId = 'inf-1';
        infusion.infusionNumber = 1;
        infusion.wetTeaLeavesWeight = 18;
        infusion.duration = 15;
        session.infusions = [infusion];

        brewingSessionService.restoreSession(session);

        expect(brewingSessionService.session$.value?.sessionId).toBe('restored-rest');
        expect(brewingSessionService.state$.value).toBe(BrewingPhase.REST);
        expect(brewingSessionService.currentInfusion$.value).toBeNull();
        expect(brewingSessionService.timer$.value).toBe(0);
    });

    it('should detect vessel and confirm setup', () => {
        brewingSessionService.startSession('Test Tea');

        // Simulate vessel placement (> 20g)
        bluetoothScaleService.weight$.next(100);
        vi.advanceTimersByTime(1000); // Debounce

        // NEW: Verify session is updated immediately without confirming
        expect(brewingSessionService.session$.value?.vesselWeight).toBe(100);

        // Simulate lid removal (drop > 5g)
        bluetoothScaleService.weight$.next(80); // 20g drop
        vi.advanceTimersByTime(1000);

        // NEW: Verify session updated immediately
        expect(brewingSessionService.session$.value?.lidWeight).toBe(20);
        expect(brewingSessionService.session$.value?.vesselWeight).toBe(80);

        // Confirm setup
        brewingSessionService.confirmSetupDone();

        expect(brewingSessionService.state$.value).toBe(BrewingPhase.READY);
        expect(brewingSessionService.session$.value?.vesselWeight).toBe(80);
        expect(brewingSessionService.session$.value?.lidWeight).toBe(20);
    });

    it('should manually update tea name during an active session', () => {
        brewingSessionService.startSession('Initial Tea');

        brewingSessionService.updateTeaName('Updated Tea');

        expect(brewingSessionService.session$.value?.teaName).toBe('Updated Tea');
        expect(sessionRepository.saveSession).toHaveBeenCalledWith(
            expect.objectContaining({ teaName: 'Updated Tea' })
        );
    });

    it('should attach a matching brewing vessel when setup weights change', async () => {
        const brewingVessel = new BrewingVessel();
        brewingVessel.vesselId = 'vessel-1';
        brewingVessel.name = 'Silver Gaiwan';
        brewingVessel.vesselWeight = 92.3;
        brewingVessel.lidWeight = 18.8;
        vi.mocked(brewingVesselRepository.findSimilarVessel).mockResolvedValue(brewingVessel);

        brewingSessionService.startSession('Test Tea');
        brewingSessionService.updateSetupValue('vesselWeight', 92.34);
        brewingSessionService.updateSetupValue('lidWeight', 18.76);
        await flushAsyncWork();

        expect(brewingSessionService.session$.value?.brewingVessel?.name).toBe('Silver Gaiwan');
        expect(brewingSessionService.session$.value?.brewingVesselId).toBe('vessel-1');
    });

    it('should save a brewing vessel from the current session weights', async () => {
        const savedBrewingVessel = new BrewingVessel();
        savedBrewingVessel.vesselId = 'vessel-2';
        savedBrewingVessel.name = 'Clay Pot';
        savedBrewingVessel.vesselWeight = 110;
        savedBrewingVessel.lidWeight = 22;
        vi.mocked(brewingVesselRepository.saveBrewingVessel).mockResolvedValue(savedBrewingVessel);

        brewingSessionService.startSession('Test Tea');
        brewingSessionService.updateSetupValue('vesselWeight', 110);
        brewingSessionService.updateSetupValue('lidWeight', 22);
        brewingSessionService.updateBrewingVesselName('Clay Pot');
        await flushAsyncWork();

        expect(brewingVesselRepository.saveBrewingVessel).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Clay Pot',
                vesselWeight: 110,
                lidWeight: 22,
            })
        );
        expect(brewingSessionService.session$.value?.brewingVessel?.name).toBe('Clay Pot');
        expect(brewingSessionService.session$.value?.brewingVesselId).toBe('vessel-2');
    });

    it('should manually override setup values during setup', () => {
        brewingSessionService.startSession('Test Tea');

        brewingSessionService.updateSetupValue('vesselWeight', 92.34);
        brewingSessionService.updateSetupValue('lidWeight', 18.76);
        brewingSessionService.updateSetupValue('trayWeight', 120.12);
        brewingSessionService.updateSetupValue('dryTeaLeavesWeight', 7.49);

        expect(brewingSessionService.session$.value).toEqual(
            expect.objectContaining({
                vesselWeight: 92.3,
                lidWeight: 18.8,
                trayWeight: 120.1,
                dryTeaLeavesWeight: 7.5,
            })
        );
    });

    it('should ignore setup overrides outside setup phase', () => {
        brewingSessionService.startSession('Test Tea');
        brewingSessionService.updateSetupValue('vesselWeight', 88);
        brewingSessionService.confirmSetupDone();
        vi.clearAllMocks();

        brewingSessionService.updateSetupValue('vesselWeight', 140);

        expect(brewingSessionService.session$.value?.vesselWeight).toBe(88);
        expect(sessionRepository.saveSession).not.toHaveBeenCalled();
    });

    it('should start infusion when water is added', () => {
        // Setup state
        brewingSessionService.startSession('Test Tea');
        // Fake setup values
        bluetoothScaleService.weight$.next(100); // Vessel
        vi.advanceTimersByTime(1000);
        brewingSessionService.confirmSetupDone();

        expect(brewingSessionService.state$.value).toBe(BrewingPhase.READY);

        // Add water (increase > 5g)
        bluetoothScaleService.weight$.next(150); // +50g water
        vi.advanceTimersByTime(1000);

        expect(brewingSessionService.state$.value).toBe(BrewingPhase.INFUSION);
        expect(brewingSessionService.currentInfusion$.value).toBeTruthy();
        expect(brewingSessionService.currentInfusion$.value?.infusionNumber).toBe(1);
    });

    it('should handle vessel lift during infusion', () => {
        // ... Previous steps to reach INFUSION
        brewingSessionService.startSession('Test Tea');
        bluetoothScaleService.weight$.next(100);
        vi.advanceTimersByTime(1000);
        brewingSessionService.confirmSetupDone();
        bluetoothScaleService.weight$.next(150);
        vi.advanceTimersByTime(1000);

        expect(brewingSessionService.state$.value).toBe(BrewingPhase.INFUSION);

        // Lift vessel
        bluetoothScaleService.weight$.next(0);
        vi.advanceTimersByTime(1000);

        expect(brewingSessionService.state$.value).toBe(BrewingPhase.INFUSION_VESSEL_LIFTED);
    });

    it('should end infusion when poured out and vessel returned', () => {
        // ... Reach INFUSION
        brewingSessionService.startSession('Test Tea');
        bluetoothScaleService.weight$.next(100); // Vessel
        vi.advanceTimersByTime(1000);
        brewingSessionService.confirmSetupDone();
        // Ready. weight is 100.

        bluetoothScaleService.weight$.next(200); // +100g water
        vi.advanceTimersByTime(1000);
        expect(brewingSessionService.state$.value).toBe(BrewingPhase.INFUSION);

        // Lift
        bluetoothScaleService.weight$.next(0);
        vi.advanceTimersByTime(1000);
        expect(brewingSessionService.state$.value).toBe(BrewingPhase.INFUSION_VESSEL_LIFTED);

        // Return empty (approx 100 + wet leaves)
        // Let's say wet leaves add 10g. Return weight 110.
        // This is significantly less than 200 (start of infusion).
        bluetoothScaleService.weight$.next(110);
        vi.advanceTimersByTime(1000);

        expect(brewingSessionService.state$.value).toBe(BrewingPhase.REST);
        expect(brewingSessionService.currentInfusion$.value?.duration).toBeDefined();
        // Since we didn't advance time much, duration is 0, but it should be saved.
        // check repository save call
        expect(sessionRepository.saveSession).toHaveBeenCalled();
    });

    // Dynamic test loading for all .json scenarios in testfiles
    const testFilesDir = path.resolve(__dirname, 'testfiles');
    const testFiles = fs.readdirSync(testFilesDir).filter(file => file.endsWith('.json') && !file.includes('.result.'));

    // optional: performance: these tests are slow and could easily be run in a separate process.
    // That might require splitting the test file into multiple files / using an auto generated test file per scenario which would be annoying.
    // Delay until performance becomes an issue.
    testFiles.forEach(file => {
        it(`should validate scenario ${file}`, async () => {
            // Enable mock mode
            await bluetoothScaleService.setMockMode(true);
            const mockScale = bluetoothScaleService.mock;

            // Load scenario data
            const scenarioPath = path.join(testFilesDir, file);
            const scenarioContent = fs.readFileSync(scenarioPath, 'utf8');
            const scenarioData = JSON.parse(scenarioContent) as ScenarioFile;

            // Load into mock scale
            mockScale.loadRecording(scenarioData.data);
            // Start replay
            mockScale.startReplay();

            const data = scenarioData.data;
            const actions = scenarioData.actions || [];
            let nextActionIndex = 0;

            // We need to keep track of the latest non-null session
            let lastKnownSession = brewingSessionService.session$.value;
            const sub = brewingSessionService.session$.subscribe(s => {
                if (s) lastKnownSession = s;
            });

            if (data.length > 0) {
                // The simulation starts at the time of the first data point
                let currentSimulationTime = data[0].timestamp;
                let currentAction: ScenarioAction | null = nextActionIndex < actions.length ? actions[nextActionIndex] : null;

                for (let i = 1; i < data.length; i++) {
                    const dataTimestamp = data[i].timestamp;

                    // Check if any actions need to be performed before reaching the next data timestamp
                    while (currentAction && currentAction.timestamp <= dataTimestamp) {
                        const timeUntilAction = currentAction.timestamp - currentSimulationTime;

                        if (timeUntilAction > 0) {
                            vi.advanceTimersByTime(timeUntilAction);
                            currentSimulationTime += timeUntilAction;
                        }

                        // Execute Action
                        switch (currentAction.action) {
                            case 'startSession':
                                brewingSessionService.startSession('Scenario Tea');
                                break;
                            case 'confirmSetupDone':
                                brewingSessionService.confirmSetupDone();
                                break;
                            case 'endSession':
                                brewingSessionService.endSession();
                                break;
                            default:
                                console.warn(`Unknown action: ${currentAction.action}`);
                        }
                        nextActionIndex++;
                        currentAction = nextActionIndex < actions.length ? actions[nextActionIndex] : null;
                    }

                    // Advance to the data timestamp
                    const timeUntilData = dataTimestamp - currentSimulationTime;
                    if (timeUntilData > 0) {
                        vi.advanceTimersByTime(timeUntilData);
                        currentSimulationTime += timeUntilData;
                    }
                }

                // Convert any remaining actions after the last data point
                while (currentAction) {
                    const timeUntilAction = currentAction.timestamp - currentSimulationTime;

                    if (timeUntilAction > 0) {
                        vi.advanceTimersByTime(timeUntilAction);
                        currentSimulationTime += timeUntilAction;
                    }

                    switch (currentAction.action) {
                        case 'startSession':
                            brewingSessionService.startSession('Scenario Tea');
                            break;
                        case 'confirmSetupDone':
                            brewingSessionService.confirmSetupDone();
                            break;
                        case 'endSession':
                            brewingSessionService.endSession();
                            break;
                        default:
                            console.warn(`Unknown action: ${currentAction.action}`);
                    }
                    nextActionIndex++;
                    currentAction = nextActionIndex < actions.length ? actions[nextActionIndex] : null;
                }

                // Advance a bit more to ensure any final logic triggers
                vi.advanceTimersByTime(2000);
            }

            // Cleanup subscription
            sub.unsubscribe();

            // Use the last known session
            let resultingSession = lastKnownSession;
            // Simulate end of session if not auto-ended?
            if (resultingSession?.status === 'active') {
                await brewingSessionService.endSession();
                // update resultingSession status, but keep data
                resultingSession = Object.assign(new BrewingSession(), resultingSession, { status: 'completed' });
            }
            const resultPath = path.resolve(testFilesDir, file.replace('.json', '.result.json'));
            const resultPathDebug = path.resolve(testFilesDir, file.replace('.json', '.result.debug.json'));

            // Hook to write debug file on failure
            onTestFailed(() => {
                const simpleSession = toSerializableSession(resultingSession);
                fs.writeFileSync(resultPathDebug, JSON.stringify(simpleSession, null, 2));
                console.log(`Test failed. Debug result written to ${resultPathDebug}`);
            });

            onTestFinished(({ task }) => {
                if (task.result?.state === 'pass') {
                    if (fs.existsSync(resultPathDebug)) {
                        fs.unlinkSync(resultPathDebug);
                    }
                }
            });

            if (fs.existsSync(resultPath)) {
                const expectedResult = JSON.parse(fs.readFileSync(resultPath, 'utf8')) as ExpectedSessionResult;

                // Fuzzy comparison configuration
                const WEIGHT_TOLERANCE = 2; // grams
                const TIME_TOLERANCE = 2; // seconds

                const assertClose = (actual: number, expected: number | string, tolerance: number, label: string) => {
                    if (typeof expected !== 'string' || !expected.startsWith('skip')) { // allow results to be skipped by prefixing 'skip' to the expected value
                        const diff = Math.abs(actual - Number(expected));
                        expect.soft(diff, `Mismatch in ${label}: expected ${expected}, got ${actual} (diff ${diff})`).toBeLessThanOrEqual(tolerance);
                    }
                };

                const compareSessions = (actual: BrewingSession | null, expected: ExpectedSessionResult) => {
                    expect(actual).toBeTruthy();
                    if (!actual) {
                        return;
                    }

                    expect(actual.teaName).toBe(expected.teaName);
                    expect(actual.status).toBe(expected.status);
                    // Notes might be undefined/empty string mismatch, strict check is fine usually

                    assertClose(actual.vesselWeight, expected.vesselWeight, WEIGHT_TOLERANCE, 'vesselWeight');
                    assertClose(actual.lidWeight, expected.lidWeight, WEIGHT_TOLERANCE, 'lidWeight');
                    assertClose(actual.dryTeaLeavesWeight, expected.dryTeaLeavesWeight, WEIGHT_TOLERANCE, 'dryTeaLeavesWeight');

                    if (expected.currentWasteWater !== undefined && expected.currentWasteWater !== null) {
                        assertClose(actual.currentWasteWater || 0, expected.currentWasteWater, WEIGHT_TOLERANCE, 'currentWasteWater');
                    }

                    expect(actual.infusions.length).toBe(expected.infusions.length);

                    actual.infusions.forEach((actInf, index) => {
                        const expectedInfusion = expected.infusions[index];
                        assertClose(actInf.waterWeight, expectedInfusion.waterWeight, WEIGHT_TOLERANCE, `infusion[${index}].waterWeight`);
                        assertClose(actInf.wetTeaLeavesWeight, expectedInfusion.wetTeaLeavesWeight, WEIGHT_TOLERANCE, `infusion[${index}].wetTeaLeavesWeight`);

                        // Duration is numeric seconds (integer)
                        assertClose(actInf.duration, expectedInfusion.duration, TIME_TOLERANCE, `infusion[${index}].duration`);

                        // Rest duration 
                        if (expectedInfusion.restDuration !== undefined && expectedInfusion.restDuration !== null) {
                            assertClose(actInf.restDuration || 0, expectedInfusion.restDuration, TIME_TOLERANCE, `infusion[${index}].restDuration`);
                        }
                    });
                };

                compareSessions(resultingSession, expectedResult);

            } else {
                // Fail test if result file is missing (to prompt creation via debug file logic if needed, or manual creation)
                // Write debug file explicitly so we can see what was generated
                const simpleSession = toSerializableSession(resultingSession);
                fs.writeFileSync(resultPathDebug, JSON.stringify(simpleSession, null, 2));
                expect.fail(`Result file not found at ${resultPath}.`);
            }
        });
    });
});
