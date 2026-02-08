import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonButton } from '@ionic/react';
import React, { useMemo } from 'react';
import { useStore } from '../../stores/useStore';
import { BrewingPhase } from '../../services/interfaces/brewing.types';
import DesignSwitcher from '../../components/DesignSwitcher';
import { brewingSessionService } from '../../services/brewing/BrewingSessionService';
import { useBrewingControl } from '../../hooks/useBrewingControl';

const BrewingLab: React.FC = () => {
    const { brewingPhase, timerValue, currentWeight, activeSession, currentInfusion } = useStore();
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
                    <IonTitle style={{ fontFamily: 'monospace' }}>LAB::MODE</IonTitle>
                    <DesignSwitcher />
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding" style={{ fontFamily: 'monospace' }}>
                <div style={{ padding: '10px', background: '#333', color: '#0f0', marginBottom: '20px', borderRadius: '4px' }}>
                    STATUS: {brewingPhase}
                </div>

                <IonGrid>
                    <IonRow>
                        {metrics.map((m, i) => (
                            <IonCol size="6" key={i}>
                                <IonCard style={{ margin: '5px' }}>
                                    <IonCardHeader>
                                        <IonCardSubtitle>{m.label}</IonCardSubtitle>
                                        <IonCardTitle>{m.value}</IonCardTitle>
                                    </IonCardHeader>
                                </IonCard>
                            </IonCol>
                        ))}
                    </IonRow>
                </IonGrid>

                <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px' }}>
                    <h4>Session Logs</h4>
                    <pre style={{ fontSize: '0.8rem', overflowX: 'auto' }}>
                        {JSON.stringify(activeSession?.infusions?.map(i => {
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            const { session, ...rest } = i as any;
                            return rest;
                        }), null, 2) || 'No Data'}
                    </pre>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
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
                {recordingAlert}
            </IonContent>
        </IonPage>
    );
};

export default BrewingLab;
