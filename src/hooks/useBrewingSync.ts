import { useEffect } from 'react';
import { brewingSessionService } from '../services/brewing/BrewingSessionService';
import { useShallow } from 'zustand/react/shallow';
import { useBrewingStore } from '../stores/useBrewingStore';

export const useBrewingSync = () => {
    const {
        setActiveSession,
        setBrewingPhase,
        setCurrentInfusion,
        setEditableInfusionMetadata,
        setFirstInfusionDraft,
        setTimerValue,
    } = useBrewingStore(useShallow((state) => ({
        setActiveSession: state.setActiveSession,
        setBrewingPhase: state.setBrewingPhase,
        setCurrentInfusion: state.setCurrentInfusion,
        setEditableInfusionMetadata: state.setEditableInfusionMetadata,
        setFirstInfusionDraft: state.setFirstInfusionDraft,
        setTimerValue: state.setTimerValue,
    })));

    useEffect(() => {
        const stateSub = brewingSessionService.state$.subscribe((phase) => {
            setBrewingPhase(phase);
        });

        const sessionSub = brewingSessionService.session$.subscribe((session) => {
            setActiveSession(session);
        });

        const infusionSub = brewingSessionService.currentInfusion$.subscribe((infusion) => {
            setCurrentInfusion(infusion);
        });

        const firstInfusionDraftSub = brewingSessionService.firstInfusionDraft$.subscribe((firstInfusionDraft) => {
            setFirstInfusionDraft(firstInfusionDraft);
        });

        const editableInfusionMetadataSub = brewingSessionService.editableInfusionMetadata$.subscribe((editableInfusionMetadata) => {
            setEditableInfusionMetadata(editableInfusionMetadata);
        });

        const timerSub = brewingSessionService.timer$.subscribe((time) => {
            setTimerValue(time);
        });

        return () => {
            stateSub.unsubscribe();
            sessionSub.unsubscribe();
            infusionSub.unsubscribe();
            firstInfusionDraftSub.unsubscribe();
            editableInfusionMetadataSub.unsubscribe();
            timerSub.unsubscribe();
        };
    }, [
        setActiveSession,
        setBrewingPhase,
        setCurrentInfusion,
        setEditableInfusionMetadata,
        setFirstInfusionDraft,
        setTimerValue,
    ]);

    return null;
};
