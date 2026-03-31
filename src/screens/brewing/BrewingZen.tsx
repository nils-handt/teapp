import {
    createGesture,
    IonButton,
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
} from '@ionic/react';
import React, { useEffect, useRef, useState } from 'react';
import DesignSwitcher from '../../components/DesignSwitcher';
import InfusionNoteEditorModal from '../../components/InfusionNoteEditorModal';
import SessionSummaryView from '../../components/SessionSummaryView';
import TeaNameEditorModal from '../../components/TeaNameEditorModal';
import { useBrewingControl } from '../../hooks/useBrewingControl';
import { bluetoothScaleService } from '../../services/BluetoothScaleService';
import { brewingSessionService } from '../../services/brewing/BrewingSessionService';
import { BrewingPhase } from '../../services/interfaces/brewing.types';
import { useShallow } from 'zustand/react/shallow';
import { useBrewingStore } from '../../stores/useBrewingStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { useScaleStore } from '../../stores/useScaleStore';
import {
    formatZenSeconds,
    formatZenWeight,
    zenActionRowStyle,
    zenContainerStyle,
    zenDangerButtonStyle,
    zenHeroButtonStyle,
    zenPanelStyle,
    zenPrimaryButtonStyle,
    zenSecondaryPanelStyle,
    zenStackStyle,
    ZEN_PALETTE,
} from './zenBrewingShared';

