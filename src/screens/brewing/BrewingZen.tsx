import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton } from '@ionic/react';
import React, { useMemo } from 'react';
import { useStore } from '../../stores/useStore';
import { BrewingPhase } from '../../services/interfaces/brewing.types';
import DesignSwitcher from '../../components/DesignSwitcher';
import { brewingSessionService } from '../../services/brewing/BrewingSessionService';
import { useBrewingControl } from '../../hooks/useBrewingControl';

const BrewingZen: React.FC = () => {
    const { brewingPhase, timerValue, currentWeight, activeSession } = useStore();
    const { startBrewingSession, handleEndSession, recordingAlert } = useBrewingControl();

    const phaseLabel = useMemo(() => {
        switch (brewingPhase) {
            case BrewingPhase.SETUP: return 'Prepare';
            case BrewingPhase.READY: return 'Ready';
            case BrewingPhase.INFUSION: return 'Infusing';
            case BrewingPhase.INFUSION_VESSEL_LIFTED: return 'Pouring';
            case BrewingPhase.REST: return 'Resting';
            case BrewingPhase.ENDED: return 'Done';
            default: return 'Zen';
        }
    }, [brewingPhase]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const isInfusing = brewingPhase === BrewingPhase.INFUSION || brewingPhase === BrewingPhase.INFUSION_VESSEL_LIFTED;

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar>
                    <IonTitle>Zen</IonTitle>
                    <DesignSwitcher />
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    background: isInfusing ? '#e8f5e9' : '#ffffff',
                    transition: 'background 0.5s ease'
                }}>
                    <div style={{
                        width: '250px',
                        height: '250px',
                        borderRadius: '50%',
                        border: '2px solid #333',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}>
                        {isInfusing && (
                            <div style={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                border: '2px solid green',
                                animation: 'pulse 2s infinite',
                                opacity: 0.5
                            }} />
                        )}

                        <div style={{ fontSize: '3rem', fontWeight: 300 }}>
                            {formatTime(timerValue)}
                        </div>
                        <div style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '10px' }}>
                            {phaseLabel}
                        </div>
                    </div>

                    <div style={{ marginTop: '40px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem', color: '#666' }}>
                            {activeSession?.teaName || 'No Tea Selected'}
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#999' }}>
                            {currentWeight.toFixed(1)}g
                        </div>
                    </div>

                    <div style={{ marginTop: '50px', display: 'flex', gap: '20px' }}>
                        {brewingPhase === BrewingPhase.IDLE || brewingPhase === BrewingPhase.ENDED ? (
                            <IonButton fill="outline" shape="round" onClick={() => startBrewingSession('Zen Tea')}>
                                Start Session
                            </IonButton>
                        ) : (
                            <IonButton fill="outline" color="danger" shape="round" onClick={() => handleEndSession()}>
                                End Session
                            </IonButton>
                        )}

                        {brewingPhase === BrewingPhase.SETUP && (
                            <IonButton fill="outline" shape="round" onClick={() => brewingSessionService.confirmSetupDone()}>
                                Confirm Setup
                            </IonButton>
                        )}

                        {brewingPhase === BrewingPhase.REST && (
                            <IonButton fill="solid" shape="round" onClick={() => brewingSessionService.manuallyStartInfusion()}>
                                Brew Now
                            </IonButton>
                        )}
                    </div>
                </div>
                <style>{`
                    @keyframes pulse {
                        0% { transform: scale(1); opacity: 0.5; }
                        50% { transform: scale(1.1); opacity: 0.2; }
                        100% { transform: scale(1); opacity: 0.5; }
                    }
                `}</style>
            </IonContent>
            {recordingAlert}
        </IonPage>
    );
};

export default BrewingZen;
