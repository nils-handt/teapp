import { BehaviorSubject, Subscription } from 'rxjs';
import { bufferTime, filter } from 'rxjs/operators';
import { bluetoothScaleService } from '../BluetoothScaleService';
import { sessionRepository } from '../../repositories/SessionRepository';
import { brewingVesselRepository } from '../../repositories/BrewingVesselRepository';
import { BrewingSession } from '../../entities/BrewingSession.entity';
import { BrewingVessel } from '../../entities/BrewingVessel.entity';
import { Infusion } from '../../entities/Infusion.entity';
import { Tea } from '../../entities/Tea.entity';
import { formatTeaLabel } from '../../utils/teaSearch';

import {
    BrewingPhase,
    type EditableInfusionMetadata,
    type InfusionMetadataDraft,
    WeightTrend,
} from '../interfaces/brewing.types';
import { keepAwakeService } from '../KeepAwakeService';
import { createLogger } from '../logging';

type SetupField = 'vesselWeight' | 'lidWeight' | 'dryTeaLeavesWeight';

const logger = createLogger('BrewingSessionService');
const EMPTY_INFUSION_METADATA: InfusionMetadataDraft = { note: '', temperature: null };

type SessionResetOptions = {
    phase: BrewingPhase;
    session?: BrewingSession | null;
    setupStepWeights?: number[];
    resetKeepAwakeService?: boolean;
};

class BrewingSessionService {
    private static instance: BrewingSessionService;
    private weightSubscription: Subscription | null = null;

    // State via BehaviorSubjects
    public state$ = new BehaviorSubject<BrewingPhase>(BrewingPhase.IDLE);
    public session$ = new BehaviorSubject<BrewingSession | null>(null);
    public currentInfusion$ = new BehaviorSubject<Infusion | null>(null);
    public firstInfusionDraft$ = new BehaviorSubject<InfusionMetadataDraft>(EMPTY_INFUSION_METADATA);
    public editableInfusionMetadata$ = new BehaviorSubject<EditableInfusionMetadata>({
        ...EMPTY_INFUSION_METADATA,
        infusionId: null,
        source: 'none',
    });
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
    private readonly POUR_DETECTION_TOLERANCE = 30;
    private readonly MAX_DRY_TEA_LEAVES_WEIGHT = 30;


    private constructor() {
        // defined in startSession
    }

    public static getInstance(): BrewingSessionService {
        if (!BrewingSessionService.instance) {
            BrewingSessionService.instance = new BrewingSessionService();
        }
        return BrewingSessionService.instance;
    }

    private setPhase(phase: BrewingPhase) {
        this.state$.next(phase);
        this.refreshEditableInfusionMetadata();
    }

    private emitSession(session: BrewingSession) {
        this.session$.next({
            ...session,
            infusions: [...(session.infusions || [])],
        });
        this.refreshEditableInfusionMetadata();
    }

    private assignTea(session: BrewingSession, tea: Tea | null): boolean {
        const nextTeaId = tea?.teaId ?? null;
        const currentTeaId = session.tea?.teaId ?? session.teaId ?? null;
        const hasChanged = currentTeaId !== nextTeaId || formatTeaLabel(session.tea) !== formatTeaLabel(tea);

        if (!hasChanged) {
            return false;
        }

        session.tea = tea;
        session.teaId = nextTeaId;
        session.teaName = formatTeaLabel(tea);
        return true;
    }

    private emitCurrentInfusion(infusion: Infusion | null) {
        this.currentInfusion$.next(infusion ? { ...infusion } : null);
        this.refreshEditableInfusionMetadata();
    }

    private setFirstInfusionDraft(draft: InfusionMetadataDraft) {
        this.firstInfusionDraft$.next({
            note: draft.note.trim(),
            temperature: draft.temperature ?? null,
        });
        this.refreshEditableInfusionMetadata();
    }

    private getLastInfusion(session: BrewingSession | null): Infusion | null {
        if (!session?.infusions?.length) {
            return null;
        }

        return session.infusions[session.infusions.length - 1];
    }

