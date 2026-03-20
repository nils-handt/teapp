import React, { useEffect, useState } from 'react';
import {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonButton,
    IonIcon,
    IonListHeader,
    IonAlert,
    useIonToast
} from '@ionic/react';
import { trash, pencil } from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
import { useStore } from '../stores/useStore';

const TOAST_DURATION = 2000;

const SessionDetailScreen: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const history = useHistory();
    const { selectedSession, selectSession, deleteSession, updateSession } = useStore();
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [showEditAlert, setShowEditAlert] = useState(false);
    const [present] = useIonToast();

    useEffect(() => {
        if (sessionId) {
            selectSession(sessionId);
        }
    }, [sessionId, selectSession]);

    const handleDelete = async () => {
        if (selectedSession) {
            await deleteSession(selectedSession.sessionId);
            history.goBack();
            present({
                message: 'Session deleted',
                duration: TOAST_DURATION,
                color: 'success'
            });
        }
    };

    const handleEdit = async (data: any) => {
        if (selectedSession && data) {
            const updatedSession = { ...selectedSession, ...data };
            await updateSession(updatedSession);
            present({
                message: 'Session updated',
                duration: TOAST_DURATION,
                color: 'success'
            });
        }
    };

    if (!selectedSession) {
        return (
            <IonPage>
                <IonHeader>
                    <IonToolbar>
                        <IonButtons slot="start">
                            <IonBackButton defaultHref="/tabs/history" />
                        </IonButtons>
                        <IonTitle>Session Details</IonTitle>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding">
                    Loading...
                </IonContent>
            </IonPage>
        );
    }

    const formatDate = (value: string | number | Date) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleString();
    };

    const formatDuration = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonButtons slot="start">
                        <IonBackButton defaultHref="/tabs/history" />
                    </IonButtons>
                    <IonTitle>{selectedSession.teaName}</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={() => setShowEditAlert(true)}>
                            <IonIcon slot="icon-only" icon={pencil} />
                        </IonButton>
                        <IonButton onClick={() => setShowDeleteAlert(true)}>
                            <IonIcon slot="icon-only" icon={trash} color="danger" />
                        </IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <IonList>
                    <IonListHeader>
                        <IonLabel>Session Info</IonLabel>
                    </IonListHeader>
                    <IonItem>
                        <IonLabel>
                            <h3>Date</h3>
                            <p>{formatDate(selectedSession.startTime)}</p>
                        </IonLabel>
                    </IonItem>
                    <IonItem>
                        <IonLabel text-wrap>
                            <h3>Notes</h3>
                            <p>{selectedSession.notes || 'No notes'}</p>
                        </IonLabel>
                    </IonItem>

                    <IonListHeader>
                        <IonLabel>Infusions</IonLabel>
                    </IonListHeader>
                    {selectedSession.infusions && selectedSession.infusions.map((infusion) => (
                        <IonItem key={infusion.infusionId}>
                            <IonLabel>
                                <h2>Infusion {infusion.infusionNumber}</h2>
                                <p>Ratio: 1:{(infusion.waterWeight / (selectedSession.dryTeaLeavesWeight || 1)).toFixed(1)}</p>
                            </IonLabel>
                            <div slot="end" className="ion-text-right">
                                <IonNote color="primary">
                                    {formatDuration(infusion.duration)}
                                </IonNote>
                                <br />
                                <IonNote style={{ fontSize: '0.8em' }}>
                                    {infusion.waterWeight.toFixed(1)}g / {selectedSession.dryTeaLeavesWeight?.toFixed(1)}g
                                </IonNote>
                            </div>
                        </IonItem>
                    ))}
                </IonList>

                <IonAlert
                    isOpen={showDeleteAlert}
                    onDidDismiss={() => setShowDeleteAlert(false)}
                    header="Delete Session"
                    message="Are you sure you want to delete this session? This cannot be undone."
                    buttons={[
                        {
                            text: 'Cancel',
                            role: 'cancel',
                        },
                        {
                            text: 'Delete',
                            role: 'destructive',
                            handler: handleDelete
                        }
                    ]}
                />

                <IonAlert
                    isOpen={showEditAlert}
                    onDidDismiss={() => setShowEditAlert(false)}
                    header="Edit Session"
                    inputs={[
                        {
                            name: 'teaName',
                            type: 'text',
                            placeholder: 'Tea Name',
                            value: selectedSession.teaName
                        },
                        {
                            name: 'notes',
                            type: 'textarea',
                            placeholder: 'Notes',
                            value: selectedSession.notes
                        }
                    ]}
                    buttons={[
                        {
                            text: 'Cancel',
                            role: 'cancel',
                        },
                        {
                            text: 'Save',
                            handler: handleEdit
                        }
                    ]}
                />
            </IonContent>
        </IonPage>
    );
};

export default SessionDetailScreen;
