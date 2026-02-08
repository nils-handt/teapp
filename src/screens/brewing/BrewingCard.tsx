import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonIcon, IonButton, IonBadge, IonGrid, IonRow, IonCol } from '@ionic/react';
import React from 'react';
import { useStore } from '../../stores/useStore';
import { BrewingPhase } from '../../services/interfaces/brewing.types';
import DesignSwitcher from '../../components/DesignSwitcher';
import { brewingSessionService } from '../../services/brewing/BrewingSessionService';
import { timeOutline, waterOutline, leafOutline, stopCircleOutline, playCircleOutline } from 'ionicons/icons';
import { useBrewingControl } from '../../hooks/useBrewingControl';

const BrewingCard: React.FC = () => {
    const { brewingPhase, timerValue, currentWeight, activeSession, currentInfusion } = useStore();
    const { startBrewingSession, handleEndSession, recordingAlert } = useBrewingControl();

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Dashboard</IonTitle>
                    <DesignSwitcher />
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding" style={{ '--background': '#f4f5f8' }}>

                {/* Main Status Card */}
                <IonCard>
                    <IonCardHeader>
                        <IonCardTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{brewingPhase}</span>
                            <IonBadge color={brewingPhase === BrewingPhase.INFUSION ? 'primary' : 'medium'}>
                                {activeSession?.teaName || 'Ready'}
                            </IonBadge>
                        </IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent style={{ textAlign: 'center', padding: '30px' }}>
                        <div style={{ fontSize: '4rem', fontWeight: 'bold', color: '#333' }}>
                            {formatTime(timerValue)}
                        </div>
                        <div style={{ fontSize: '1.2rem', color: '#666', marginTop: '10px' }}>
                            Weight: {currentWeight.toFixed(1)} g
                        </div>
                    </IonCardContent>
                </IonCard>

                {/* Controls */}
                <IonGrid>
                    <IonRow>
                        <IonCol>
                            <IonButton expand="block" shape="round" onClick={() => startBrewingSession('Card Tea')}>
                                <IonIcon slot="start" icon={playCircleOutline} /> Start
                            </IonButton>
                        </IonCol>
                        <IonCol>
                            <IonButton expand="block" color="danger" onClick={() => handleEndSession()}>
                                <IonIcon slot="start" icon={stopCircleOutline} /> Stop
                            </IonButton>
                        </IonCol>
                    </IonRow>
                    {brewingPhase === BrewingPhase.SETUP && (
                        <IonRow>
                            <IonCol>
                                <IonButton expand="block" color="warning" onClick={() => brewingSessionService.confirmSetupDone()}>
                                    Confirm Setup
                                </IonButton>
                            </IonCol>
                        </IonRow>
                    )}
                </IonGrid>

                {/* Stats Grid */}
                <IonGrid>
                    <IonRow>
                        <IonCol size="6">
                            <IonCard style={{ margin: 0, height: '100%' }}>
                                <IonCardContent>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <IonIcon icon={leafOutline} color="success" />
                                        <span>Tea</span>
                                    </div>
                                    <h2>{activeSession?.dryTeaLeavesWeight.toFixed(1) || 0}g</h2>
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                        <IonCol size="6">
                            <IonCard style={{ margin: 0, height: '100%' }}>
                                <IonCardContent>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <IonIcon icon={waterOutline} color="tertiary" />
                                        <span>Water</span>
                                    </div>
                                    <h2>{currentInfusion?.waterWeight?.toFixed(1) || '-'}g</h2>
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                    </IonRow>
                    <IonRow style={{ marginTop: '10px' }}>
                        <IonCol size="12">
                            <IonCard style={{ margin: 0 }}>
                                <IonCardContent>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                        <IonIcon icon={timeOutline} />
                                        <span>Recent Infusions</span>
                                    </div>
                                    <IonGrid className="ion-no-padding">
                                        {activeSession?.infusions?.slice().reverse().slice(0, 3).map((inf, i) => (
                                            <IonRow key={i} style={{ borderBottom: '1px solid #eee', padding: '5px 0' }}>
                                                <IonCol>#{inf.infusionNumber}</IonCol>
                                                <IonCol>{inf.duration}s</IonCol>
                                                <IonCol>{inf.waterWeight}g</IonCol>
                                            </IonRow>
                                        ))}
                                    </IonGrid>
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                    </IonRow>
                </IonGrid>

                <div style={{ height: '20px' }}></div>
                {recordingAlert}
            </IonContent>
        </IonPage>
    );
};

export default BrewingCard;
