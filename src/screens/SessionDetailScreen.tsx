import React, { useEffect, useState, type CSSProperties } from 'react';
import {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonAlert,
    useIonToast
} from '@ionic/react';
import { useHistory, useParams } from 'react-router-dom';
import AppButton from '../components/ui/AppButton';
import InfusionNoteEditorModal from '../components/InfusionNoteEditorModal';
import SessionSummaryView from '../components/SessionSummaryView';
import TeaEditorModal, { type TeaEditorSubmission } from '../components/TeaEditorModal';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { useShallow } from 'zustand/react/shallow';
import { useHistoryStore } from '../stores/useHistoryStore';
import { zenPageShellClass } from '../styles/zen';
import { formatTeaLabel } from '../utils/teaSearch';
import { APP_TOAST_POSITION } from '../constants/ui';

const TOAST_DURATION = 2000;

const SessionDetailScreen: React.FC = () => {
    const { sessionId } = useParams<{ sessionId: string }>();
    const history = useHistory();
    const {
        selectedSession,
        selectSession,
        deleteSession,
        updateSession,
        knownTeas,
        loadKnownTeas,
        saveTea,
        updateSharedTea,
    } = useHistoryStore(useShallow((state) => ({
        selectedSession: state.selectedSession,
        selectSession: state.selectSession,
        deleteSession: state.deleteSession,
        updateSession: state.updateSession,
        knownTeas: state.knownTeas,
        loadKnownTeas: state.loadKnownTeas,
        saveTea: state.saveTea,
        updateSharedTea: state.updateSharedTea,
    })));
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [showTeaNameEditor, setShowTeaNameEditor] = useState(false);
    const [showSessionNoteEditor, setShowSessionNoteEditor] = useState(false);
    const [sessionNoteDraft, setSessionNoteDraft] = useState('');
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
                ...APP_TOAST_POSITION,
                message: 'Session deleted',
                duration: TOAST_DURATION,
                color: 'success'
            });
        }
    };

    const handleTeaSave = async ({ action, tea }: TeaEditorSubmission) => {
        if (!selectedSession) {
            return;
        }

        const resolvedTea = action === 'select'
            ? tea
            : action === 'create'
                ? await saveTea(tea)
                : await updateSharedTea(tea);
        const updatedSession = {
            ...selectedSession,
            tea: resolvedTea,
            teaId: resolvedTea.teaId,
            teaName: formatTeaLabel(resolvedTea),
        };
        await updateSession(updatedSession);
        setShowTeaNameEditor(false);
        present({
            ...APP_TOAST_POSITION,
            message: 'Session updated',
            duration: TOAST_DURATION,
            color: 'success'
        });
    };

    const openTeaNameEditor = () => {
        if (!selectedSession) {
            return;
        }

        setShowTeaNameEditor(true);
        void loadKnownTeas();
    };

    const openSessionNotesEditor = () => {
        if (!selectedSession) {
            return;
        }

        setSessionNoteDraft(selectedSession.notes ?? '');
        setShowSessionNoteEditor(true);
    };

    const closeSessionNotesEditor = () => {
        setShowSessionNoteEditor(false);
        setSessionNoteDraft('');
    };

    const handleSessionNotesSave = async () => {
        if (!selectedSession) {
            return;
        }

        await updateSession({ ...selectedSession, notes: sessionNoteDraft.trim() });
        closeSessionNotesEditor();
        present({
            ...APP_TOAST_POSITION,
            message: 'Session updated',
            duration: TOAST_DURATION,
            color: 'success'
        });
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
            ...APP_TOAST_POSITION,
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
                <IonContent>
                    <div className="p-5">Loading...</div>
                </IonContent>
            </IonPage>
        );
    }

    const hasBrewingVesselWeights = Boolean((selectedSession.vesselWeight ?? 0) > 0 && (selectedSession.lidWeight ?? 0) > 0);
    const brewingVesselLabel = selectedSession.brewingVessel?.name?.trim()
        || (hasBrewingVesselWeights ? 'no vessel selected' : 'detect vessel first');
    const sessionTeaLabel = formatTeaLabel(selectedSession.tea) || selectedSession.teaName?.trim() || '';

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonButtons slot="start">
                        <IonBackButton defaultHref="/tabs/history" />
                    </IonButtons>
                    <IonTitle
                        style={sessionTeaLabel
                            ? undefined
                            : { '--color': 'var(--color-zen-muted)' } as CSSProperties}
                    >
                        {sessionTeaLabel || 'No tea selected'}
                    </IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <div className={zenPageShellClass}>
                    <SessionSummaryView
                        session={selectedSession}
                        brewingVesselLabel={brewingVesselLabel}
                        teaNameAction={openTeaNameEditor}
                        onInfusionPress={openInfusionNoteEditor}
                        notesAction={openSessionNotesEditor}
                        footer={(
                            <AppButton
                                expand="block"
                                variant="danger"
                                onClick={() => setShowDeleteAlert(true)}
                            >
                                Delete session
                            </AppButton>
                        )}
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

                <TeaEditorModal
                    isOpen={showTeaNameEditor}
                    title="Tea"
                    selectedTea={selectedSession.tea}
                    teas={knownTeas}
                    onCancel={() => setShowTeaNameEditor(false)}
                    onSave={handleTeaSave}
                />
                <InfusionNoteEditorModal
                    isOpen={showSessionNoteEditor}
                    title="Edit Notes"
                    value={sessionNoteDraft}
                    onChange={setSessionNoteDraft}
                    onCancel={closeSessionNotesEditor}
                    onSave={handleSessionNotesSave}
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