type SetupField = 'vesselWeight' | 'lidWeight' | 'trayWeight' | 'dryTeaLeavesWeight';
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
    const { connectionStatus, currentWeight } = useScaleStore(useShallow((state) => ({
        connectionStatus: state.connectionStatus,
        currentWeight: state.currentWeight,
    })));
    const { knownTeaNames, loadKnownTeaNames, upsertKnownTeaName } = useHistoryStore(
        useShallow((state) => ({
            knownTeaNames: state.knownTeaNames,
            loadKnownTeaNames: state.loadKnownTeaNames,
            upsertKnownTeaName: state.upsertKnownTeaName,
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
    const infusionHistoryStripRef = useRef<HTMLDivElement | null>(null);

    const phaseCopy = PHASE_COPY[brewingPhase] ?? PHASE_COPY[BrewingPhase.IDLE];
    const hasTeaName = Boolean(activeSession?.teaName?.trim());
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
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: direction === 'previous' ? 'flex-end' : 'flex-start',
                gap: '6px',
                minWidth: '24px',
            }}
        >
            {Array.from({ length: Math.min(availableCount, 2) }, (_, index) => (
                <span
                    key={`${direction}-${index + 1}`}
                    data-testid={`infusion-history-${direction}-dot-${index + 1}`}
                    style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
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
                header: 'Tea Name',
                inputType: 'text',
                value: activeSession?.teaName ?? '',
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
            trayWeight: {
                header: 'Tray',
                inputType: 'number',
                value: String(activeSession?.trayWeight ?? 0),
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
            void loadKnownTeaNames();
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
        options?: { active?: boolean; customColor?: string }
    ) => (
        <button
            type="button"
            aria-label={buttonLabel}
            onClick={onClick}
            disabled={!canEditInfusionMetadata}
            style={{
                flex: 1,
                minHeight: '44px',
                borderRadius: '14px',
                border: `1px solid ${options?.active ? '#1f1f1f' : ZEN_PALETTE.border}`,
                background: options?.active ? ZEN_PALETTE.background : 'transparent',
                color: options?.active ? '#000000' : ZEN_PALETTE.muted,
                fontSize: '1rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: canEditInfusionMetadata ? 'pointer' : 'not-allowed',
                opacity: canEditInfusionMetadata ? 1 : 0.5,
            }}
        >
            {value}
        </button>
    );

    const renderInfusionControls = () => (
        <section style={{ ...zenPanelStyle, padding: '16px', display: 'flex', gap: '10px' }}>
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

    const handleAlertSave = () => {
        if (!alertState) {
            return;
        }

        const nextValue = draftValue;
        if (alertState.field === 'teaName') {
            brewingSessionService.updateTeaName(nextValue);
            upsertKnownTeaName(nextValue);
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
            style={{
                width: '100%',
                padding: '16px 18px',
                borderRadius: '18px',
                border: `1px solid ${ZEN_PALETTE.border}`,
                background:
                    (field === 'teaName' && !hasTeaName) || (field === 'brewingVesselName' && !hasBrewingVesselName && hasBrewingVesselWeights)
                        ? ZEN_PALETTE.accentSoft
                        : 'rgba(255, 255, 255, 0.52)',
                color: ZEN_PALETTE.text,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '1rem',
                cursor: options?.disabled ? 'not-allowed' : 'pointer',
                opacity: options?.disabled ? 0.6 : 1,
            }}
        >
            <span style={{ color: ZEN_PALETTE.muted, letterSpacing: '0.03em' }}>{label}</span>
            <span>{value}</span>
        </button>
    );

    const renderDisconnectedState = () => (
        <div style={{ ...zenStackStyle, justifyContent: 'center', minHeight: 'calc(100vh - 120px)' }}>
            <button
                type="button"
                onClick={() => bluetoothScaleService.connectNewDevice()}
                disabled={connectionStatus === 'connecting'}
                style={{
                    ...zenHeroButtonStyle,
                    cursor: connectionStatus === 'connecting' ? 'default' : 'pointer',
                }}
            >
                CONNECT TO SCALE
            </button>
        </div>
    );

    const renderSetupView = () => (
        <div style={zenStackStyle}>
            <section style={zenSecondaryPanelStyle}>
                <p style={{ margin: 0, color: ZEN_PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: '0.76rem' }}>
                    {phaseCopy.label}
                </p>
                <div style={{ fontSize: '3.4rem', lineHeight: 1, fontWeight: 300, marginTop: '8px' }}>
                    {formatZenWeight(currentWeight)}
                </div>
            </section>

            <section style={zenPanelStyle}>
                <div style={{ display: 'grid', gap: '12px' }}>
                    {renderFieldButton('Vessel', formatZenWeight(activeSession?.vesselWeight), 'vesselWeight')}
                    {renderFieldButton('Lid', formatZenWeight(activeSession?.lidWeight), 'lidWeight')}
                    {renderFieldButton('Tray', formatZenWeight(activeSession?.trayWeight), 'trayWeight')}
                    {renderFieldButton('Tea', formatZenWeight(activeSession?.dryTeaLeavesWeight), 'dryTeaLeavesWeight')}
                    {renderFieldButton('Tea name', activeSession?.teaName?.trim() || 'no tea selected', 'teaName')}
                    {renderFieldButton('Vessel name', brewingVesselLabel, 'brewingVesselName', { disabled: !hasBrewingVesselWeights })}
                </div>
            </section>

            <section style={zenActionRowStyle}>
                <IonButton
                    expand="block"
                    shape="round"
                    onClick={() => handleEndSession()}
                    style={zenDangerButtonStyle}
                >
                    End Session
                </IonButton>
                <IonButton
                    expand="block"
                    shape="round"
                    onClick={() => brewingSessionService.confirmSetupDone()}
                    style={zenPrimaryButtonStyle}
                >
                    Confirm Setup
                </IonButton>
            </section>
        </div>
    );

    const renderActiveView = (options?: { greyTimer?: boolean }) => (
        <div style={zenStackStyle}>
            {renderInfusionControls()}
            <section style={{ ...zenSecondaryPanelStyle, textAlign: 'center' }}>
                <p style={{ margin: 0, color: ZEN_PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: '0.76rem' }}>
                    {phaseCopy.label}
                </p>
                <div
                    style={{
                        margin: '14px auto 10px',
                        width: 'min(320px, 78vw)',
                        aspectRatio: '1 / 1',
                        borderRadius: '50%',
                        border: `1px solid ${ZEN_PALETTE.border}`,
                        background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(230,238,226,0.9))',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
                    }}
                >
                    <span
                        style={{
                            fontSize: '3.4rem',
                            fontWeight: 300,
                            color: options?.greyTimer ? ZEN_PALETTE.restTimer : ZEN_PALETTE.text,
                            transition: 'color 200ms ease',
                        }}
                    >
                        {formatTime(timerValue)}
                    </span>
                </div>
                {selectedInfusion && (
                    <div
                        ref={infusionHistoryStripRef}
                        data-testid="infusion-history-strip"
                        aria-label={`Infusion ${selectedInfusion.infusionNumber} - ${formatZenSeconds(selectedInfusion.duration)}`}
                        style={{
                            marginTop: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            color: ZEN_PALETTE.muted,
                            fontSize: '0.98rem',
                            touchAction: 'pan-y',
                            userSelect: 'none',
                        }}
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
                <section style={zenPanelStyle}>
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {!hasTeaName && renderFieldButton('Tea name', 'no tea selected', 'teaName')}
                        {!hasBrewingVesselName && renderFieldButton('Vessel name', brewingVesselLabel, 'brewingVesselName', { disabled: !hasBrewingVesselWeights })}
                    </div>
                </section>
            )}

            <section style={zenActionRowStyle}>
                <IonButton
                    expand="block"
                    shape="round"
                    onClick={() => handleEndSession()}
                    style={zenDangerButtonStyle}
                >
                    End Session
                </IonButton>
                {(brewingPhase === BrewingPhase.INFUSION || brewingPhase === BrewingPhase.INFUSION_VESSEL_LIFTED) && (
                    <IonButton
                        expand="block"
                        shape="round"
                        onClick={() => brewingSessionService.manuallyStopInfusion()}
                        style={zenPrimaryButtonStyle}
                    >
                        End Infusion
                    </IonButton>
                )}
                {(brewingPhase === BrewingPhase.READY || brewingPhase === BrewingPhase.REST) && (
                    <IonButton
                        expand="block"
                        shape="round"
                        onClick={() => brewingSessionService.manuallyStartInfusion()}
                        style={zenPrimaryButtonStyle}
                    >
                        Start Infusion
                    </IonButton>
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
            footer={(
                <IonButton
                    expand="block"
                    shape="round"
                    onClick={() => startBrewingSession()}
                    style={zenPrimaryButtonStyle}
                >
                    Start New Session
                </IonButton>
            )}
        />
    );

    const renderIdleView = () => (
        <div style={zenStackStyle}>
            <button
                type="button"
                onClick={() => startBrewingSession()}
                style={zenHeroButtonStyle}
            >
                START SESSION
            </button>
        </div>
    );

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
            <IonHeader className="ion-no-border">
                <IonToolbar>
                    <IonTitle>Zen</IonTitle>
                    <DesignSwitcher />
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <div style={zenContainerStyle}>
                    {renderPhaseContent()}
                </div>

                <TeaNameEditorModal
                    isOpen={alertState?.field === 'teaName'}
                    title={alertState?.header ?? 'Tea Name'}
                    value={draftValue}
                    knownTeaNames={knownTeaNames}
                    onChange={setDraftValue}
                    onCancel={closeEditor}
                    onSave={handleAlertSave}
                />
                <InfusionNoteEditorModal
                    isOpen={Boolean(noteEditorTarget)}
                    title="Edit Infusion Note"
                    value={noteDraft}
                    onChange={setNoteDraft}
                    onCancel={closeNoteEditor}
                    onSave={handleNoteSave}
                />

                {alertState && alertState.field !== 'teaName' && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(20, 28, 22, 0.24)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px',
                            zIndex: 1000,
                        }}
                    >
                        <div
                            style={{
                                width: 'min(420px, 100%)',
                                borderRadius: '24px',
                                background: '#fffdf8',
                                border: `1px solid ${ZEN_PALETTE.border}`,
                                boxShadow: '0 18px 36px rgba(40, 52, 40, 0.18)',
                                padding: '22px',
                            }}
                        >
                            <h3 style={{ margin: '0 0 14px', fontSize: '1.1rem', fontWeight: 500 }}>{alertState.header}</h3>
                            <input
                                autoFocus
                                type={alertState.inputType}
                                value={draftValue}
                                onChange={(event) => setDraftValue(event.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: '16px',
                                    border: `1px solid ${ZEN_PALETTE.border}`,
                                    fontSize: '1rem',
                                    outline: 'none',
                                    marginBottom: '16px',
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                <IonButton
                                    shape="round"
                                    onClick={closeEditor}
                                    style={{ '--background': '#ece8df', '--color': '#000000' }}
                                >
                                    Cancel
                                </IonButton>
                                <IonButton
                                    shape="round"
                                    onClick={handleAlertSave}
                                    style={zenPrimaryButtonStyle}
                                >
                                    Save
                                </IonButton>
                            </div>
                        </div>
                    </div>
                )}
                {isTemperatureEditorOpen && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(20, 28, 22, 0.24)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px',
                            zIndex: 1000,
                        }}
                    >
                        <div
                            style={{
                                width: 'min(420px, 100%)',
                                borderRadius: '24px',
                                background: '#fffdf8',
                                border: `1px solid ${ZEN_PALETTE.border}`,
                                boxShadow: '0 18px 36px rgba(40, 52, 40, 0.18)',
                                padding: '22px',
                            }}
                        >
                            <h3 style={{ margin: '0 0 14px', fontSize: '1.1rem', fontWeight: 500 }}>Infusion Temperature</h3>
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
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: '16px',
                                    border: `1px solid ${temperatureError ? '#c14a3f' : ZEN_PALETTE.border}`,
                                    fontSize: '1rem',
                                    outline: 'none',
                                    marginBottom: '10px',
                                }}
                            />
                            {temperatureError && (
                                <p style={{ margin: '0 0 16px', color: '#c14a3f', fontSize: '0.92rem' }}>
                                    {temperatureError}
                                </p>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                <IonButton
                                    shape="round"
                                    onClick={closeTemperatureEditor}
                                    style={{ '--background': '#ece8df', '--color': '#000000' }}
                                >
                                    Cancel
                                </IonButton>
                                <IonButton
                                    shape="round"
                                    onClick={handleTemperatureSave}
                                    style={zenPrimaryButtonStyle}
                                >
                                    Save
                                </IonButton>
                            </div>
                        </div>
                    </div>
                )}
                {recordingAlert}
            </IonContent>
        </IonPage>
    );
};

export default BrewingZen;
