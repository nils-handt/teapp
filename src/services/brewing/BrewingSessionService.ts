import { BehaviorSubject, Subscription } from 'rxjs';
import { bufferTime, filter } from 'rxjs/operators';
import { bluetoothScaleService } from '../BluetoothScaleService';
import { sessionRepository } from '../../repositories/SessionRepository';
import { BrewingSession } from '../../entities/BrewingSession.entity';
import { Infusion } from '../../entities/Infusion.entity';

import { BrewingPhase, WeightTrend } from '../interfaces/brewing.types';

class BrewingSessionService {
    private static instance: BrewingSessionService;
    private weightSubscription: Subscription | null = null;

    // State via BehaviorSubjects
    public state$ = new BehaviorSubject<BrewingPhase>(BrewingPhase.IDLE);
    public session$ = new BehaviorSubject<BrewingSession | null>(null);
    public currentInfusion$ = new BehaviorSubject<Infusion | null>(null);
    public timer$ = new BehaviorSubject<number>(0); // ms

    // Internal state tracking
    private currentWeight = 0;
    private lastStableWeight = 0;
    private maxWeightInPhase = 0;
    private lastLiftTime = 0;


    // Timer handles
    private timerInterval: ReturnType<typeof setInterval> | null = null;
    private timerStartTime = 0;


    // Configurable thresholds
    private readonly WEIGHT_UPDATE_BUFFER_MS = 500;
    private readonly TIMER_TICK_MS = 100;

    private readonly WATER_ADDITION_THRESHOLD = 5; // grams increase to detect water

    private readonly ZERO_THRESHOLD = 5; // grams, below this consider vessel lifted

    // Auto-detection thresholds
    private readonly VESSEL_DETECTION_THRESHOLD = 20;
    private readonly LID_REMOVAL_THRESHOLD = 5;
    private readonly TEA_ADDITION_THRESHOLD = 1;
    private readonly POUR_DETECTION_TOLERANCE = 30;


    private constructor() {
        // defined in startSession
    }

    public static getInstance(): BrewingSessionService {
        if (!BrewingSessionService.instance) {
            BrewingSessionService.instance = new BrewingSessionService();
        }
        return BrewingSessionService.instance;
    }

    private initializeWeightSubscription() {
        if (this.weightSubscription) {
            this.weightSubscription.unsubscribe();
        }
        this.weightSubscription = bluetoothScaleService.weight$.pipe(
            bufferTime(this.WEIGHT_UPDATE_BUFFER_MS), // todo depending on scale update rate this might not give enough data points for trend analysis - ideally we want something like to wait for at least 4 data points OR if the scale updates faster than every 100ms then a time based buffer is fine
            filter(weights => weights.length > 0)
        ).subscribe(weights => {
            const averageWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
            const trend = this.analyzeTrend(weights);
            this.handleWeightUpdate(averageWeight, trend);
        });
    }

    private stopWeightSubscription() {
        if (this.weightSubscription) {
            this.weightSubscription.unsubscribe();
            this.weightSubscription = null;
        }
    }

    private analyzeTrend(weights: number[]): WeightTrend {
        if (weights.length < 2) return WeightTrend.STABLE; // Not enough data, assume stable

        const max = Math.max(...weights);
        const min = Math.min(...weights);

        if (max - min < 1.0) {
            return WeightTrend.STABLE;
        }

        let strictlyIncreasing = true;
        let strictlyDecreasing = true;

        for (let i = 1; i < weights.length; i++) {
            if (weights[i] <= weights[i - 1]) strictlyIncreasing = false;
            if (weights[i] >= weights[i - 1]) strictlyDecreasing = false;
        }

        if (strictlyIncreasing) return WeightTrend.INCREASING;
        if (strictlyDecreasing) return WeightTrend.DECREASING;

        return WeightTrend.CHAOTIC;
    }