    private getRestingInfusion(): Infusion | null {
        const session = this.session$.value;
        const currentInfusion = this.currentInfusion$.value;
        const lastInfusion = this.getLastInfusion(session);

        if (currentInfusion && lastInfusion?.infusionId === currentInfusion.infusionId) {
            return currentInfusion;
        }

        return lastInfusion;
    }

    private refreshEditableInfusionMetadata() {
        const session = this.session$.value;
        const phase = this.state$.value;
        const currentInfusion = this.currentInfusion$.value;
        const firstInfusionDraft = this.firstInfusionDraft$.value;

        let nextMetadata: EditableInfusionMetadata = {
            ...EMPTY_INFUSION_METADATA,
            infusionId: null,
            source: 'none',
        };

        if (phase === BrewingPhase.READY && (session?.infusions?.length ?? 0) === 0) {
            nextMetadata = {
                ...firstInfusionDraft,
                infusionId: null,
                source: 'draft',
            };
        } else if ((phase === BrewingPhase.INFUSION || phase === BrewingPhase.INFUSION_VESSEL_LIFTED) && currentInfusion) {
            nextMetadata = {
                note: currentInfusion.note ?? '',
                temperature: currentInfusion.temperature ?? null,
                infusionId: currentInfusion.infusionId,
                source: 'current',
            };
        } else if (phase === BrewingPhase.REST) {
            const restingInfusion = this.getRestingInfusion();
            if (restingInfusion) {
                nextMetadata = {
                    note: restingInfusion.note ?? '',
                    temperature: restingInfusion.temperature ?? null,
                    infusionId: restingInfusion.infusionId,
                    source: 'resting',
                };
            }
        }

        this.editableInfusionMetadata$.next(nextMetadata);
    }

    private updateSavedInfusion(infusionId: string, updates: Partial<Pick<Infusion, 'note' | 'temperature'>>) {
        const session = this.session$.value;
        if (!session) {
            return;
        }

        const targetInfusion = session.infusions?.find((infusion) => infusion.infusionId === infusionId);
        if (!targetInfusion) {
            return;
        }

        if (updates.note !== undefined) {
            targetInfusion.note = updates.note;
        }

        if (updates.temperature !== undefined) {
            targetInfusion.temperature = updates.temperature;
        }

        const currentInfusion = this.currentInfusion$.value;
        if (currentInfusion?.infusionId === infusionId) {
            if (updates.note !== undefined) {
                currentInfusion.note = updates.note;
            }
            if (updates.temperature !== undefined) {
                currentInfusion.temperature = updates.temperature;
            }
            this.emitCurrentInfusion(currentInfusion);
        }

        this.emitSession(session);
        void sessionRepository.saveSession(session);
    }

    public updateFirstInfusionDraftNote(note: string) {
        this.setFirstInfusionDraft({
            ...this.firstInfusionDraft$.value,
            note,
        });
    }

    public updateFirstInfusionDraftTemperature(temperature: number | null) {
        this.setFirstInfusionDraft({
            ...this.firstInfusionDraft$.value,
            temperature,
        });
    }

    public updateCurrentInfusionNote(note: string) {
        const infusion = this.currentInfusion$.value;
        const activePhase = this.state$.value === BrewingPhase.INFUSION || this.state$.value === BrewingPhase.INFUSION_VESSEL_LIFTED;
        if (!infusion || !activePhase) {
            return;
        }

        infusion.note = note.trim();
        this.emitCurrentInfusion(infusion);
    }

    public updateCurrentInfusionTemperature(temperature: number | null) {
        const infusion = this.currentInfusion$.value;
        const activePhase = this.state$.value === BrewingPhase.INFUSION || this.state$.value === BrewingPhase.INFUSION_VESSEL_LIFTED;
        if (!infusion || !activePhase) {
            return;
        }

        infusion.temperature = temperature;
        this.emitCurrentInfusion(infusion);
    }

