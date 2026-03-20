import React, { useEffect, useState } from 'react';
import {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonAlert,
    useIonToast
} from '@ionic/react';
import { trash, pencil } from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
import SessionSummaryView from '../components/SessionSummaryView';
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

    const hasBrewingVesselWeights = Boolean((selectedSession.vesselWeight ?? 0) > 0 && (selectedSession.lidWeight ?? 0) > 0);
    const brewingVesselLabel = selectedSession.brewingVessel?.name?.trim()
        || (hasBrewingVesselWeights ? 'no vessel selected' : 'detect vessel first');

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
                <div style={{ minHeight: '100%', padding: '24px 20px 40px', background: '#ffffff' }}>
                    <SessionSummaryView
                        session={selectedSession}
                        brewingVesselLabel={brewingVesselLabel}
                        showNotes
                    />
                </div>

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
