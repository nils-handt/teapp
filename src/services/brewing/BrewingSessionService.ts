import { BehaviorSubject, Subscription } from 'rxjs';
import { bufferTime, filter } from 'rxjs/operators';
import { bluetoothScaleService } from '../BluetoothScaleService';
import { sessionRepository } from '../../repositories/SessionRepository';
import { brewingVesselRepository } from '../../repositories/BrewingVesselRepository';
import { BrewingSession } from '../../entities/BrewingSession.entity';
import { BrewingVessel } from '../../entities/BrewingVessel.entity';
import { Infusion } from '../../entities/Infusion.entity';

import { BrewingPhase, WeightTrend } from '../interfaces/brewing.types';
import { keepAwakeService } from '../KeepAwakeService';

type SetupField = 'vesselWeight' | 'lidWeight' | 'trayWeight' | 'dryTeaLeavesWeight';

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
    private lastStableWasteWater = 0;
    private maxWeightInPhase = 0;
    private lastLiftTime = 0;
    private lowestLiftedWeight = Infinity;
    private setupStepWeights: number[] = [];

    // Timer handles
    private timerInterval: ReturnType<typeof setInterval> | null = null;
    private timerStartTime = 0;


    // Configurable thresholds
    private readonly WEIGHT_UPDATE_BUFFER_MS = 500;
    private readonly TIMER_TICK_MS = 100;

    private readonly WATER_ADDITION_THRESHOLD = 5; // grams increase to detect water

    private readonly ZERO_THRESHOLD = 5; // grams, below this consider vessel lifted

    // Auto-detection thresholds
    private readonly LID_REMOVAL_THRESHOLD = 5;
    private readonly TEA_ADDITION_THRESHOLD = 1;
    private readonly POUR_DETECTION_TOLERANCE = 30;
    private readonly SETUP_STEP_STABILITY_THRESHOLD = 1.0;


    private constructor() {
        // defined in startSession
    }

    public static getInstance(): BrewingSessionService {
        if (!BrewingSessionService.instance) {
            BrewingSessionService.instance = new BrewingSessionService();
        }
        return BrewingSessionService.instance;
    }

    private emitSession(session: BrewingSession) {
        this.session$.next({
            ...session,
            infusions: [...(session.infusions || [])],
        });
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
        session.trayWeight = 0;
        session.dryTeaLeavesWeight = 0;
        session.currentWasteWater = 0;
        session.brewingVesselId = null;
        session.brewingVessel = null;

        this.lowestLiftedWeight = Infinity;
        this.lastStableWasteWater = 0;
        this.maxWeightInPhase = 0;
        this.setupStepWeights = [0];
        this.emitSession(session);
        this.state$.next(BrewingPhase.SETUP);

        this.initializeWeightSubscription();
        void keepAwakeService.keepAwake();

        // Reset Setup Values
        // No longer needed as we use session object directly
    }

    public restoreSession(session: BrewingSession) {
        this.stopTimer();
        this.stopWeightSubscription();

        const restoredSession = { ...session };
        restoredSession.infusions = [...(session.infusions || [])];

        const resumedPhase = this.deriveRestoredPhase(restoredSession);

        this.currentWeight = 0;
        this.lowestLiftedWeight = Infinity;
        this.maxWeightInPhase = 0;
        this.lastLiftTime = 0;
        this.timerStartTime = 0;
        this.timer$.next(0);
        this.currentInfusion$.next(null);
        this.setupStepWeights = this.buildRestoredSetupWeights(restoredSession);
        this.lastStableWasteWater = restoredSession.currentWasteWater || 0;
        this.lastStableWeight = this.calculateRestoredStableWeight(restoredSession);

        this.session$.next(restoredSession);
        this.state$.next(resumedPhase);

        this.initializeWeightSubscription();
        void keepAwakeService.keepAwake();
    }

    public clearSession() {
        this.stopTimer();
        this.stopWeightSubscription();
        void keepAwakeService.allowSleep();

        this.currentWeight = 0;
        this.lastStableWeight = 0;
        this.lastStableWasteWater = 0;
        this.maxWeightInPhase = 0;
        this.lastLiftTime = 0;
        this.lowestLiftedWeight = Infinity;
        this.timerStartTime = 0;
        this.setupStepWeights = [];

        this.timer$.next(0);
        this.currentInfusion$.next(null);
        this.session$.next(null);
        this.state$.next(BrewingPhase.IDLE);
    }

    public confirmSetupDone() {
        const session = this.session$.value;
        if (session) {
            // Values are already in session object from handleSetupPhase

            // Persist initial session? Or wait? better save now in case of crash.
            sessionRepository.saveSession(session);
            this.emitSession(session);

            this.state$.next(BrewingPhase.READY);

            // Normalize lastStableWeight to include Lid if missing
            let weight = this.currentWeight;
            const expectedNoLid = (session.trayWeight || 0) + (session.vesselWeight || 0) + (session.dryTeaLeavesWeight || 0);

            if (Math.abs(weight - expectedNoLid) < this.LID_REMOVAL_THRESHOLD) {
                weight += (session.lidWeight || 0);
            }
            this.lastStableWeight = weight;
            this.lastStableWasteWater = 0;
        }
    }

    public async endSession() {
        this.stopTimer();
        await keepAwakeService.allowSleep();
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
            this.emitSession(session);
        }
        this.state$.next(BrewingPhase.ENDED);
        this.currentInfusion$.next(null);
        this.stopWeightSubscription();
    }

    public updateTeaName(name: string) {
        const session = this.session$.value;
        const allowedPhases = new Set<BrewingPhase>([
            BrewingPhase.SETUP,
            BrewingPhase.READY,
            BrewingPhase.INFUSION,
            BrewingPhase.INFUSION_VESSEL_LIFTED,
            BrewingPhase.REST,
        ]);

        if (!session || !allowedPhases.has(this.state$.value)) {
            return;
        }

        session.teaName = name.trim();
        this.emitSession(session);
        void sessionRepository.saveSession(session);
    }

    public updateBrewingVesselName(name: string) {
        const session = this.session$.value;
        const allowedPhases = new Set<BrewingPhase>([
            BrewingPhase.SETUP,
            BrewingPhase.READY,
            BrewingPhase.INFUSION,
            BrewingPhase.INFUSION_VESSEL_LIFTED,
            BrewingPhase.REST,
        ]);

        if (!session || !allowedPhases.has(this.state$.value)) {
            return;
        }

        const trimmedName = name.trim();
        if (!trimmedName || !this.hasBrewingVesselWeights(session)) {
            return;
        }

        void this.saveBrewingVesselForSession(session.sessionId, trimmedName);
    }

    public updateSetupValue(field: SetupField, value: number) {
        const session = this.session$.value;
        if (!session || this.state$.value !== BrewingPhase.SETUP) {
            return;
        }

        const normalizedValue = parseFloat(Math.max(0, value).toFixed(1));
        session[field] = normalizedValue;

        this.setupStepWeights = this.buildRestoredSetupWeights(session);
        this.emitSession(session);
        void sessionRepository.saveSession(session);

        if (field === 'vesselWeight' || field === 'lidWeight') {
            void this.syncBrewingVesselForSession(session.sessionId);
        }
    }

    // --- Phase Logic ---

    private handleSetupPhase(weight: number) {
        const session = this.session$.value;
        if (!session) return;

        const lastRecordedWeight = this.setupStepWeights.length > 0 ? this.setupStepWeights[this.setupStepWeights.length - 1] : 0;
        // Use a threshold to consider it a distinct stable step
        if (Math.abs(weight - lastRecordedWeight) > this.SETUP_STEP_STABILITY_THRESHOLD) {
            this.setupStepWeights.push(weight);
            this.recalculateSetupWeights();
        }
    }

    private recalculateSetupWeights() {
        const session = this.session$.value;
        if (!session) return;

        const weights = this.setupStepWeights.slice(1);
        if (weights.length === 0) return;

        const uniqueWeights: number[] = [];
        weights.forEach(w => {
            if (!uniqueWeights.some(uw => Math.abs(uw - w) < 2.0)) {
                uniqueWeights.push(w);
            }
        });

        const deltas: number[] = [];
        for (let i = 1; i < this.setupStepWeights.length; i++) {
            deltas.push(this.setupStepWeights[i] - this.setupStepWeights[i - 1]);
        }

        let componentsAdded: number[] = [];
        let maxLidRemoved = 0;
        let teaAdded = 0;

        for (const delta of deltas) {
            if (delta > 0) {
                if (delta >= 40) { // Tray, Vessel, or Lid
                    if (maxLidRemoved > 0 && Math.abs(delta - maxLidRemoved) < 5) {
                        // lid returned
                    } else {
                        componentsAdded.push(delta);
                    }
                } else if (delta >= this.TEA_ADDITION_THRESHOLD) { // Tea
                    teaAdded += delta;
                }
            } else if (delta <= -this.LID_REMOVAL_THRESHOLD) { // Lid removed
                const removed = Math.abs(delta);
                if (removed > maxLidRemoved) {
                    maxLidRemoved = removed;
                }
            }
        }

        let tray = 0;
        let vessel = 0;
        let lid = 0;

        // User rule: "If we detect 4 distinct weights we assume a tea tray is used. The first weight is then always the tray."
        // A tray implies at least a Tray and a Vessel were added (componentsAdded.length >= 2)
        let hasTray = uniqueWeights.length >= 4 && componentsAdded.length >= 2;

        if (!hasTray && componentsAdded.length === 2 && maxLidRemoved > 0) {
            // Deduce by physical component logic: if second component is NOT the lid we removed, it must be the vessel and first is Tray.
            if (Math.abs(componentsAdded[1] - maxLidRemoved) > 5) {
                hasTray = true;
            }
        }

        if (hasTray) {
            if (componentsAdded.length >= 3) {
                tray = componentsAdded[0];
                vessel = componentsAdded[1];
                lid = componentsAdded[2];
            } else if (componentsAdded.length === 2) {
                tray = componentsAdded[0];
                vessel = componentsAdded[1];
                if (maxLidRemoved > 0) {
                    lid = maxLidRemoved;
                    vessel = vessel - lid;
                }
            } else if (componentsAdded.length === 1) {
                tray = componentsAdded[0];
            }
        } else {
            if (componentsAdded.length >= 2) {
                vessel = componentsAdded[0];
                lid = componentsAdded[1];
            } else if (componentsAdded.length === 1) {
                vessel = componentsAdded[0];
                if (maxLidRemoved > 0) {
                    lid = maxLidRemoved;
                    vessel = vessel - lid;
                }
            }
        }

        tray = Math.max(0, parseFloat(tray.toFixed(1)));
        vessel = Math.max(0, parseFloat(vessel.toFixed(1)));
        lid = Math.max(0, parseFloat(lid.toFixed(1)));
        teaAdded = Math.max(0, parseFloat(teaAdded.toFixed(1)));

        const setupWeightsChanged = session.vesselWeight !== vessel || session.lidWeight !== lid;
        let updated = false;
        if (session.trayWeight !== tray) { session.trayWeight = tray; updated = true; }
        if (session.vesselWeight !== vessel && vessel > 0) { session.vesselWeight = vessel; updated = true; }
        if (session.lidWeight !== lid && lid > 0) { session.lidWeight = lid; updated = true; }
        if (session.dryTeaLeavesWeight !== teaAdded) { session.dryTeaLeavesWeight = teaAdded; updated = true; }

        if (updated) {
            this.emitSession(session);
        }

        if (setupWeightsChanged) {
            void this.syncBrewingVesselForSession(session.sessionId);
        }
    }

    private hasBrewingVesselWeights(session: BrewingSession): boolean {
        return (session.vesselWeight || 0) > 0 && (session.lidWeight || 0) > 0;
    }

    private assignBrewingVessel(session: BrewingSession, brewingVessel: BrewingVessel | null): boolean {
        const currentVessel = session.brewingVessel;
        const currentVesselId = currentVessel?.vesselId ?? session.brewingVesselId ?? null;
        const nextVesselId = brewingVessel?.vesselId ?? null;

        const hasChanged =
            currentVesselId !== nextVesselId ||
            currentVessel?.name !== brewingVessel?.name ||
            currentVessel?.vesselWeight !== brewingVessel?.vesselWeight ||
            currentVessel?.lidWeight !== brewingVessel?.lidWeight;

        if (!hasChanged) {
            return false;
        }

        session.brewingVesselId = nextVesselId;
        session.brewingVessel = brewingVessel;
        return true;
    }

    private async syncBrewingVesselForSession(sessionId: string) {
        const session = this.session$.value;
        if (!session || session.sessionId !== sessionId) {
            return;
        }

        if (!this.hasBrewingVesselWeights(session)) {
            if (this.assignBrewingVessel(session, null)) {
                this.emitSession(session);
                await sessionRepository.saveSession(session);
            }
            return;
        }

        const brewingVessel = await brewingVesselRepository.findSimilarVessel(session.vesselWeight, session.lidWeight);
        const currentSession = this.session$.value;
        if (!currentSession || currentSession.sessionId !== sessionId) {
            return;
        }

        if (this.assignBrewingVessel(currentSession, brewingVessel)) {
            this.emitSession(currentSession);
            await sessionRepository.saveSession(currentSession);
        }
    }

    private async saveBrewingVesselForSession(sessionId: string, name: string) {
        const session = this.session$.value;
        if (!session || session.sessionId !== sessionId || !this.hasBrewingVesselWeights(session)) {
            return;
        }

        const brewingVessel = session.brewingVessel ?? await brewingVesselRepository.findSimilarVessel(session.vesselWeight, session.lidWeight) ?? new BrewingVessel();
        if (!brewingVessel.vesselId) {
            brewingVessel.vesselId = crypto.randomUUID();
        }

        brewingVessel.name = name;
        brewingVessel.vesselWeight = session.vesselWeight;
        brewingVessel.lidWeight = session.lidWeight;

        const savedBrewingVessel = await brewingVesselRepository.saveBrewingVessel(brewingVessel);
        const currentSession = this.session$.value;
        if (!currentSession || currentSession.sessionId !== sessionId) {
            return;
        }

        this.assignBrewingVessel(currentSession, savedBrewingVessel);
        this.emitSession(currentSession);
        await sessionRepository.saveSession(currentSession);
    }

    private deriveRestoredPhase(session: BrewingSession): BrewingPhase {
        if ((session.infusions?.length || 0) > 0) {
            return BrewingPhase.REST;
        }

        const hasSetupData = Boolean(
            (session.vesselWeight || 0) > 0 ||
            (session.lidWeight || 0) > 0 ||
            (session.trayWeight || 0) > 0 ||
            (session.dryTeaLeavesWeight || 0) > 0
        );

        return hasSetupData ? BrewingPhase.READY : BrewingPhase.SETUP;
    }

    private buildRestoredSetupWeights(session: BrewingSession): number[] {
        const weights = [0];
        const trayWeight = session.trayWeight || 0;
        const vesselWeight = session.vesselWeight || 0;
        const lidWeight = session.lidWeight || 0;
        const dryTeaLeavesWeight = session.dryTeaLeavesWeight || 0;

        if (trayWeight > 0) {
            weights.push(trayWeight);
        }
        if (vesselWeight > 0) {
            weights.push(trayWeight + vesselWeight);
        }
        if (lidWeight > 0) {
            weights.push(trayWeight + vesselWeight + lidWeight);
        }
        if (dryTeaLeavesWeight > 0) {
            weights.push(trayWeight + vesselWeight + dryTeaLeavesWeight);
        }

        return weights;
    }

    private calculateRestoredStableWeight(session: BrewingSession): number {
        const trayWeight = session.trayWeight || 0;
        const vesselWeight = session.vesselWeight || 0;
        const lidWeight = session.lidWeight || 0;
        const wasteWater = session.currentWasteWater || 0;
        const baseWeight = trayWeight + vesselWeight + wasteWater;

        if ((session.infusions?.length || 0) > 0) {
            const lastInfusion = session.infusions[session.infusions.length - 1];
            return parseFloat((baseWeight + lidWeight + (lastInfusion.wetTeaLeavesWeight || 0)).toFixed(1));
        }

        return parseFloat((baseWeight + lidWeight + (session.dryTeaLeavesWeight || 0)).toFixed(1));
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
        const session = this.session$.value;
        const vesselWeight = session?.vesselWeight || 0;

        // Detect Vessel Lift: weight dropped significantly from max (by at least vesselWeight)
        if (this.maxWeightInPhase > 0 && weight < this.maxWeightInPhase - vesselWeight) {
            this.lastLiftTime = Date.now();
            this.lowestLiftedWeight = weight;

            const baseTray = session?.trayWeight || 0;
            if (session) {
                const wasteWater = parseFloat(Math.max(0, weight - baseTray).toFixed(1));
                session.currentWasteWater = wasteWater;
                this.emitSession(session);
            }
            this.state$.next(BrewingPhase.INFUSION_VESSEL_LIFTED);
            this.stopTimer(); // Pause timer while lifted
            return;
        }

        // What if they put the lid on? Weight increases by `lidWeight`.
        // We ignore that.
    }

    private handleVesselLiftedPhase(weight: number) {
        const session = this.session$.value;
        const baseTray = session?.trayWeight || 0;

        // Track lowest stable weight while vessel is lifted
        if (weight < this.lowestLiftedWeight) {
            this.lowestLiftedWeight = weight;
            // Update waste water from lowest weight seen
            if (session) {
                const wasteWater = parseFloat(Math.max(0, weight - baseTray).toFixed(1));
                session.currentWasteWater = wasteWater;
                this.emitSession(session);
            }
        }

        // Recompute after waste water update
        const currentEmptyBase = baseTray + (session?.currentWasteWater || 0);

        // Check for return
        if (weight > currentEmptyBase + this.ZERO_THRESHOLD) {
            // Vessel returned.
            const wasteWaterDelta = (session?.currentWasteWater || 0) - this.lastStableWasteWater;
            const predictedEmptyWeight = this.lastStableWeight + wasteWaterDelta;

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
                const liftDuration = Date.now() - this.lastLiftTime;
                const currentTimer = this.timer$.value;
                this.timer$.next(currentTimer + liftDuration);

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
            const trayWeight = session.trayWeight || 0;
            const wasteWater = session.currentWasteWater || 0;

            infusion.waterWeight = parseFloat(Math.max(0, this.maxWeightInPhase - trayWeight - wasteWater - vesselWeight - lidWeight - teaWeight).toFixed(1));

            // Calculate wet leaves
            let wetLeaves = 0;
            if (hasLid) {
                wetLeaves = currentWeight - trayWeight - wasteWater - vesselWeight - lidWeight;
            } else {
                wetLeaves = currentWeight - trayWeight - wasteWater - vesselWeight;
            }
            infusion.wetTeaLeavesWeight = parseFloat(Math.max(0, wetLeaves).toFixed(1));

            // Save infusion
            infusion.session = session;
            session.infusions = [...(session.infusions || []), infusion];

            sessionRepository.saveSession(session);

            this.emitSession(session);

            // Update lastStableWeight (normalized to V + L + WetLeaves)
            this.lastStableWeight = hasLid ? currentWeight : currentWeight + lidWeight;
            this.lastStableWasteWater = session.currentWasteWater || 0;
            this.lowestLiftedWeight = Infinity;
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
        void keepAwakeService.allowSleep();
        keepAwakeService.resetForTest();

        this.currentWeight = 0;
        this.lastStableWeight = 0;
        this.lastStableWasteWater = 0;
        this.maxWeightInPhase = 0;
        this.lastLiftTime = 0;
        this.lowestLiftedWeight = Infinity;
        this.timerStartTime = 0;
        this.setupStepWeights = [];

        this.state$.next(BrewingPhase.ENDED);
        this.session$.next(null);
        this.currentInfusion$.next(null);
        this.timer$.next(0);
    }
}

export const brewingSessionService = BrewingSessionService.getInstance();
