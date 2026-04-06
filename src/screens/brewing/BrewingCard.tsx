import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonIcon, IonButton, IonBadge, IonGrid, IonRow, IonCol } from '@ionic/react';
import React from 'react';
import { BrewingPhase } from '../../services/interfaces/brewing.types';
import DesignSwitcher from '../../components/DesignSwitcher';
import { brewingSessionService } from '../../services/brewing/BrewingSessionService';
import { timeOutline, waterOutline, leafOutline, stopCircleOutline, playCircleOutline } from 'ionicons/icons';
import { useBrewingControl } from '../../hooks/useBrewingControl';
import { useShallow } from 'zustand/react/shallow';
import { useBrewingStore } from '../../stores/useBrewingStore';
import { useScaleStore } from '../../stores/useScaleStore';

const BrewingCard: React.FC = () => {
    const { brewingPhase, timerValue, activeSession, currentInfusion } = useBrewingStore(
        useShallow((state) => ({
            brewingPhase: state.brewingPhase,
            timerValue: state.timerValue,
            activeSession: state.activeSession,
            currentInfusion: state.currentInfusion,
        }))
    );
    const currentWeight = useScaleStore((state) => state.currentWeight);
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
            <IonContent className="[--background:#f4f5f8]">
                <div className="p-4">

                {/* Main Status Card */}
                <IonCard>
                    <IonCardHeader>
                        <IonCardTitle className="flex items-center justify-between gap-3">
                            <span>{brewingPhase}</span>
                            <IonBadge color={brewingPhase === BrewingPhase.INFUSION ? 'primary' : 'medium'}>
                                {activeSession?.teaName || 'Ready'}
                            </IonBadge>
                        </IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent className="p-[30px] text-center">
                        <div className="text-[4rem] font-bold text-[#333]">
                            {formatTime(timerValue)}
                        </div>
                        <div className="mt-2.5 text-[1.2rem] text-[#666]">
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
                            <IonCard className="m-0 h-full">
                                <IonCardContent>
                                    <div className="flex items-center gap-2.5">
                                        <IonIcon icon={leafOutline} color="success" />
                                        <span>Tea</span>
                                    </div>
                                    <h2>{activeSession?.dryTeaLeavesWeight.toFixed(1) || 0}g</h2>
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                        <IonCol size="6">
                            <IonCard className="m-0 h-full">
                                <IonCardContent>
                                    <div className="flex items-center gap-2.5">
                                        <IonIcon icon={waterOutline} color="tertiary" />
                                        <span>Water</span>
                                    </div>
                                    <h2>{currentInfusion?.waterWeight?.toFixed(1) || '-'}g</h2>
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                    </IonRow>
                    <IonRow className="mt-2.5">
                        <IonCol size="12">
                            <IonCard className="m-0">
                                <IonCardContent>
                                    <div className="mb-2.5 flex items-center gap-2.5">
                                        <IonIcon icon={timeOutline} />
                                        <span>Recent Infusions</span>
                                    </div>
                                    <IonGrid className="p-0">
                                        {activeSession?.infusions?.slice().reverse().slice(0, 3).map((inf) => (
                                            <IonRow key={inf.infusionNumber} className="border-b border-[#eee] py-[5px]">
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

                <div className="h-5" />
                </div>
                {recordingAlert}
            </IonContent>
        </IonPage>
    );
};

export default BrewingCard;
