import { useEffect } from 'react';
import { useStore } from '../stores/useStore';
import { brewingSessionService } from '../services/brewing/BrewingSessionService';

export const useBrewingSync = () => {
    const setBrewingState = useStore((state) => state.setBrewingState);

    useEffect(() => {
        // Subscribe to Service State
        const stateSub = brewingSessionService.state$.subscribe((phase) => {
            setBrewingState({ brewingPhase: phase });
        });

        const sessionSub = brewingSessionService.session$.subscribe((session) => {
            setBrewingState({ activeSession: session });
        });

        const infusionSub = brewingSessionService.currentInfusion$.subscribe((infusion) => {
            setBrewingState({ currentInfusion: infusion });
        });

        const timerSub = brewingSessionService.timer$.subscribe((time) => {
            setBrewingState({ timerValue: time });
        });

        return () => {
            stateSub.unsubscribe();
            sessionSub.unsubscribe();
            infusionSub.unsubscribe();
            timerSub.unsubscribe();
        };
    }, [setBrewingState]);

    return null; // This hook doesn't render anything
};
