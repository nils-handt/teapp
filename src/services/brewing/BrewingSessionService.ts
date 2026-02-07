import { BehaviorSubject, Subscription } from 'rxjs';
import { bufferTime, filter } from 'rxjs/operators';
import { bluetoothScaleService } from '../BluetoothScaleService';
import { sessionRepository } from '../../repositories/SessionRepository';
import { BrewingSession } from '../../entities/BrewingSession.entity';
import { Infusion } from '../../entities/Infusion.entity';

import { BrewingPhase } from '../interfaces/brewing.types';

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
    private vesselWeight = 0;
    private lidWeight = 0;
    private dryTeaWeight = 0;
    private maxWeightInPhase = 0;
    private lastLiftTime = 0;


    // Timer handles
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
    private readonly POUR_DETECTION_TOLERANCE = 20;


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

    private analyzeTrend(weights: number[]): 'STABLE' | 'INCREASING' | 'DECREASING' | 'CHAOTIC' { // todo create an enum for this
        if (weights.length < 2) return 'STABLE'; // Not enough data, assume stable

        const max = Math.max(...weights);
        const min = Math.min(...weights);

        if (max - min < 1.0) {
            return 'STABLE';
        }

        let strictlyIncreasing = true;
        let strictlyDecreasing = true;

        for (let i = 1; i < weights.length; i++) {
            if (weights[i] <= weights[i - 1]) strictlyIncreasing = false;
            if (weights[i] >= weights[i - 1]) strictlyDecreasing = false;
        }

        if (strictlyIncreasing) return 'INCREASING';
        if (strictlyDecreasing) return 'DECREASING';

        return 'CHAOTIC';
    }

    private handleWeightUpdate(weight: number, trend: 'STABLE' | 'INCREASING' | 'DECREASING' | 'CHAOTIC') {
        this.currentWeight = weight;
        if (trend === 'STABLE' && weight > this.maxWeightInPhase) {
            this.maxWeightInPhase = weight;
        }
        const phase = this.state$.value;

        switch (phase) {
            case BrewingPhase.SETUP:
                if (trend === 'STABLE') {
                    this.handleSetupPhase(weight);
                }
                break;
            case BrewingPhase.READY:
            case BrewingPhase.REST:
                if (trend === 'STABLE' || trend === 'INCREASING') {
                    this.handleRestOrReadyPhase(weight);
                }
                break;
            case BrewingPhase.INFUSION:
                if (trend === 'STABLE') {
                    this.handleInfusionPhase(weight);
                }
                break;
            case BrewingPhase.INFUSION_VESSEL_LIFTED:
                if (trend === 'STABLE') {
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
        this.vesselWeight = 0;
        this.lidWeight = 0;
        this.dryTeaWeight = 0;
    }

    public confirmSetupDone() {
        const session = this.session$.value;
        if (session) {
            // Save setup values to session
            session.vesselWeight = this.vesselWeight;
            session.lidWeight = this.lidWeight;
            session.dryTeaLeavesWeight = this.dryTeaWeight;
            // Persist initial session? Or wait? better save now in case of crash.
            sessionRepository.saveSession(session);
            this.session$.next(session);

            this.state$.next(BrewingPhase.READY);

            // Normalize lastStableWeight to include Lid if missing
            let weight = this.currentWeight;
            const expectedNoLid = this.vesselWeight + this.dryTeaWeight;

            if (Math.abs(weight - expectedNoLid) < this.LID_REMOVAL_THRESHOLD) {
                weight += this.lidWeight;
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
        // Simple logic for now: 
        // 1. If weight > 20g -> Assume Vessel Placed.
        // 2. If weight usage drops -> Check if Lid Removed.
        // This is tricky to automate fully without UI feedback or strictly enforced flow.
        // For MVP, lets capture current stable weights if consistent for some time?
        // Or just let UI set these via "Capture Weight" buttons? 
        // The REQUIREMENTS say "automatically initiate vessel Weight".

        // Let's implement a simplified auto-detect flow:
        // 0 -> Jump to >20g: Set Vessel Weight.
        // Vessel Weight -> Drop by > 5g: Set Lid Weight = (Vessel - Current). 
        // Then assume current is Vessel-Lid.
        // Then Increase by 3-10g: Set Dry Tea = (Current - (Vessel-Lid)).

        // todo this logic is flawed, if the user initially puts vessel without lid on the scale this will fail
        if (this.vesselWeight === 0 && weight > this.VESSEL_DETECTION_THRESHOLD) {
            // Detected Vessel
            this.vesselWeight = weight;
            // Assume Lid is on it initially?
        } else if (this.vesselWeight > 0 && this.lidWeight === 0 && weight < this.vesselWeight - this.LID_REMOVAL_THRESHOLD && weight > this.ZERO_THRESHOLD) {
            // Weight dropped significantly, assume lid removal
            this.lidWeight = this.vesselWeight - weight;
            this.vesselWeight = weight; // Update vessel weight to be just the vessel
        } else if (this.lidWeight > 0) {
            const V = this.vesselWeight;
            const L = this.lidWeight;

            // Check if Lid was simply put back (Weight ~ V + L)
            if (Math.abs(weight - (V + L)) < this.LID_REMOVAL_THRESHOLD) {
                // Lid put back, do not count as tea
                return;
            }

            let newTea = 0;
            // Check if Tea added with Lid ON (Weight > V + L + Threshold)
            if (weight > (V + L) + this.TEA_ADDITION_THRESHOLD) {
                newTea = weight - (V + L);
            }
            // Check if Tea added with Lid OFF (Weight > V + Threshold)
            else if (weight > V + this.TEA_ADDITION_THRESHOLD) {
                newTea = weight - V;
            }

            if (newTea > this.dryTeaWeight) {
                this.dryTeaWeight = parseFloat(newTea.toFixed(1));
            }
        }
    }

    private handleRestOrReadyPhase(weight: number) {
        // Look for water addition
        // Weight increase significantly above [WetLeaves + Vessel (+ Lid?)]
        // We know `lastStableWeight` (state at end of last phase, normalized to WITH LID).

        const weightWithLid = this.lastStableWeight;
        const weightNoLid = this.lastStableWeight - this.lidWeight;

        let baseline = weightWithLid;

        // If we have a lid, check if we are closer to the "No Lid" state
        if (this.lidWeight > 0) {
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

            // Logic: we want to know if user poured out.

            const matchesEmptyWithLid = Math.abs(weight - predictedEmptyWeight) < this.POUR_DETECTION_TOLERANCE;
            // If predicted was normalized (Lid ON), then "predicted - Lid" is EmptyNoLid
            const matchesEmptyNoLid = this.lidWeight > 0 && Math.abs(weight - (predictedEmptyWeight - this.lidWeight)) < this.POUR_DETECTION_TOLERANCE;

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
            let teaWeight = this.dryTeaWeight;
            if (session.infusions && session.infusions.length > 0) {
                const prevInfusion = session.infusions[session.infusions.length - 1];
                if (prevInfusion.wetTeaLeavesWeight) {
                    teaWeight = prevInfusion.wetTeaLeavesWeight;
                }
            }
            infusion.waterWeight = parseFloat((this.maxWeightInPhase - this.vesselWeight - this.lidWeight - teaWeight).toFixed(1));

            // Calculate wet leaves
            let wetLeaves = 0;
            if (hasLid) {
                wetLeaves = currentWeight - this.vesselWeight - this.lidWeight;
            } else {
                wetLeaves = currentWeight - this.vesselWeight;
            }
            infusion.wetTeaLeavesWeight = parseFloat(wetLeaves.toFixed(1));

            // Save infusion
            infusion.session = session;
            session.infusions = [...(session.infusions || []), infusion];

            sessionRepository.saveSession(session);

            this.session$.next(session);

            // Update lastStableWeight (normalized to V + L + WetLeaves)
            this.lastStableWeight = hasLid ? currentWeight : currentWeight + this.lidWeight;
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
            this.endInfusion(this.currentWeight, true); // todo what if the vessel doesn't have a lid on?
        }
    }
}

export const brewingSessionService = BrewingSessionService.getInstance();
