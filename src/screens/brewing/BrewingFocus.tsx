import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonIcon } from '@ionic/react';
import React, { useEffect, useRef } from 'react';
import { BrewingPhase } from '../../services/interfaces/brewing.types';
import DesignSwitcher from '../../components/DesignSwitcher';
import { brewingSessionService } from '../../services/brewing/BrewingSessionService';
import { useBrewingControl } from '../../hooks/useBrewingControl';
import { checkmarkCircle } from 'ionicons/icons';
import { useShallow } from 'zustand/react/shallow';
import { useBrewingStore } from '../../stores/useBrewingStore';
import { useScaleStore } from '../../stores/useScaleStore';
import { cn } from '../../styles/zen';

const BrewingFocus: React.FC = () => {
    const { brewingPhase, timerValue } = useBrewingStore(useShallow((state) => ({
        brewingPhase: state.brewingPhase,
        timerValue: state.timerValue,
    })));
    const currentWeight = useScaleStore((state) => state.currentWeight);
    const { startBrewingSession, handleEndSession, recordingAlert } = useBrewingControl();
    const contentRef = useRef<HTMLIonContentElement>(null);

    // Auto-scroll to active step? 
    // For now, let's just highlight the current step.

    const steps = [
        { id: BrewingPhase.IDLE, label: 'Start Session', desc: 'Prepare your equipment' },
        { id: BrewingPhase.SETUP, label: 'Setup', desc: 'Place vessel, add tea' },
        { id: BrewingPhase.READY, label: 'Ready', desc: 'Waiting for water' },
        { id: BrewingPhase.INFUSION, label: 'Infusing', desc: 'Pour water' },
        { id: BrewingPhase.INFUSION_VESSEL_LIFTED, label: 'Pouring', desc: 'Pour out tea' },
        { id: BrewingPhase.REST, label: 'Resting', desc: 'Enjoy tea / Wait for next' },
        { id: BrewingPhase.ENDED, label: 'Finished', desc: 'Session complete' },
    ];

    // const currentStepIndex = steps.findIndex(s => s.id === brewingPhase);

    useEffect(() => {
        // Scroll to active item if needed
    }, [brewingPhase]);

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar color="dark">
                    <IonTitle>Focus Flow</IonTitle>
                    <DesignSwitcher />
                </IonToolbar>
            </IonHeader>
            <IonContent ref={contentRef} color="light">
                <div className="px-4 pt-4 pb-[100px]">
                    {steps.map((step, index) => {
                        const isActive = step.id === brewingPhase;
                        const isPast = steps.findIndex(s => s.id === brewingPhase) > index;

                        return (
                            <div
                                key={step.id}
                                className={cn(
                                    'mb-5 flex transition duration-300',
                                    isActive ? 'scale-105 opacity-100' : isPast ? 'opacity-50' : 'opacity-30',
                                )}
                            >
                                <div className="mr-[15px] flex w-10 flex-col items-center">
                                    <div
                                        className={cn(
                                            'flex h-[30px] w-[30px] items-center justify-center rounded-full font-bold text-white',
                                            isActive ? 'bg-[#007aff]' : isPast ? 'bg-[#4cd964]' : 'bg-[#ccc]',
                                        )}
                                    >
                                        {isPast ? <IonIcon icon={checkmarkCircle} /> : (index + 1)}
                                    </div>
                                    {index < steps.length - 1 && (
                                        <div className="mt-[5px] w-0.5 flex-1 bg-[#ddd]" />
                                    )}
                                </div>

                                <div
                                    className={cn(
                                        'flex-1 rounded-[10px]',
                                        isActive ? 'bg-white p-[15px] shadow-[0_4px_10px_rgba(0,0,0,0.1)]' : 'bg-transparent py-[5px]',
                                    )}
                                >
                                    <h3 className={cn('m-0', isActive ? 'font-bold text-black' : 'font-normal text-[#666]')}>
                                        {step.label}
                                    </h3>
                                    <p className="mt-[5px] mb-0 text-[0.9rem] text-[#888]">{step.desc}</p>

                                    {isActive && (
                                        <div className="mt-[15px]">
                                            {brewingPhase === BrewingPhase.INFUSION || brewingPhase === BrewingPhase.REST ? (
                                                <div className="text-[2rem] text-[#007aff]">
                                                    {(timerValue / 1000).toFixed(1)}s
                                                </div>
                                            ) : null}

                                            <div className="mt-[5px] font-bold">
                                                Weight: {currentWeight.toFixed(1)}g
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </IonContent>

            <div className="fixed right-0 bottom-0 left-0 flex justify-around bg-white px-5 py-2.5 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
                <IonButton fill="clear" onClick={() => startBrewingSession('Focus Tea')}>Start</IonButton>
                {brewingPhase === BrewingPhase.SETUP && (
                    <IonButton fill="clear" color="warning" onClick={() => brewingSessionService.confirmSetupDone()}>Confirm Setup</IonButton>
                )}
                <IonButton fill="clear" color="danger" onClick={() => handleEndSession()}>End</IonButton>
            </div>
            {recordingAlert}
        </IonPage>
    );
};

export default BrewingFocus;
