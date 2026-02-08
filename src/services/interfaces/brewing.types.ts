import { BrewingSession } from '../../entities/BrewingSession.entity';
import { Infusion } from '../../entities/Infusion.entity';

export enum BrewingPhase {
    IDLE = 'idle',
    SETUP = 'setup',
    READY = 'ready', // Ready to start first infusion (after manual confirmation)
    INFUSION = 'infusion',
    INFUSION_VESSEL_LIFTED = 'infusion_vessel_lifted',
    REST = 'rest',
    ENDED = 'ended'
}

export enum WeightTrend {
    STABLE = 'STABLE',
    INCREASING = 'INCREASING',
    DECREASING = 'DECREASING',
    CHAOTIC = 'CHAOTIC'
}

export interface BrewingStateData {
    phase: BrewingPhase;
    activeSession: BrewingSession | null;
    currentInfusion: Infusion | null;
    currentWeight: number;
    timerValue: number; // Current timer value in ms
    vesselWeight: number;
    lidWeight: number;
    dryTeaWeight: number;
}
