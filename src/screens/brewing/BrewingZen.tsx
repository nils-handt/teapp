import {
    createGesture,
    IonContent,
    IonAlert,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
} from '@ionic/react';
import React, { useEffect, useRef, useState } from 'react';
import AppButton from '../../components/ui/AppButton';
import InfusionNoteEditorModal from '../../components/InfusionNoteEditorModal';
import SessionSummaryView from '../../components/SessionSummaryView';
import TeaEditorModal from '../../components/TeaEditorModal';
import ModalFrame from '../../components/ui/ModalFrame';
import { useBrewingControl } from '../../hooks/useBrewingControl';
import { bluetoothScaleService } from '../../services/BluetoothScaleService';
import { brewingSessionService } from '../../services/brewing/BrewingSessionService';
import { BrewingPhase } from '../../services/interfaces/brewing.types';
import { useShallow } from 'zustand/react/shallow';
import { useBrewingStore } from '../../stores/useBrewingStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { useScaleStore } from '../../stores/useScaleStore';
import {
    cn,
    zenActionRowClass,
    zenActiveTimerClass,
    zenActiveTimerToneClassMap,
    zenActiveTimerWellClass,
    zenDotRailClass,
    zenFieldBaseClass,
    zenFieldLabelClass,
    zenFieldStateClassMap,
    zenFieldToneClassMap,
    zenHeroButtonClass,
    zenInfusionControlBaseClass,
    zenInfusionControlStateClassMap,
    zenInfusionControlToneClassMap,
    zenInfusionHistoryClass,
    zenInputClass,
    zenModalOverlayClass,
    zenPageShellClass,
    zenPanelClass,
    zenPanelStrongClass,
    zenSectionEyebrowClass,
    zenStackClass,
} from '../../styles/zen';
import {
    formatZenSeconds,
    formatZenWeight,
} from './zenBrewingShared';
import { formatTeaLabel } from '../../utils/teaSearch';
import { Tea } from '../../entities/Tea.entity';

type SetupField = 'vesselWeight' | 'lidWeight' | 'dryTeaLeavesWeight';
type EditableField = SetupField | 'teaName' | 'brewingVesselName';

type AlertState =
    | {
        field: EditableField;
        header: string;
        inputType: 'number' | 'text';
    }
    | null;

type NoteEditorTarget =
    | { mode: 'editable' }
    | { mode: 'saved'; infusionId: string }
    | { mode: 'session' }
    | null;

type InfusionStripItem = {
    infusionId: string;
    infusionNumber: number;
    duration: number;
};

const QUICK_WEAK_NOTES = ['weak', 'very weak'] as const;
const QUICK_STRONG_NOTES = ['strong', 'very strong'] as const;
const SWIPE_THRESHOLD_PX = 50;
const INFUSION_STRIP_DOT_COLORS = ['#caccc5', '#8d9188'];

const PHASE_COPY: Record<BrewingPhase, { label: string; message: string }> = {
    [BrewingPhase.IDLE]: { label: 'Zen', message: '' },
    [BrewingPhase.SETUP]: { label: 'Setup', message: '' },
    [BrewingPhase.READY]: { label: 'Ready', message: '' },
    [BrewingPhase.INFUSION]: { label: 'Infusing', message: '' },
    [BrewingPhase.INFUSION_VESSEL_LIFTED]: { label: 'Pouring', message: '' },
    [BrewingPhase.REST]: { label: 'Rest', message: '' },
    [BrewingPhase.ENDED]: { label: 'Ended', message: '' },
};

