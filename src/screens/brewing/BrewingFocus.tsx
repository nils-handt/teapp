import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonFooter, IonButton, IonIcon } from '@ionic/react';
import React, { useEffect, useRef } from 'react';
import { useStore } from '../../stores/useStore';
import { BrewingPhase } from '../../services/interfaces/brewing.types';
import DesignSwitcher from '../../components/DesignSwitcher';
import { brewingSessionService } from '../../services/brewing/BrewingSessionService';
import { useBrewingControl } from '../../hooks/useBrewingControl';
import { checkmarkCircle } from 'ionicons/icons';

const BrewingFocus: React.FC = () => {
    const { brewingPhase, timerValue, currentWeight } = useStore();
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
            <IonContent className="ion-padding" ref={contentRef} color="light">
                <div style={{ paddingBottom: '100px' }}>
                    {steps.map((step, index) => {
                        const isActive = step.id === brewingPhase;
                        const isPast = steps.findIndex(s => s.id === brewingPhase) > index;

                        return (
                            <div key={step.id} style={{
                                display: 'flex',
                                marginBottom: '20px',
                                opacity: isActive ? 1 : (isPast ? 0.5 : 0.3),
                                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                                transition: 'all 0.3s ease'
                            }}>
                                <div style={{
                                    width: '40px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    marginRight: '15px'
                                }}>
                                    <div style={{
                                        width: '30px',
                                        height: '30px',
                                        borderRadius: '50%',
                                        background: isActive ? '#007aff' : (isPast ? '#4cd964' : '#ccc'),
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold'
                                    }}>
                                        {isPast ? <IonIcon icon={checkmarkCircle} /> : (index + 1)}
                                    </div>
                                    {index < steps.length - 1 && (
                                        <div style={{
                                            width: '2px',
                                            flex: 1,
                                            background: '#ddd',
                                            marginTop: '5px'
                                        }} />
                                    )}
                                </div>

                                <div style={{
                                    flex: 1,
                                    background: isActive ? '#fff' : 'transparent',
                                    padding: isActive ? '15px' : '5px 0',
                                    borderRadius: '10px',
                                    boxShadow: isActive ? '0 4px 10px rgba(0,0,0,0.1)' : 'none'
                                }}>
                                    <h3 style={{ margin: 0, color: isActive ? '#000' : '#666', fontWeight: isActive ? 'bold' : 'normal' }}>
                                        {step.label}
                                    </h3>
                                    <p style={{ margin: '5px 0 0', color: '#888', fontSize: '0.9rem' }}>{step.desc}</p>

                                    {isActive && (
                                        <div style={{ marginTop: '15px' }}>
                                            {brewingPhase === BrewingPhase.INFUSION || brewingPhase === BrewingPhase.REST ? (
                                                <div style={{ fontSize: '2rem', color: '#007aff' }}>
                                                    {(timerValue / 1000).toFixed(1)}s
                                                </div>
                                            ) : null}

                                            <div style={{ marginTop: '5px', fontWeight: 'bold' }}>
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

            <div style={{
                position: 'fixed',
                bottom: '0',
                left: '0',
                right: '0',
                background: '#fff',
                padding: '10px 20px',
                boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
                display: 'flex',
                justifyContent: 'space-around'
            }}>
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