    private handleWeightUpdate(weight: number, trend: WeightTrend) {
        this.currentWeight = weight;
        if (trend === WeightTrend.STABLE && weight > this.maxWeightInPhase) {
            this.maxWeightInPhase = weight;
        }
        const phase = this.state$.value;

        switch (phase) {
            case BrewingPhase.SETUP:
                if (trend === WeightTrend.STABLE) {
                    this.handleSetupPhase(weight);
                }
                break;
            case BrewingPhase.READY:
            case BrewingPhase.REST:
                if (trend === WeightTrend.STABLE || trend === WeightTrend.INCREASING) {
                    this.handleRestOrReadyPhase(weight);
                }
                break;
            case BrewingPhase.INFUSION:
                if (trend === WeightTrend.STABLE) {
                    this.handleInfusionPhase(weight);
                }
                break;
            case BrewingPhase.INFUSION_VESSEL_LIFTED:
                if (trend === WeightTrend.STABLE) {
                    this.handleVesselLiftedPhase(weight);
                }
                break;
        }
    }

    // --- Public Actions ---

    public startSession(teaName?: string, notes?: string) {
        const session = new BrewingSession();
        session.sessionId = crypto.randomUUID(); // Requires secure context or polyfill. If failing, move to uuid lib.
        session.teaName = teaName || '';
        session.startTime = new Date().toISOString();
        session.status = 'active';
        session.notes = notes || '';
        session.infusions = [];
        session.vesselWeight = 0;
        session.lidWeight = 0;
        session.dryTeaLeavesWeight = 0;

        this.session$.next(session);
        this.state$.next(BrewingPhase.SETUP);
        this.maxWeightInPhase = 0;

        this.initializeWeightSubscription();

        // Reset Setup Values
        // No longer needed as we use session object directly
    }

    public confirmSetupDone() {
        const session = this.session$.value;
        if (session) {
            // Values are already in session object from handleSetupPhase

            // Persist initial session? Or wait? better save now in case of crash.
            sessionRepository.saveSession(session);
            this.session$.next(session);

            this.state$.next(BrewingPhase.READY);

            // Normalize lastStableWeight to include Lid if missing
            let weight = this.currentWeight;
            const expectedNoLid = (session.vesselWeight || 0) + (session.dryTeaLeavesWeight || 0);

            if (Math.abs(weight - expectedNoLid) < this.LID_REMOVAL_THRESHOLD) {
                weight += (session.lidWeight || 0);
            }
            this.lastStableWeight = weight;
        }
    }

    public async endSession() {
        this.stopTimer();
        const session = this.session$.value;
        if (session) {
            // Update last infusion's rest duration if applicable
            if (session.infusions && session.infusions.length > 0) {
                const lastInfusion = session.infusions[session.infusions.length - 1];
                // Only if we are coming from a REST phase (timer was running)
                if (this.state$.value === BrewingPhase.REST && this.timer$.value > 0) {
                    lastInfusion.restDuration = Math.floor(this.timer$.value / 1000);
                }
            }

            session.endTime = new Date().toISOString();
            session.status = 'completed';
            await sessionRepository.saveSession(session);
        }
        this.state$.next(BrewingPhase.ENDED);
        this.session$.next(null);
        this.currentInfusion$.next(null);
        this.stopWeightSubscription();
    }

    // --- Phase Logic ---

    private handleSetupPhase(weight: number) {
        // Logic to detect Vessel, Lid, Tea.
        // Happy Path: Vessel -> Lid (optional) -> Tea
        // Refined logic allows tea detection even if lid is not detected or skipped.
        const session = this.session$.value;
        if (!session) return;

        let updated = false;

        // Use session values as source of truth
        let currentVesselWeight = session.vesselWeight || 0;
        let currentLidWeight = session.lidWeight || 0;
        let currentTeaWeight = session.dryTeaLeavesWeight || 0;


        if (currentVesselWeight === 0 && weight > this.VESSEL_DETECTION_THRESHOLD) {
            // Detected Vessel
            currentVesselWeight = weight;
            updated = true;
            // Assume Lid is on it initially? No, assume bare vessel or vessel+lid combo.
            // We can't distinguish yet.
        } else if (currentVesselWeight > 0 && currentLidWeight === 0 && weight < currentVesselWeight - this.LID_REMOVAL_THRESHOLD && weight > this.ZERO_THRESHOLD) {
            // Weight dropped significantly, assume lid removal
            currentLidWeight = currentVesselWeight - weight;
            currentVesselWeight = weight; // Update vessel weight to be just the vessel
            updated = true;
        } else if (currentVesselWeight > 0) {
            // Check for tea addition
            // Scenario 1: Lid was removed (lidWeight > 0). Tea added to Vessel.
            // Scenario 2: Lid was NOT removed (lidWeight == 0). Tea added to Vessel (+Lid assumed part of vessel or not present).

            const V = currentVesselWeight;
            const L = currentLidWeight;

            // Check if Lid was simply put back (Weight ~ V + L)
            if (L > 0 && Math.abs(weight - (V + L)) < this.LID_REMOVAL_THRESHOLD) {
                // Lid put back, do not count as tea
                return;
            }

            let newTea = 0;
            // Check if Tea added with Lid ON (Weight > V + L + Threshold)
            if (weight > (V + L) + this.TEA_ADDITION_THRESHOLD) {
                newTea = weight - (V + L);
            }
            // Check if Tea added with Lid OFF (Weight > V + Threshold) - only strict if Lid is known
            else if (weight > V + this.TEA_ADDITION_THRESHOLD) {
                newTea = weight - V;
            }

            // Cap detection to reasonable tea amounts (e.g. < 50g) to avoid mistaking water/lid for tea if logic is ambiguous
            // But for now, just trust the threshold increase.

            if (newTea > currentTeaWeight && newTea < 50) {
                currentTeaWeight = parseFloat(newTea.toFixed(1));
                updated = true;
            }
        }

        if (updated) {
            session.vesselWeight = currentVesselWeight;
            session.lidWeight = currentLidWeight;
            session.dryTeaLeavesWeight = currentTeaWeight;
            this.session$.next(session);
        }
    }