    public updateRestingInfusionNote(note: string) {
        if (this.state$.value !== BrewingPhase.REST) {
            return;
        }

        const restingInfusion = this.getRestingInfusion();
        if (!restingInfusion) {
            return;
        }

        this.updateSavedInfusion(restingInfusion.infusionId, { note: note.trim() });
    }

    public updateRestingInfusionTemperature(temperature: number | null) {
        if (this.state$.value !== BrewingPhase.REST) {
            return;
        }

        const restingInfusion = this.getRestingInfusion();
        if (!restingInfusion) {
            return;
        }

        this.updateSavedInfusion(restingInfusion.infusionId, { temperature });
    }

    public updateEditableInfusionNote(note: string) {
        const phase = this.state$.value;

        if (phase === BrewingPhase.READY && (this.session$.value?.infusions?.length ?? 0) === 0) {
            this.updateFirstInfusionDraftNote(note);
            return;
        }

        if (phase === BrewingPhase.INFUSION || phase === BrewingPhase.INFUSION_VESSEL_LIFTED) {
            this.updateCurrentInfusionNote(note);
            return;
        }

        if (phase === BrewingPhase.REST) {
            this.updateRestingInfusionNote(note);
        }
    }

    public updateEditableInfusionTemperature(temperature: number | null) {
        const phase = this.state$.value;

        if (phase === BrewingPhase.READY && (this.session$.value?.infusions?.length ?? 0) === 0) {
            this.updateFirstInfusionDraftTemperature(temperature);
            return;
        }

        if (phase === BrewingPhase.INFUSION || phase === BrewingPhase.INFUSION_VESSEL_LIFTED) {
            this.updateCurrentInfusionTemperature(temperature);
            return;
        }

        if (phase === BrewingPhase.REST) {
            this.updateRestingInfusionTemperature(temperature);
        }
    }

    public updateSavedInfusionNote(infusionId: string, note: string) {
        this.updateSavedInfusion(infusionId, { note: note.trim() });
    }

