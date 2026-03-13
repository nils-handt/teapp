import { describe, it, expect, vi, beforeEach, afterEach, onTestFailed, onTestFinished } from 'vitest';
import { brewingSessionService } from './BrewingSessionService';
import { BrewingPhase } from '../interfaces/brewing.types';
import { bluetoothScaleService } from '../BluetoothScaleService';
import { sessionRepository } from '../../repositories/SessionRepository'; // We need to mock this

// Mock dependencies
vi.mock('../../repositories/SessionRepository', () => ({
    sessionRepository: {
        saveSession: vi.fn(),
    },
}));

import fs from 'fs';
import path from 'path';

describe('BrewingSessionService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        brewingSessionService.resetForTest();
        vi.clearAllMocks();
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
            const scenarioData = JSON.parse(scenarioContent);

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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let currentAction: any = nextActionIndex < actions.length ? actions[nextActionIndex] : null;

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
                resultingSession = { ...resultingSession, status: 'completed' } as any;
            }
            const resultPath = path.resolve(testFilesDir, file.replace('.json', '.result.json'));
            const resultPathDebug = path.resolve(testFilesDir, file.replace('.json', '.result.debug.json'));

            // Hook to write debug file on failure
            onTestFailed(() => {
                // Helper to remove circular references for debug file
                const simpleSession = {
                    ...resultingSession,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    infusions: resultingSession?.infusions?.map((i: any) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { session, ...rest } = i;
                        return rest;
                    })
                };
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
                const expectedResult = JSON.parse(fs.readFileSync(resultPath, 'utf8'));

                // Fuzzy comparison configuration
                const WEIGHT_TOLERANCE = 2; // grams
                const TIME_TOLERANCE = 2; // seconds

                const assertClose = (actual: number, expected: number | string, tolerance: number, label: string) => {
                    if (typeof expected !== 'string' || !expected.startsWith('skip')) { // allow results to be skipped by prefixing 'skip' to the expected value
                        const diff = Math.abs(actual - Number(expected));
                        expect.soft(diff, `Mismatch in ${label}: expected ${expected}, got ${actual} (diff ${diff})`).toBeLessThanOrEqual(tolerance);
                    }
                };

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const compareSessions = (actual: any, expected: any) => {
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

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    actual.infusions.forEach((actInf: any, index: number) => {
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
                const simpleSession = {
                    ...resultingSession,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    infusions: resultingSession?.infusions?.map((i: any) => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { session, ...rest } = i;
                        return rest;
                    })
                };
                fs.writeFileSync(resultPathDebug, JSON.stringify(simpleSession, null, 2));
                expect.fail(`Result file not found at ${resultPath}.`);
            }
        });
    });
});