    private handleRestOrReadyPhase(weight: number) {
        // Look for water addition
        // Weight increase significantly above [WetLeaves + Vessel (+ Lid?)]
        // We know `lastStableWeight` (state at end of last phase, normalized to WITH LID).

        const session = this.session$.value;
        const lidWeight = session?.lidWeight || 0;

        const weightWithLid = this.lastStableWeight;
        const weightNoLid = this.lastStableWeight - lidWeight;

        let baseline = weightWithLid;

        // If we have a lid, check if we are closer to the "No Lid" state
        if (lidWeight > 0) {
            const distToLidOn = Math.abs(weight - weightWithLid);
            const distToLidOff = Math.abs(weight - weightNoLid);

            if (distToLidOff < distToLidOn) {
                baseline = weightNoLid;
            }
        }

        // If weight increases by WATER_ADDITION_THRESHOLD above the determined baseline
        if (weight > baseline + this.WATER_ADDITION_THRESHOLD) {
            this.startInfusion();
        }
    }

    private handleInfusionPhase(weight: number) {
        // Detect Vessel Lift logic
        if (weight < this.ZERO_THRESHOLD) {
            this.lastLiftTime = Date.now();
            this.state$.next(BrewingPhase.INFUSION_VESSEL_LIFTED);
            this.stopTimer(); // Pause timer while lifted
            return;
        }

        // What if they put the lid on? Weight increases by `lidWeight`.
        // We ignore that.
    }

    private handleVesselLiftedPhase(weight: number) {
        // Check for return
        if (weight > this.ZERO_THRESHOLD) {
            // Vessel returned.
            const predictedEmptyWeight = this.lastStableWeight; // This is Normalized (Vessel + Lid + Tea/WetLeaves)

            const session = this.session$.value;
            const lidWeight = session?.lidWeight || 0;

            // Logic: we want to know if user poured out.

            const matchesEmptyWithLid = Math.abs(weight - predictedEmptyWeight) < this.POUR_DETECTION_TOLERANCE;
            // If predicted was normalized (Lid ON), then "predicted - Lid" is EmptyNoLid
            const matchesEmptyNoLid = lidWeight > 0 && Math.abs(weight - (predictedEmptyWeight - lidWeight)) < this.POUR_DETECTION_TOLERANCE;

            if (matchesEmptyWithLid) {
                this.endInfusion(weight, true, this.lastLiftTime);
            } else if (matchesEmptyNoLid) {
                this.endInfusion(weight, false, this.lastLiftTime);
            } else {
                // Resumed (put back with water)
                this.state$.next(BrewingPhase.INFUSION);
                this.startTimer(true); // Resume timer
            }
        }
    }