    public updateSessionNotes(note: string) {
        const session = this.session$.value;
        if (!session) {
            return;
        }

        session.notes = note.trim();
        this.emitSession(session);
        void sessionRepository.saveSession(session);
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
            const analysisWeight = this.state$.value === BrewingPhase.SETUP && trend === WeightTrend.INCREASING
                ? Math.max(...weights)
                : averageWeight;
            this.handleWeightUpdate(analysisWeight, trend);
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
                } else if (trend === WeightTrend.INCREASING) {
                    this.maybeStartInfusionFromSetupWater(weight);
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

    private resetSessionState({
        phase,
        session = null,
        setupStepWeights = [],
        resetKeepAwakeService = false,
    }: SessionResetOptions) {
        this.stopTimer();
        this.stopWeightSubscription();
        void keepAwakeService.allowSleep();

        if (resetKeepAwakeService) {
            keepAwakeService.resetForTest();
        }

        this.currentWeight = 0;
        this.lastStableWeight = 0;
        this.lastStableWasteWater = 0;
        this.maxWeightInPhase = 0;
        this.lastLiftTime = 0;
        this.lowestLiftedWeight = Infinity;
        this.timerStartTime = 0;
        this.setupStepWeights = [...setupStepWeights];

        this.timer$.next(0);
        this.emitCurrentInfusion(null);
        this.setFirstInfusionDraft(EMPTY_INFUSION_METADATA);

        if (session) {
            this.emitSession(session);
        } else {
            this.session$.next(null);
        }

        this.setPhase(phase);
    }

    // --- Public Actions ---

    public startSession(tea?: Tea | string, notes?: string) {
        logger.info('Starting brewing session', {
            teaName: typeof tea === 'string' ? tea : formatTeaLabel(tea),
            hasNotes: Boolean(notes),
        });
        const session = new BrewingSession();
        session.sessionId = crypto.randomUUID(); // Requires secure context or polyfill. If failing, move to uuid lib.
        session.teaName = typeof tea === 'string' ? tea : formatTeaLabel(tea);
        session.teaId = typeof tea === 'string' ? null : tea?.teaId ?? null;
        session.tea = typeof tea === 'string' ? null : tea ?? null;
        session.startTime = new Date().toISOString();
        session.status = 'active';
        session.notes = notes || '';
        session.infusions = [];
        session.vesselWeight = 0;
        session.lidWeight = 0;
        session.dryTeaLeavesWeight = 0;
        session.currentWasteWater = 0;
        session.brewingVesselId = null;
        session.brewingVessel = null;

        this.resetSessionState({
            phase: BrewingPhase.SETUP,
            session,
            setupStepWeights: [0],
        });

        this.initializeWeightSubscription();
        void keepAwakeService.keepAwake();
    }

    public restoreSession(session: BrewingSession) {
        logger.info('Restoring brewing session', {
            sessionId: session.sessionId,
            infusionCount: session.infusions?.length || 0,
        });
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
        this.emitCurrentInfusion(null);
        this.setFirstInfusionDraft(EMPTY_INFUSION_METADATA);
        this.setupStepWeights = this.buildRestoredSetupWeights(restoredSession);
        this.lastStableWasteWater = restoredSession.currentWasteWater || 0;
        this.lastStableWeight = this.calculateRestoredStableWeight(restoredSession);

        this.emitSession(restoredSession);
        this.setPhase(resumedPhase);

        this.initializeWeightSubscription();
        void keepAwakeService.keepAwake();
        logger.info('Brewing session restored', { sessionId: restoredSession.sessionId, phase: resumedPhase });
    }

    public clearSession() {
        logger.info('Clearing brewing session state');
        this.resetSessionState({
            phase: BrewingPhase.IDLE,
        });
    }

    public confirmSetupDone() {
        const session = this.session$.value;
        if (session) {
            // Values are already in session object from handleSetupPhase

            // Persist initial session? Or wait? better save now in case of crash.
            sessionRepository.saveSession(session);
            this.emitSession(session);

            this.setPhase(BrewingPhase.READY);

            // Normalize lastStableWeight to include Lid if missing
            let weight = this.currentWeight;
            const expectedNoLid = (session.vesselWeight || 0) + (session.dryTeaLeavesWeight || 0);

            if (Math.abs(weight - expectedNoLid) < this.LID_REMOVAL_THRESHOLD) {
                weight += (session.lidWeight || 0);
            }
            this.lastStableWeight = weight;
            this.lastStableWasteWater = 0;
            logger.info('Brewing setup confirmed', {
                sessionId: session.sessionId,
                vesselWeight: session.vesselWeight,
                lidWeight: session.lidWeight,
                dryTeaLeavesWeight: session.dryTeaLeavesWeight,
            });
        }
    }

    public async endSession() {
        logger.info('Ending brewing session', { sessionId: this.session$.value?.sessionId ?? null });
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
            logger.info('Brewing session completed', {
                sessionId: session.sessionId,
                infusionCount: session.infusions?.length || 0,
            });
        }
        this.emitCurrentInfusion(null);
        this.setPhase(BrewingPhase.ENDED);
        this.stopWeightSubscription();
    }

    public async undoEndSession() {
        const session = this.session$.value;

        if (!session || this.state$.value !== BrewingPhase.ENDED) {
            return;
        }

        session.status = 'active';
        session.endTime = '';
        await sessionRepository.saveSession(session);
        this.restoreSession(session);
        logger.info('Reopened ended brewing session', { sessionId: session.sessionId });
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
        session.teaId = null;
        session.tea = null;
        this.emitSession(session);
        void sessionRepository.saveSession(session);
    }

    public updateTea(tea: Tea | null) {
        const session = this.session$.value;
        const allowedPhases = new Set<BrewingPhase>([
            BrewingPhase.SETUP,
            BrewingPhase.READY,
            BrewingPhase.INFUSION,
            BrewingPhase.INFUSION_VESSEL_LIFTED,
            BrewingPhase.REST,
            BrewingPhase.ENDED,
        ]);

        if (!session || !allowedPhases.has(this.state$.value)) {
            return;
        }

        if (!this.assignTea(session, tea)) {
            return;
        }

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

        logger.info('Updating brewing vessel name', { sessionId: session.sessionId, name: trimmedName });
        void this.saveBrewingVesselForSession(session.sessionId, trimmedName);
    }