const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const BrewingZen: React.FC = () => {
    const { activeSession, brewingPhase, currentInfusion, editableInfusionMetadata, timerValue } = useBrewingStore(
        useShallow((state) => ({
            activeSession: state.activeSession,
            brewingPhase: state.brewingPhase,
            currentInfusion: state.currentInfusion,
            editableInfusionMetadata: state.editableInfusionMetadata,
            timerValue: state.timerValue,
        }))
    );
    const { connectionStatus, currentWeight, isMockMode } = useScaleStore(useShallow((state) => ({
        connectionStatus: state.connectionStatus,
        currentWeight: state.currentWeight,
        isMockMode: state.isMockMode,
    })));
    const { knownTeas, loadKnownTeas, saveTea, deleteSession } = useHistoryStore(
        useShallow((state) => ({
            knownTeas: state.knownTeas,
            loadKnownTeas: state.loadKnownTeas,
            saveTea: state.saveTea,
            deleteSession: state.deleteSession,
        }))
    );
    const { startBrewingSession, handleEndSession, recordingAlert } = useBrewingControl();
    const [alertState, setAlertState] = useState<AlertState>(null);
    const [draftValue, setDraftValue] = useState('');
    const [noteEditorTarget, setNoteEditorTarget] = useState<NoteEditorTarget>(null);
    const [noteDraft, setNoteDraft] = useState('');
    const [isTemperatureEditorOpen, setIsTemperatureEditorOpen] = useState(false);
    const [temperatureDraft, setTemperatureDraft] = useState('');
    const [temperatureError, setTemperatureError] = useState('');
    const [viewedInfusionIndex, setViewedInfusionIndex] = useState(0);
    const [showDeleteSessionAlert, setShowDeleteSessionAlert] = useState(false);
    const infusionHistoryStripRef = useRef<HTMLDivElement | null>(null);

    const phaseCopy = PHASE_COPY[brewingPhase] ?? PHASE_COPY[BrewingPhase.IDLE];
    const activeTeaLabel = formatTeaLabel(activeSession?.tea) || activeSession?.teaName?.trim() || '';
    const hasTeaName = Boolean(activeTeaLabel);
    const hasBrewingVesselWeights = Boolean((activeSession?.vesselWeight ?? 0) > 0 && (activeSession?.lidWeight ?? 0) > 0);
    const hasBrewingVesselName = Boolean(activeSession?.brewingVessel?.name?.trim());
    const brewingVesselLabel = activeSession?.brewingVessel?.name?.trim()
        || (hasBrewingVesselWeights ? 'no vessel selected' : 'detect vessel first');
    const activeQuickWeakIndex = QUICK_WEAK_NOTES.indexOf(editableInfusionMetadata.note as typeof QUICK_WEAK_NOTES[number]);
    const activeQuickStrongIndex = QUICK_STRONG_NOTES.indexOf(editableInfusionMetadata.note as typeof QUICK_STRONG_NOTES[number]);
    const hasCustomInfusionNote = Boolean(
        editableInfusionMetadata.note.trim()
        && activeQuickWeakIndex === -1
        && activeQuickStrongIndex === -1
    );
    const canEditInfusionMetadata = editableInfusionMetadata.source !== 'none';
    const infusionStripItems: InfusionStripItem[] = (activeSession?.infusions ?? []).map((infusion) => ({
        infusionId: infusion.infusionId,
        infusionNumber: infusion.infusionNumber,
        duration: infusion.duration,
    }));
    if (brewingPhase === BrewingPhase.REST && currentInfusion) {
        const restingInfusionItem = {
            infusionId: currentInfusion.infusionId,
            infusionNumber: currentInfusion.infusionNumber,
            duration: currentInfusion.duration,
        };
        const existingInfusionIndex = infusionStripItems.findIndex((item) => item.infusionId === currentInfusion.infusionId);

        if (existingInfusionIndex >= 0) {
            infusionStripItems[existingInfusionIndex] = restingInfusionItem;
        } else {
            infusionStripItems.push(restingInfusionItem);
        }
    }
    const infusionStripSignature = infusionStripItems
        .map((item) => `${item.infusionId}:${item.infusionNumber}:${item.duration}`)
        .join('|');
    const selectedInfusionIndex = Math.min(viewedInfusionIndex, Math.max(infusionStripItems.length - 1, 0));
    const selectedInfusion = infusionStripItems[selectedInfusionIndex] ?? null;
    const previousInfusionCount = selectedInfusion ? selectedInfusionIndex : 0;
    const nextInfusionCount = selectedInfusion ? infusionStripItems.length - selectedInfusionIndex - 1 : 0;

    useEffect(() => {
        if (infusionStripItems.length === 0) {
            setViewedInfusionIndex(0);
            return;
        }

        setViewedInfusionIndex(infusionStripItems.length - 1);
    }, [brewingPhase, infusionStripSignature, infusionStripItems.length]);

    useEffect(() => {
        const element = infusionHistoryStripRef.current;
        if (!element || infusionStripItems.length <= 1) {
            return;
        }

        const gesture = createGesture({
            el: element,
            gestureName: 'zen-infusion-history-swipe',
            threshold: 10,
            disableScroll: false,
            onEnd: (detail) => {
                const absX = Math.abs(detail.deltaX);
                const absY = Math.abs(detail.deltaY);

                if (absX < SWIPE_THRESHOLD_PX || absX <= absY) {
                    return;
                }

                if (detail.deltaX < 0) {
                    setViewedInfusionIndex((index) => Math.max(index - 1, 0));
                    return;
                }

                setViewedInfusionIndex((index) => Math.min(index + 1, infusionStripItems.length - 1));
            },
        });

        gesture.enable(true);

        return () => {
            gesture.destroy();
        };
    }, [infusionStripItems.length]);

    const renderInfusionStripDots = (direction: 'previous' | 'next', availableCount: number) => (
        <span
            aria-hidden="true"
            data-testid={`infusion-history-${direction}`}
            data-count={Math.min(availableCount, 2)}
            className={cn(zenDotRailClass, direction === 'previous' ? 'justify-end' : 'justify-start')}
        >
            {Array.from({ length: Math.min(availableCount, 2) }, (_, index) => (
                <span
                    key={`${direction}-${index + 1}`}
                    data-testid={`infusion-history-${direction}-dot-${index + 1}`}
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                        background: INFUSION_STRIP_DOT_COLORS[index] ?? INFUSION_STRIP_DOT_COLORS[INFUSION_STRIP_DOT_COLORS.length - 1],
                    }}
                />
            ))}
        </span>
    );

    const openAlert = (field: EditableField) => {
        if (!activeSession) {
            return;
        }

        const config: Record<EditableField, { header: string; inputType: 'number' | 'text'; value: string }> = {
            teaName: {
                header: 'Tea',
                inputType: 'text',
                value: activeTeaLabel,
            },
            vesselWeight: {
                header: 'Vessel',
                inputType: 'number',
                value: String(activeSession?.vesselWeight ?? 0),
            },
            lidWeight: {
                header: 'Lid',
                inputType: 'number',
                value: String(activeSession?.lidWeight ?? 0),
            },
            dryTeaLeavesWeight: {
                header: 'Tea',
                inputType: 'number',
                value: String(activeSession?.dryTeaLeavesWeight ?? 0),
            },
            brewingVesselName: {
                header: 'Brewing Vessel Name',
                inputType: 'text',
                value: activeSession?.brewingVessel?.name ?? '',
            },
        };

        setAlertState({
            field,
            header: config[field].header,
            inputType: config[field].inputType,
        });
        setDraftValue(config[field].value);

        if (field === 'teaName') {
            void loadKnownTeas();
        }
    };

    const closeEditor = () => {
        setAlertState(null);
        setDraftValue('');
    };

    const openEditableNoteEditor = () => {
        if (!canEditInfusionMetadata) {
            return;
        }

        setNoteEditorTarget({ mode: 'editable' });
        setNoteDraft(editableInfusionMetadata.note);
    };

    const openSavedInfusionNoteEditor = (infusionId: string, currentNote: string) => {
        setNoteEditorTarget({ mode: 'saved', infusionId });
        setNoteDraft(currentNote);
    };

    const openSessionNotesEditor = () => {
        if (!activeSession) {
            return;
        }

        setNoteEditorTarget({ mode: 'session' });
        setNoteDraft(activeSession.notes ?? '');
    };

    const handleDeleteSession = async () => {
        if (!activeSession) {
            return;
        }

        await deleteSession(activeSession.sessionId);
        brewingSessionService.clearSession();
        setShowDeleteSessionAlert(false);
    };

    const closeNoteEditor = () => {
        setNoteEditorTarget(null);
        setNoteDraft('');
    };

    const handleNoteSave = () => {
        const trimmedNote = noteDraft.trim();

        if (noteEditorTarget?.mode === 'editable') {
            brewingSessionService.updateEditableInfusionNote(trimmedNote);
        }

        if (noteEditorTarget?.mode === 'saved') {
            brewingSessionService.updateSavedInfusionNote(noteEditorTarget.infusionId, trimmedNote);
        }

        if (noteEditorTarget?.mode === 'session') {
            brewingSessionService.updateSessionNotes(trimmedNote);
        }

        closeNoteEditor();
    };

    const openTemperatureEditor = () => {
        if (!canEditInfusionMetadata) {
            return;
        }

        setTemperatureDraft(
            editableInfusionMetadata.temperature === null || editableInfusionMetadata.temperature === undefined
                ? ''
                : String(editableInfusionMetadata.temperature)
        );
        setTemperatureError('');
        setIsTemperatureEditorOpen(true);
    };

    const closeTemperatureEditor = () => {
        setIsTemperatureEditorOpen(false);
        setTemperatureDraft('');
        setTemperatureError('');
    };

    const handleTemperatureSave = () => {
        const trimmedValue = temperatureDraft.trim();
        if (!trimmedValue) {
            brewingSessionService.updateEditableInfusionTemperature(null);
            closeTemperatureEditor();
            return;
        }

        const parsedValue = Number.parseFloat(trimmedValue);
        if (Number.isNaN(parsedValue) || parsedValue < 0 || parsedValue > 212) {
            setTemperatureError('Enter a temperature between 0 and 212.');
            return;
        }

        brewingSessionService.updateEditableInfusionTemperature(parsedValue);
        closeTemperatureEditor();
    };

    const cycleQuickNote = (direction: 'weak' | 'strong') => {
        if (!canEditInfusionMetadata) {
            return;
        }

        const options = direction === 'weak' ? QUICK_WEAK_NOTES : QUICK_STRONG_NOTES;
        const currentNote = editableInfusionMetadata.note;
        const nextNote = currentNote === options[0]
            ? options[1]
            : currentNote === options[1]
                ? ''
                : options[0];

        brewingSessionService.updateEditableInfusionNote(nextNote);
    };

    const renderInfusionControlButton = (
        buttonLabel: string,
        value: string,
        onClick: () => void,
        options?: { active?: boolean }
    ) => (
        <button
            type="button"
            aria-label={buttonLabel}
            onClick={onClick}
            disabled={!canEditInfusionMetadata}
            className={cn(
                zenInfusionControlBaseClass,
                options?.active ? zenInfusionControlToneClassMap.active : zenInfusionControlToneClassMap.inactive,
                canEditInfusionMetadata ? zenInfusionControlStateClassMap.enabled : zenInfusionControlStateClassMap.disabled,
            )}
        >
            {value}
        </button>
    );

    const renderInfusionControls = () => (
        <section className={cn(zenPanelClass, 'flex gap-[10px] p-4')}>
            {renderInfusionControlButton(
                'Weak note',
                activeQuickWeakIndex === 1 ? '--' : '-',
                () => cycleQuickNote('weak'),
                { active: activeQuickWeakIndex >= 0 }
            )}
            {renderInfusionControlButton(
                'Infusion temperature',
                editableInfusionMetadata.temperature === null || editableInfusionMetadata.temperature === undefined
                    ? 'temp'
                    : `${editableInfusionMetadata.temperature}°`,
                openTemperatureEditor,
                { active: editableInfusionMetadata.temperature !== null && editableInfusionMetadata.temperature !== undefined }
            )}
            {renderInfusionControlButton(
                'Custom note',
                'note',
                openEditableNoteEditor,
                { active: hasCustomInfusionNote }
            )}
            {renderInfusionControlButton(
                'Strong note',
                activeQuickStrongIndex === 1 ? '++' : '+',
                () => cycleQuickNote('strong'),
                { active: activeQuickStrongIndex >= 0 }
            )}
        </section>
    );

    const handleTeaSave = async (tea: Tea) => {
        const savedTea = await saveTea(tea);
        brewingSessionService.updateTea(savedTea);
        closeEditor();
    };

    const handleAlertSave = () => {
        if (!alertState) {
            return;
        }

        const nextValue = draftValue;
        if (alertState.field === 'teaName') {
            closeEditor();
            return;
        }

        if (alertState.field === 'brewingVesselName') {
            brewingSessionService.updateBrewingVesselName(nextValue);
            closeEditor();
            return;
        }

        const parsedValue = Number.parseFloat(nextValue);
        if (Number.isNaN(parsedValue)) {
            return;
        }

        brewingSessionService.updateSetupValue(alertState.field, parsedValue);
        closeEditor();
    };

    const renderFieldButton = (label: string, value: string, field: EditableField, options?: { disabled?: boolean }) => (
        <button
            type="button"
            onClick={() => {
                if (!options?.disabled) {
                    openAlert(field);
                }
            }}
            disabled={options?.disabled}
            className={cn(
                zenFieldBaseClass,
                (field === 'teaName' && !hasTeaName) || (field === 'brewingVesselName' && !hasBrewingVesselName && hasBrewingVesselWeights)
                    ? zenFieldToneClassMap.highlighted
                    : zenFieldToneClassMap.default,
                options?.disabled ? zenFieldStateClassMap.disabled : zenFieldStateClassMap.enabled,
            )}
        >
            <span className={zenFieldLabelClass}>{label}</span>
            <span>{value}</span>
        </button>
    );

    const renderEmptyState = (label: string, onClick: () => void, options?: { disabled?: boolean }) => (
        <div className={cn(zenStackClass, 'flex flex-1 justify-center')}>
            <button
                type="button"
                onClick={onClick}
                disabled={options?.disabled}
                className={cn(zenHeroButtonClass, options?.disabled ? 'cursor-default' : 'cursor-pointer')}
            >
                {label}
            </button>
        </div>
    );

    const renderDisconnectedState = () => renderEmptyState(
        'CONNECT TO SCALE',
        () => bluetoothScaleService.connectNewDevice(),
        { disabled: connectionStatus === 'connecting' },
    );

    const renderSetupView = () => (
        <div className={zenStackClass}>
            <section className={zenPanelStrongClass}>
                <p className={zenSectionEyebrowClass}>
                    {phaseCopy.label}
                </p>
                <div className="mt-2 text-[3.4rem] leading-none font-light text-zen-text">
                    {formatZenWeight(currentWeight)}
                </div>
            </section>

            <section className={zenPanelClass}>
                <div className="grid gap-3">
                    {renderFieldButton('Vessel', formatZenWeight(activeSession?.vesselWeight), 'vesselWeight')}
                    {renderFieldButton('Lid', formatZenWeight(activeSession?.lidWeight), 'lidWeight')}
                    {renderFieldButton('Tea', formatZenWeight(activeSession?.dryTeaLeavesWeight), 'dryTeaLeavesWeight')}
                    {renderFieldButton('Tea', activeTeaLabel || 'no tea selected', 'teaName')}
                    {renderFieldButton('Vessel name', brewingVesselLabel, 'brewingVesselName', { disabled: !hasBrewingVesselWeights })}
                </div>
            </section>

            <section className={zenActionRowClass}>
                <AppButton
                    expand="block"
                    onClick={() => handleEndSession()}
                    variant="danger"
                >
                    End Session
                </AppButton>
                <AppButton
                    expand="block"
                    onClick={() => brewingSessionService.confirmSetupDone()}
                >
                    Confirm Setup
                </AppButton>
            </section>
        </div>
    );

    const renderActiveView = (options?: { greyTimer?: boolean }) => (
        <div className={zenStackClass}>
            {renderInfusionControls()}
            <section className={cn(zenPanelStrongClass, 'text-center')}>
                <p className={zenSectionEyebrowClass}>
                    {phaseCopy.label}
                </p>
                <div className={zenActiveTimerWellClass}>
                    <span
                        data-testid="primary-timer"
                        data-tone={options?.greyTimer ? 'resting' : 'default'}
                        className={cn(
                            zenActiveTimerClass,
                            options?.greyTimer ? zenActiveTimerToneClassMap.resting : zenActiveTimerToneClassMap.default,
                        )}
                    >
                        {formatTime(timerValue)}
                    </span>
                </div>
                {selectedInfusion && (
                    <div
                        ref={infusionHistoryStripRef}
                        data-testid="infusion-history-strip"
                        aria-label={`Infusion ${selectedInfusion.infusionNumber} - ${formatZenSeconds(selectedInfusion.duration)}`}
                        className={zenInfusionHistoryClass}
                    >
                        {renderInfusionStripDots('previous', previousInfusionCount)}
                        <span data-testid="infusion-history-label">
                            Infusion {selectedInfusion.infusionNumber} - {formatZenSeconds(selectedInfusion.duration)}
                        </span>
                        {renderInfusionStripDots('next', nextInfusionCount)}
                    </div>
                )}
            </section>

            {(!hasTeaName || !hasBrewingVesselName) && (
                <section className={zenPanelClass}>
                    <div className="grid gap-3">
                        {!hasTeaName && renderFieldButton('Tea', 'no tea selected', 'teaName')}
                        {!hasBrewingVesselName && renderFieldButton('Vessel name', brewingVesselLabel, 'brewingVesselName', { disabled: !hasBrewingVesselWeights })}
                    </div>
                </section>
            )}

            <section className={zenActionRowClass}>
                <AppButton
                    expand="block"
                    onClick={() => handleEndSession()}
                    variant="danger"
                >
                    End Session
                </AppButton>
                {isMockMode && (brewingPhase === BrewingPhase.INFUSION || brewingPhase === BrewingPhase.INFUSION_VESSEL_LIFTED) && (
                    <AppButton
                        expand="block"
                        onClick={() => brewingSessionService.manuallyStopInfusion()}
                    >
                        End Infusion
                    </AppButton>
                )}
                {isMockMode && (brewingPhase === BrewingPhase.READY || brewingPhase === BrewingPhase.REST) && (
                    <AppButton
                        expand="block"
                        onClick={() => brewingSessionService.manuallyStartInfusion()}
                    >
                        Start Infusion
                    </AppButton>
                )}
            </section>
        </div>
    );

    const renderEndedView = () => activeSession && (
        <SessionSummaryView
            session={activeSession}
            brewingVesselLabel={brewingVesselLabel}
            teaNameAction={() => openAlert('teaName')}
            brewingVesselAction={() => openAlert('brewingVesselName')}
            brewingVesselActionDisabled={!hasBrewingVesselWeights}
            onInfusionPress={openSavedInfusionNoteEditor}
            notesAction={openSessionNotesEditor}
            footer={(
                <>
                    <AppButton
                        expand="block"
                        onClick={() => startBrewingSession()}
                    >
                        Start New Session
                    </AppButton>
                    <AppButton
                        expand="block"
                        variant="danger"
                        onClick={() => setShowDeleteSessionAlert(true)}
                    >
                        Delete Session
                    </AppButton>
                </>
            )}
        />
    );

    const renderIdleView = () => renderEmptyState('START SESSION', () => startBrewingSession());

    const renderPhaseContent = () => {
        if (connectionStatus !== 'connected') {
            return renderDisconnectedState();
        }

        switch (brewingPhase) {
            case BrewingPhase.SETUP:
                return renderSetupView();
            case BrewingPhase.READY:
            case BrewingPhase.INFUSION:
            case BrewingPhase.INFUSION_VESSEL_LIFTED:
                return renderActiveView();
            case BrewingPhase.REST:
                return renderActiveView({ greyTimer: true });
            case BrewingPhase.ENDED:
                return renderEndedView();
            case BrewingPhase.IDLE:
            default:
                return renderIdleView();
        }
    };

    return (
        <IonPage>
            <IonHeader className="[--border-width:0]">
                <IonToolbar>
                    <IonTitle>Zen</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen scrollY={connectionStatus === 'connected'}>
                <div className={zenPageShellClass}>
                    {renderPhaseContent()}
                </div>

                <TeaEditorModal
                    isOpen={alertState?.field === 'teaName'}
                    title={alertState?.header ?? 'Tea'}
                    selectedTea={activeSession?.tea ?? null}
                    teas={knownTeas}
                    onCancel={closeEditor}
                    onSave={handleTeaSave}
                />
                <InfusionNoteEditorModal
                    isOpen={Boolean(noteEditorTarget)}
                    title={noteEditorTarget?.mode === 'session' ? 'Edit Notes' : 'Edit Infusion Note'}
                    value={noteDraft}
                    onChange={setNoteDraft}
                    onCancel={closeNoteEditor}
                    onSave={handleNoteSave}
                />
                <IonAlert
                    isOpen={showDeleteSessionAlert}
                    onDidDismiss={() => setShowDeleteSessionAlert(false)}
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
                            handler: handleDeleteSession,
                        },
                    ]}
                />

                {alertState && alertState.field !== 'teaName' && (
                    <ModalFrame
                        isOpen={true}
                        title={alertState.header}
                        actions={(
                            <>
                                <AppButton variant="soft" onClick={closeEditor}>
                                    Cancel
                                </AppButton>
                                <AppButton onClick={handleAlertSave}>
                                    Save
                                </AppButton>
                            </>
                        )}
                    >
                        <input
                            autoFocus
                            type={alertState.inputType}
                            value={draftValue}
                            onChange={(event) => setDraftValue(event.target.value)}
                            className={`${zenInputClass} mb-4`}
                        />
                    </ModalFrame>
                )}
                {isTemperatureEditorOpen && (
                    <ModalFrame
                        isOpen={true}
                        title="Infusion Temperature"
                        overlayClassName={zenModalOverlayClass}
                        actions={(
                            <>
                                <AppButton variant="soft" onClick={closeTemperatureEditor}>
                                    Cancel
                                </AppButton>
                                <AppButton onClick={handleTemperatureSave}>
                                    Save
                                </AppButton>
                            </>
                        )}
                    >
                        <input
                            autoFocus
                            type="number"
                            value={temperatureDraft}
                            onChange={(event) => {
                                setTemperatureDraft(event.target.value);
                                if (temperatureError) {
                                    setTemperatureError('');
                                }
                            }}
                            className={cn(
                                zenInputClass,
                                temperatureError ? 'mb-[10px] border-zen-danger' : 'mb-[10px]',
                            )}
                        />
                        {temperatureError && (
                            <p className="mb-4 text-[0.92rem] text-zen-danger">
                                {temperatureError}
                            </p>
                        )}
                    </ModalFrame>
                )}
                {recordingAlert}
            </IonContent>
        </IonPage>
    );
};

export default BrewingZen;
