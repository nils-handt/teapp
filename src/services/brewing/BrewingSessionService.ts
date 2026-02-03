import { BehaviorSubject, Subscription } from 'rxjs';
import { bufferTime, filter, map } from 'rxjs/operators';
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


    // Timer handles
    // Timer handles
    private timerInterval: ReturnType<typeof setInterval> | null = null;
    private timerStartTime = 0;


    // Configurable thresholds
    private readonly WEIGHT_UPDATE_BUFFER_MS = 500;
    private readonly TIMER_TICK_MS = 100;

    private readonly WATER_ADDITION_THRESHOLD = 10; // grams increase to detect water

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
            bufferTime(this.WEIGHT_UPDATE_BUFFER_MS),
            filter(weights => weights.length > 0),
            map(weights => {
                const sum = weights.reduce((a, b) => a + b, 0);
                return sum / weights.length;
            })
        ).subscribe(averageWeight => {
            this.handleWeightUpdate(averageWeight);
        });
    }

    private stopWeightSubscription() {
        if (this.weightSubscription) {
            this.weightSubscription.unsubscribe();
            this.weightSubscription = null;
        }
    }

    private handleWeightUpdate(weight: number) {
        this.currentWeight = weight;
        const phase = this.state$.value;

        switch (phase) {
            case BrewingPhase.SETUP:
                this.handleSetupPhase(weight);
                break;
            case BrewingPhase.READY:
            case BrewingPhase.REST:
                this.handleRestOrReadyPhase(weight);
                break;
            case BrewingPhase.INFUSION:
                this.handleInfusionPhase(weight);
                break;
            case BrewingPhase.INFUSION_VESSEL_LIFTED:
                this.handleVesselLiftedPhase(weight);
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
            this.lastStableWeight = this.currentWeight; // Should be vessel + tea (+ lid potentially)
        }
    }

    public async endSession() {
        this.stopTimer();
        const session = this.session$.value;
        if (session) {
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

        if (this.vesselWeight === 0 && weight > this.VESSEL_DETECTION_THRESHOLD) {
            // Detected Vessel
            this.vesselWeight = weight;
            // Assume Lid is on it initially?
        } else if (this.vesselWeight > 0 && this.lidWeight === 0 && weight < this.vesselWeight - this.LID_REMOVAL_THRESHOLD && weight > this.ZERO_THRESHOLD) {
            // Weight dropped significantly, assume lid removal
            this.lidWeight = this.vesselWeight - weight;
        } else if (this.lidWeight > 0 && this.dryTeaWeight === 0 && weight > (this.vesselWeight - this.lidWeight) + this.TEA_ADDITION_THRESHOLD) {
            // Weight increased after lid removal, assume tea added
            this.dryTeaWeight = weight - (this.vesselWeight - this.lidWeight);
        }
    }

    private handleRestOrReadyPhase(weight: number) {
        // Look for water addition
        // Weight increase significantly above [WetLeaves + Vessel (+ Lid?)]
        // We know `lastStableWeight` (state at end of last phase).

        // If weight increases by WATER_ADDITION_THRESHOLD within short time
        if (weight > this.lastStableWeight + this.WATER_ADDITION_THRESHOLD) {
            this.startInfusion();
        }
    }

    private handleInfusionPhase(weight: number) {
        // Detect Vessel Lift logic
        if (weight < this.ZERO_THRESHOLD) {
            this.state$.next(BrewingPhase.INFUSION_VESSEL_LIFTED);
            // Timer continues running
            return;
        }

        // What if they put the lid on? Weight increases by `lidWeight`.
        // We ignore that.
    }

    private handleVesselLiftedPhase(weight: number) {
        // Check for return
        if (weight > this.ZERO_THRESHOLD) {
            // Vessel returned.
            // Check if weight is significantly LOWER than start of infusion (minus lid variations).
            // Actually, compare to `lastStableWeight` (which was before water).
            // No, compare to maximum weight detected during infusion? 
            // Simply: if weight is LESS than (PreWater + Water/2)? 
            // Or use the `minEndInfusionWeight` (POUR_THRESHOLD).

            // Logic: calculated poured amount.
            // If we poured out, the new weight should be approx `wetLeavesWeight` + `vessel` (+- lid).
            // Which is definitely less than `vessel` + `wetLeaves` + `water`.

            // NOTE: We don't track total water weight accurately until the end.
            // But we can check if weight DROP matches "empty vessel + wet leaves".

            // Heuristic: If current weight is close to (Vessel + DryTea + Lid?), then we poured.
            // Actually wet tea is heavier. 
            // Let's assume if weight < (PreInfusionWeight + 10g) -> Poured out.
            // Or better: If weight is significantly less than the PEAK weight during infusion.

            // For MVP: If current weight is close to (Vessel + Lid + Tea * 2) (approx wet leaves)
            // Let's use the POUR_THRESHOLD relative to the *Pre-Pour* weight (which implies we need to track peak weight?).
            // Actually simply: If current weight < (lastStableWeight + WATER_ADDITION_THRESHOLD)?

            // Let's use: If weight is stable and < (PeakInfusionWeight - POUR_THRESHOLD).
            // We need to track PeakInfusionWeight.

            // Simplified: If weight is back to near "Empty" state (Vessel + WetLeaves + Lid).
            // Verify against `lastStableWeight` (which was Vessel + WetLeaves + Dry/WetTea).
            // If `current` ~ `lastStableWeight` (+- drift), then we poured out (returned to baseline).
            // If `current` >> `lastStableWeight` (by > 20g), we probably just lifted and put back with water.

            const predictedEmptyWeight = this.lastStableWeight; // This is (Vessel + Lid + Tea/WetLeaves)

            // If we are close to the empty weight (e.g. within 10g), we assume pour is done.
            if (Math.abs(weight - predictedEmptyWeight) < this.POUR_DETECTION_TOLERANCE) {
                this.endInfusion(weight);
            } else {
                // Resumed (put back with water)
                this.state$.next(BrewingPhase.INFUSION);
            }
        }
    }

    private startInfusion() {
        this.stopTimer(); // Stop rest timer if any

        let infusionNumber = 1;
        const session = this.session$.value;
        if (session && session.infusions) {
            infusionNumber = session.infusions.length + 1;
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
        this.startTimer();
    }

    private endInfusion(currentWeight: number) {
        this.stopTimer();
        const infusion = this.currentInfusion$.value;
        const session = this.session$.value;

        if (infusion && session) {
            infusion.duration = Math.floor(this.timer$.value / 1000); // sec
            infusion.restDuration = 0; // calculated next time
            infusion.wetTeaLeavesWeight = currentWeight - this.vesselWeight - this.lidWeight; // Approx
            // Note: calculation depends on if Lid is on. Assume Lid is ON when ending infusion usually.

            // Save infusion
            infusion.session = session;
            session.infusions = [...(session.infusions || []), infusion];

            sessionRepository.saveSession(session);

            this.session$.next(session);

            // Capture wet leaves weight more accurately?
            // currentWeight is "Empty" weight (Vessel + Lid + WetLeaves).
            // Capture wet leaves weight more accurately?
            // currentWeight is "Empty" weight (Vessel + Lid + WetLeaves).
            // this.wetLeavesWeight = currentWeight - this.vesselWeight - this.lidWeight;

            this.lastStableWeight = currentWeight;
        }

        this.state$.next(BrewingPhase.REST);
        this.startTimer(); // Start Rest Timer
    }

    // --- Timer Logic ---
    private startTimer() {
        this.stopTimer();
        this.timerStartTime = Date.now();
        this.timer$.next(0);
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
            this.endInfusion(this.currentWeight);
        }
    }
}

export const brewingSessionService = BrewingSessionService.getInstance();