    private startInfusion() {
        this.stopTimer(); // Stop rest timer if any

        let infusionNumber = 1;
        const session = this.session$.value;
        if (session && session.infusions) {
            infusionNumber = session.infusions.length + 1;

            // Update previous infusion's rest duration
            if (session.infusions.length > 0) {
                const lastInfusion = session.infusions[session.infusions.length - 1];
                lastInfusion.restDuration = Math.floor(this.timer$.value / 1000);
            }
        }

        const infusion = new Infusion();
        infusion.infusionId = crypto.randomUUID();
        infusion.infusionNumber = infusionNumber;
        infusion.startTime = new Date().toISOString();
        infusion.sessionId = session?.sessionId || '';
        infusion.duration = 0;

        if (session) {
            // We can't push to session.infusions directly if it's not set up to observe, but we can mutate and emit.
            // Better to define relationship properly.
        }

        this.currentInfusion$.next(infusion);
        this.state$.next(BrewingPhase.INFUSION);
        this.maxWeightInPhase = this.currentWeight;
        this.startTimer();
    }

    private endInfusion(currentWeight: number, hasLid: boolean = true, liftTime?: number) {
        this.stopTimer();
        const infusion = this.currentInfusion$.value;
        const session = this.session$.value;

        if (infusion && session) {
            infusion.duration = Math.floor(this.timer$.value / 1000); // sec
            infusion.restDuration = 0; // calculated next time
            let teaWeight = session.dryTeaLeavesWeight || 0;
            if (session.infusions && session.infusions.length > 0) {
                const prevInfusion = session.infusions[session.infusions.length - 1];
                if (prevInfusion.wetTeaLeavesWeight) {
                    teaWeight = prevInfusion.wetTeaLeavesWeight;
                }
            }

            const vesselWeight = session.vesselWeight || 0;
            const lidWeight = session.lidWeight || 0;

            infusion.waterWeight = parseFloat((this.maxWeightInPhase - vesselWeight - lidWeight - teaWeight).toFixed(1));

            // Calculate wet leaves
            let wetLeaves = 0;
            if (hasLid) {
                wetLeaves = currentWeight - vesselWeight - lidWeight;
            } else {
                wetLeaves = currentWeight - vesselWeight;
            }
            infusion.wetTeaLeavesWeight = parseFloat(wetLeaves.toFixed(1));

            // Save infusion
            infusion.session = session;
            session.infusions = [...(session.infusions || []), infusion];

            sessionRepository.saveSession(session);

            this.session$.next(session);

            // Update lastStableWeight (normalized to V + L + WetLeaves)
            this.lastStableWeight = hasLid ? currentWeight : currentWeight + lidWeight;
        }

        this.state$.next(BrewingPhase.REST);

        let startOffset = 0;
        if (liftTime) {
            startOffset = Date.now() - liftTime;
        }
        this.startTimer(false, startOffset); // Start Rest Timer
    }

    // --- Timer Logic ---
    private startTimer(resume = false, startOffset = 0) {
        this.stopTimer(); // Stop rest timer if any

        if (resume) {
            // Resume from current value
            this.timerStartTime = Date.now() - this.timer$.value;
        } else {
            this.timerStartTime = Date.now() - startOffset;
            this.timer$.next(startOffset);
        }

        this.timerInterval = setInterval(() => {
            const now = Date.now();
            this.timer$.next(now - this.timerStartTime);
        }, this.TIMER_TICK_MS);
    }

    private stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    // Manual Overrides
    public manuallyStartInfusion() {
        if (this.state$.value === BrewingPhase.READY || this.state$.value === BrewingPhase.REST || this.state$.value === BrewingPhase.SETUP) {
            // Force state ready if setup
            if (this.state$.value === BrewingPhase.SETUP) this.confirmSetupDone();

            // Force jump to start infusion (e.g. skipped water detect)
            this.startInfusion();
        }
    }

    public manuallyStopInfusion() {
        if (this.state$.value === BrewingPhase.INFUSION || this.state$.value === BrewingPhase.INFUSION_VESSEL_LIFTED) {
            this.endInfusion(this.currentWeight, true);
        }
    }

    /**
     * Resets the separate service state for testing purposes.
     * clears all subjects and internal state.
     */
    public resetForTest() {
        this.stopWeightSubscription();
        this.stopTimer();

        this.currentWeight = 0;
        this.lastStableWeight = 0;
        this.maxWeightInPhase = 0;
        this.lastLiftTime = 0;
        this.timerStartTime = 0;

        this.state$.next(BrewingPhase.ENDED);
        this.session$.next(null);
        this.currentInfusion$.next(null);
        this.timer$.next(0);
    }
}

export const brewingSessionService = BrewingSessionService.getInstance();
