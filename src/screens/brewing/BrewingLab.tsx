import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonButton } from '@ionic/react';
import React, { useMemo } from 'react';
import { BrewingPhase } from '../../services/interfaces/brewing.types';
import DesignSwitcher from '../../components/DesignSwitcher';
import { brewingSessionService } from '../../services/brewing/BrewingSessionService';
import { useBrewingControl } from '../../hooks/useBrewingControl';
import { useShallow } from 'zustand/react/shallow';
import { useBrewingStore } from '../../stores/useBrewingStore';
import { useScaleStore } from '../../stores/useScaleStore';

const BrewingLab: React.FC = () => {
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
        return (ms / 1000).toFixed(1) + "s";
    };

    const metrics = useMemo(() => [
        { label: 'Weight', value: `${currentWeight.toFixed(2)}g`, color: 'primary' },
        { label: 'Timer', value: formatTime(timerValue), color: 'secondary' },
        { label: 'Vessel', value: `${activeSession?.vesselWeight.toFixed(1) || 0}g`, color: 'medium' },
        { label: 'Lid', value: `${activeSession?.lidWeight.toFixed(1) || 0}g`, color: 'medium' },
        { label: 'Leaf', value: `${activeSession?.dryTeaLeavesWeight.toFixed(1) || 0}g`, color: 'success' },
        { label: 'Water', value: `${currentInfusion?.waterWeight?.toFixed(1) || '-'}g`, color: 'tertiary' },
    ], [currentWeight, timerValue, activeSession, currentInfusion]);

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar color="dark">
                    <IonTitle className="font-lab">LAB::MODE</IonTitle>
                    <DesignSwitcher />
                </IonToolbar>
            </IonHeader>
            <IonContent>
                <div className="p-5 font-lab">
                <div className="mb-5 rounded bg-lab-screen p-2.5 text-lab-text">
                    STATUS: {brewingPhase}
                </div>

                <IonGrid>
                    <IonRow>
                        {metrics.map((m) => (
                            <IonCol size="6" key={m.label}>
                                <IonCard className="m-[5px]">
                                    <IonCardHeader>
                                        <IonCardSubtitle>{m.label}</IonCardSubtitle>
                                        <IonCardTitle>{m.value}</IonCardTitle>
                                    </IonCardHeader>
                                </IonCard>
                            </IonCol>
                        ))}
                    </IonRow>
                </IonGrid>

                <div className="mt-5 border border-[#ccc] p-2.5">
                    <h4>Session Logs</h4>
                    <pre className="overflow-x-auto text-[0.8rem]">
                        {JSON.stringify(activeSession?.infusions?.map(i => {
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
                            const { session, ...rest } = i as any;
                            return rest;
                        }), null, 2) || 'No Data'}
                    </pre>
                </div>

                <div className="mt-5 flex gap-2.5">
                    <IonButton expand="block" color="dark" onClick={() => startBrewingSession('Lab Test')}>
                        INIT SEQ
                    </IonButton>
                    <IonButton expand="block" color="danger" onClick={() => handleEndSession()}>
                        TERM SEQ
                    </IonButton>
                    {brewingPhase === BrewingPhase.SETUP && (
                        <IonButton expand="block" color="warning" onClick={() => brewingSessionService.confirmSetupDone()}>
                            CONFIRM SETUP
                        </IonButton>
                    )}
                </div>
                </div>
                {recordingAlert}
            </IonContent>
        </IonPage>
    );
};

export default BrewingLab;
