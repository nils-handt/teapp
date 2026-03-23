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
import InfusionNoteEditorModal from '../components/InfusionNoteEditorModal';
import SessionSummaryView from '../components/SessionSummaryView';
import TeaNameEditorModal from '../components/TeaNameEditorModal';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { useShallow } from 'zustand/react/shallow';
import { useHistoryStore } from '../stores/useHistoryStore';

const TOAST_DURATION = 2000;

const SessionDetailScreen: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const history = useHistory();
    const {
        selectedSession,
        selectSession,
        deleteSession,
        updateSession,
        knownTeaNames,
        loadKnownTeaNames,
        upsertKnownTeaName,
    } = useHistoryStore(useShallow((state) => ({
        selectedSession: state.selectedSession,
        selectSession: state.selectSession,
        deleteSession: state.deleteSession,
        updateSession: state.updateSession,
        knownTeaNames: state.knownTeaNames,
        loadKnownTeaNames: state.loadKnownTeaNames,
        upsertKnownTeaName: state.upsertKnownTeaName,
    })));
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [showNotesAlert, setShowNotesAlert] = useState(false);
    const [showTeaNameEditor, setShowTeaNameEditor] = useState(false);
    const [teaNameDraft, setTeaNameDraft] = useState('');
    const [infusionNoteDraft, setInfusionNoteDraft] = useState('');
    const [editingInfusionId, setEditingInfusionId] = useState<string | null>(null);
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

    const handleTeaNameSave = async () => {
        if (selectedSession) {
            const trimmedTeaName = teaNameDraft.trim();
            const updatedSession = { ...selectedSession, teaName: trimmedTeaName };
            await updateSession(updatedSession);
            upsertKnownTeaName(trimmedTeaName);
            setShowTeaNameEditor(false);
            present({
                message: 'Session updated',
                duration: TOAST_DURATION,
                color: 'success'
            });
        }
    };

    const handleNotesSave = async (data: { notes?: string }) => {
        if (selectedSession && data) {
            const updatedSession = { ...selectedSession, notes: data.notes ?? '' };
            await updateSession(updatedSession);
            present({
                message: 'Session updated',
                duration: TOAST_DURATION,
                color: 'success'
            });
        }
    };

    const openTeaNameEditor = () => {
        if (!selectedSession) {
            return;
        }

        setTeaNameDraft(selectedSession.teaName ?? '');
        setShowTeaNameEditor(true);
        void loadKnownTeaNames();
    };

    const openInfusionNoteEditor = (infusionId: string, currentNote: string) => {
        setEditingInfusionId(infusionId);
        setInfusionNoteDraft(currentNote);
    };

    const closeInfusionNoteEditor = () => {
        setEditingInfusionId(null);
        setInfusionNoteDraft('');
    };

    const handleInfusionNoteSave = async () => {
        if (!selectedSession || !editingInfusionId) {
            return;
        }

        const updatedSession = {
            ...selectedSession,
            infusions: selectedSession.infusions.map((infusion) => (
                infusion.infusionId === editingInfusionId
                    ? { ...infusion, note: infusionNoteDraft.trim() }
                    : infusion
            )),
        };

        await updateSession(updatedSession as BrewingSession);
        closeInfusionNoteEditor();
        present({
            message: 'Infusion updated',
            duration: TOAST_DURATION,
            color: 'success'
        });
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
                        <IonButton onClick={() => setShowNotesAlert(true)}>
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
                        teaNameAction={openTeaNameEditor}
                        onInfusionPress={openInfusionNoteEditor}
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
                    isOpen={showNotesAlert}
                    onDidDismiss={() => setShowNotesAlert(false)}
                    header="Edit Notes"
                    inputs={[
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
                            handler: handleNotesSave
                        }
                    ]}
                />
                <TeaNameEditorModal
                    isOpen={showTeaNameEditor}
                    title="Tea Name"
                    value={teaNameDraft}
                    knownTeaNames={knownTeaNames}
                    onChange={setTeaNameDraft}
                    onCancel={() => setShowTeaNameEditor(false)}
                    onSave={handleTeaNameSave}
                />
                <InfusionNoteEditorModal
                    isOpen={Boolean(editingInfusionId)}
                    title="Edit Infusion Note"
                    value={infusionNoteDraft}
                    onChange={setInfusionNoteDraft}
                    onCancel={closeInfusionNoteEditor}
                    onSave={handleInfusionNoteSave}
                />
            </IonContent>
        </IonPage>
    );
};

export default SessionDetailScreen;