    public updateSetupValue(field: SetupField, value: number) {
        const session = this.session$.value;
        if (!session || this.state$.value !== BrewingPhase.SETUP) {
            return;
        }

        const normalizedValue = parseFloat(Math.max(0, value).toFixed(1));
        session[field] = normalizedValue;
        logger.debug('Updating setup value', { sessionId: session.sessionId, field, value: normalizedValue });

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

        const roundedWeight = this.roundWeight(weight);
        if (this.maybeStartInfusionFromSetupWater(roundedWeight)) {
            return;
        }

        const lastRecordedWeight = this.setupStepWeights.length > 0 ? this.setupStepWeights[this.setupStepWeights.length - 1] : 0;
        if (roundedWeight !== lastRecordedWeight) {
            this.setupStepWeights.push(roundedWeight);
            this.recalculateSetupWeights(roundedWeight);
        }
    }

    private recalculateSetupWeights(currentStableWeight: number = this.setupStepWeights[this.setupStepWeights.length - 1] ?? 0) {
        const session = this.session$.value;
        if (!session) return;

        const lidRemoval = this.findSetupLidRemoval();
        let vessel = 0;
        let lid = 0;
        let teaAdded = 0;

        if (lidRemoval) {
            vessel = lidRemoval.weightAfterRemoval;
            lid = lidRemoval.removedWeight;
            teaAdded = this.calculateSetupLeafWeight(currentStableWeight, {
                ...session,
                vesselWeight: vessel,
                lidWeight: lid,
            });
        } else {
            const firstPositiveStableWeight = this.setupStepWeights.find(w => w > 0);
            if (firstPositiveStableWeight !== undefined) {
                vessel = firstPositiveStableWeight;
            }
        }

        vessel = this.roundWeight(Math.max(0, vessel));
        lid = this.roundWeight(Math.max(0, lid));
        teaAdded = this.roundWeight(Math.max(0, teaAdded));

        const setupWeightsChanged = session.vesselWeight !== vessel || session.lidWeight !== lid;
        let updated = false;
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

    private roundWeight(weight: number): number {
        return parseFloat(weight.toFixed(1));
    }

    private findSetupLidRemoval(): { removedWeight: number; weightAfterRemoval: number } | null {
        for (let i = 1; i < this.setupStepWeights.length; i += 1) {
            const delta = this.setupStepWeights[i] - this.setupStepWeights[i - 1];
            if (delta <= -this.LID_REMOVAL_THRESHOLD) {
                return {
                    removedWeight: Math.abs(delta),
                    weightAfterRemoval: this.setupStepWeights[i],
                };
            }
        }

        return null;
    }

    private calculateSetupLeafWeight(weight: number, session: BrewingSession, referenceWeight?: number): number {
        const vesselWeight = session.vesselWeight || 0;
        const lidWeight = session.lidWeight || 0;
        const previousDryTeaLeavesWeight = session.dryTeaLeavesWeight || 0;
        const candidates = [
            { baseline: vesselWeight, leafWeight: weight - vesselWeight },
            ...(lidWeight > 0 ? [{ baseline: vesselWeight + lidWeight, leafWeight: weight - vesselWeight - lidWeight }] : []),
        ].filter(candidate => candidate.leafWeight >= 0);

        if (candidates.length === 0) {
            return 0;
        }

        if (referenceWeight !== undefined) {
            const referenceCandidate = candidates.reduce((closest, candidate) => (
                Math.abs(referenceWeight - candidate.baseline - previousDryTeaLeavesWeight) <
                    Math.abs(referenceWeight - closest.baseline - previousDryTeaLeavesWeight)
                    ? candidate
                    : closest
            ), candidates[0]);
            return weight - referenceCandidate.baseline;
        }

        return candidates.reduce((closest, candidate) => (
            Math.abs(candidate.leafWeight - previousDryTeaLeavesWeight) < Math.abs(closest.leafWeight - previousDryTeaLeavesWeight)
                ? candidate
                : closest
        ), candidates[0]).leafWeight;
    }

    private maybeStartInfusionFromSetupWater(weight: number): boolean {
        const session = this.session$.value;
        if (!session || !this.hasBrewingVesselWeights(session) || (session.dryTeaLeavesWeight || 0) <= 0) {
            return false;
        }

        const lastRecordedWeight = this.setupStepWeights[this.setupStepWeights.length - 1];
        const leafWeight = this.calculateSetupLeafWeight(weight, session, lastRecordedWeight);
        if (leafWeight <= this.MAX_DRY_TEA_LEAVES_WEIGHT) {
            return false;
        }

        this.lastStableWeight = this.roundWeight(
            (session.vesselWeight || 0) +
            (session.lidWeight || 0) +
            (session.dryTeaLeavesWeight || 0)
        );
        this.lastStableWasteWater = 0;
        void sessionRepository.saveSession(session);
        this.emitSession(session);
        this.startInfusion();
        return true;
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
                logger.info('Cleared brewing vessel assignment because setup weights are incomplete', { sessionId });
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
            logger.info('Synchronized brewing vessel assignment', {
                sessionId,
                vesselId: brewingVessel?.vesselId ?? null,
                vesselName: brewingVessel?.name ?? null,
            });
        }
    }

