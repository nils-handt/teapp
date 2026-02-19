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