    private async saveBrewingVesselForSession(sessionId: string, name: string) {
        const session = this.session$.value;
        if (!session || session.sessionId !== sessionId || !this.hasBrewingVesselWeights(session)) {
            return;
        }

        logger.info('Saving brewing vessel for session', { sessionId, name });
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
        logger.info('Saved brewing vessel for session', {
            sessionId,
            vesselId: savedBrewingVessel.vesselId,
            vesselName: savedBrewingVessel.name,
        });
    }

    private deriveRestoredPhase(session: BrewingSession): BrewingPhase {
        if ((session.infusions?.length || 0) > 0) {
            return BrewingPhase.REST;
        }

        const hasSetupData = Boolean(
            (session.vesselWeight || 0) > 0 ||
            (session.lidWeight || 0) > 0 ||
            (session.dryTeaLeavesWeight || 0) > 0
        );

        return hasSetupData ? BrewingPhase.READY : BrewingPhase.SETUP;
    }

    private buildRestoredSetupWeights(session: BrewingSession): number[] {
        const weights = [0];
        const vesselWeight = session.vesselWeight || 0;
        const lidWeight = session.lidWeight || 0;
        const dryTeaLeavesWeight = session.dryTeaLeavesWeight || 0;

        if (vesselWeight > 0) {
            weights.push(vesselWeight);
        }
        if (lidWeight > 0) {
            weights.push(vesselWeight + lidWeight);
        }
        if (dryTeaLeavesWeight > 0) {
            weights.push(vesselWeight + dryTeaLeavesWeight);
        }

        return weights;
    }

    private calculateRestoredStableWeight(session: BrewingSession): number {
        const vesselWeight = session.vesselWeight || 0;
        const lidWeight = session.lidWeight || 0;
        const wasteWater = session.currentWasteWater || 0;
        const baseWeight = vesselWeight + wasteWater;

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

            if (session) {
                const wasteWater = parseFloat(Math.max(0, weight).toFixed(1));
                session.currentWasteWater = wasteWater;
                this.emitSession(session);
            }
            this.setPhase(BrewingPhase.INFUSION_VESSEL_LIFTED);
            this.stopTimer(); // Pause timer while lifted
            return;
        }

        // What if they put the lid on? Weight increases by `lidWeight`.
        // We ignore that.
    }

    private handleVesselLiftedPhase(weight: number) {
        const session = this.session$.value;

        // Track lowest stable weight while vessel is lifted
        if (weight < this.lowestLiftedWeight) {
            this.lowestLiftedWeight = weight;
            // Update waste water from lowest weight seen
            if (session) {
                const wasteWater = parseFloat(Math.max(0, weight).toFixed(1));
                session.currentWasteWater = wasteWater;
                this.emitSession(session);
            }
        }

        // Recompute after waste water update
        const currentEmptyBase = session?.currentWasteWater || 0;

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
                this.setPhase(BrewingPhase.INFUSION);
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

        const previousInfusion = this.getLastInfusion(session);
        const firstInfusionDraft = this.firstInfusionDraft$.value;

        const infusion = new Infusion();
        infusion.infusionId = crypto.randomUUID();
        infusion.infusionNumber = infusionNumber;
        infusion.startTime = new Date().toISOString();
        infusion.sessionId = session?.sessionId || '';
        infusion.duration = 0;
        infusion.note = infusionNumber === 1 ? firstInfusionDraft.note : '';
        infusion.temperature = infusionNumber === 1 ? firstInfusionDraft.temperature : previousInfusion?.temperature ?? null;

        if (session) {
            // We can't push to session.infusions directly if it's not set up to observe, but we can mutate and emit.
            // Better to define relationship properly.
        }

        if (infusionNumber === 1) {
            this.setFirstInfusionDraft(EMPTY_INFUSION_METADATA);
        }

        this.emitCurrentInfusion(infusion);
        this.setPhase(BrewingPhase.INFUSION);
        this.maxWeightInPhase = this.currentWeight;
        this.startTimer();
        logger.info('Starting infusion', {
            sessionId: session?.sessionId ?? null,
            infusionNumber,
        });
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
            const wasteWater = session.currentWasteWater || 0;

            infusion.waterWeight = parseFloat(Math.max(0, this.maxWeightInPhase - wasteWater - vesselWeight - lidWeight - teaWeight).toFixed(1));

            // Calculate wet leaves
            let wetLeaves = 0;
            if (hasLid) {
                wetLeaves = currentWeight - wasteWater - vesselWeight - lidWeight;
            } else {
                wetLeaves = currentWeight - wasteWater - vesselWeight;
            }
            infusion.wetTeaLeavesWeight = parseFloat(Math.max(0, wetLeaves).toFixed(1));

            // Save infusion
            infusion.session = session;
            session.infusions = [...(session.infusions || []), infusion];

            void sessionRepository.saveSession(session);

            this.emitSession(session);
            this.emitCurrentInfusion(infusion);

            // Update lastStableWeight (normalized to V + L + WetLeaves)
            this.lastStableWeight = hasLid ? currentWeight : currentWeight + lidWeight;
            this.lastStableWasteWater = session.currentWasteWater || 0;
            this.lowestLiftedWeight = Infinity;
            logger.info('Ending infusion', {
                sessionId: session.sessionId,
                infusionNumber: infusion.infusionNumber,
                hasLid,
                durationSeconds: infusion.duration,
                waterWeight: infusion.waterWeight,
                wetTeaLeavesWeight: infusion.wetTeaLeavesWeight,
            });
        }

        this.setPhase(BrewingPhase.REST);

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
            logger.warn('Manually starting infusion', { phase: this.state$.value });
            // Force state ready if setup
            if (this.state$.value === BrewingPhase.SETUP) this.confirmSetupDone();

            // Force jump to start infusion (e.g. skipped water detect)
            this.startInfusion();
        }
    }

    public manuallyStopInfusion() {
        if (this.state$.value === BrewingPhase.INFUSION || this.state$.value === BrewingPhase.INFUSION_VESSEL_LIFTED) {
            logger.warn('Manually stopping infusion', { phase: this.state$.value });
            this.endInfusion(this.currentWeight, true);
        }
    }

    /**
     * Resets the separate service state for testing purposes.
     * clears all subjects and internal state.
     */
    public resetForTest() {
        this.resetSessionState({
            phase: BrewingPhase.ENDED,
            resetKeepAwakeService: true,
        });
    }
}

export const brewingSessionService = BrewingSessionService.getInstance();
