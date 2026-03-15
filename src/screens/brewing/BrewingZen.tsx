import {
    IonButton,
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
} from '@ionic/react';
import React, { useMemo, useState } from 'react';
import DesignSwitcher from '../../components/DesignSwitcher';
import { useBrewingControl } from '../../hooks/useBrewingControl';
import { useStore } from '../../stores/useStore';
import { bluetoothScaleService } from '../../services/BluetoothScaleService';
import { brewingSessionService } from '../../services/brewing/BrewingSessionService';
import { BrewingPhase } from '../../services/interfaces/brewing.types';

type SetupField = 'vesselWeight' | 'lidWeight' | 'trayWeight' | 'dryTeaLeavesWeight';
type EditableField = SetupField | 'teaName';

type AlertState =
    | {
        field: EditableField;
        header: string;
        inputType: 'number' | 'text';
    }
    | null;

const PHASE_COPY: Record<BrewingPhase, { label: string; message: string }> = {
    [BrewingPhase.IDLE]: { label: 'Zen', message: '' },
    [BrewingPhase.SETUP]: { label: 'Setup', message: '' },
    [BrewingPhase.READY]: { label: 'Ready', message: '' },
    [BrewingPhase.INFUSION]: { label: 'Infusing', message: '' },
    [BrewingPhase.INFUSION_VESSEL_LIFTED]: { label: 'Pouring', message: '' },
    [BrewingPhase.REST]: { label: 'Rest', message: '' },
    [BrewingPhase.ENDED]: { label: 'Ended', message: '' },
};

const PALETTE = {
    background: 'linear-gradient(180deg, #f7f3eb 0%, #eef3ea 100%)',
    panel: 'rgba(255, 252, 246, 0.86)',
    panelStrong: 'rgba(246, 250, 242, 0.95)',
    border: 'rgba(93, 113, 90, 0.16)',
    text: '#243126',
    muted: '#68756a',
    accentSoft: 'rgba(95, 124, 97, 0.12)',
    restTimer: '#9aa399',
    buttonSoft: '#d9e8ef',
    dangerSoft: '#fad3ce',
};

const containerStyle: React.CSSProperties = {
    minHeight: '100%',
    padding: '24px 20px 40px',
    background: '#ffffff',
    color: PALETTE.text,
};

const stackStyle: React.CSSProperties = {
    maxWidth: '720px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
};

const panelStyle: React.CSSProperties = {
    background: PALETTE.panel,
    border: `1px solid ${PALETTE.border}`,
    borderRadius: '28px',
    padding: '22px',
    boxShadow: '0 16px 36px rgba(69, 83, 66, 0.08)',
    backdropFilter: 'blur(10px)',
};

const secondaryPanelStyle: React.CSSProperties = {
    ...panelStyle,
    background: PALETTE.panelStrong,
    backgroundImage: PALETTE.background,
};

const actionRowStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'center',
};

const heroButtonStyle: React.CSSProperties = {
    ...secondaryPanelStyle,
    width: '100%',
    padding: '40px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    color: '#000000',
    fontSize: '1.05rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
};

const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatWeight = (value?: number | null) => `${(value ?? 0).toFixed(1)} g`;

const formatDateTime = (value?: string | null) => {
    if (!value) {
        return 'Not available';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return 'Not available';
    }

    return parsed.toLocaleString();
};

const formatSeconds = (value?: number | null) => {
    const totalSeconds = value ?? 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const BrewingZen: React.FC = () => {
    const {
        activeSession,
        brewingPhase,
        connectionStatus,
        currentWeight,
        timerValue,
    } = useStore();
    const { startBrewingSession, handleEndSession, recordingAlert } = useBrewingControl();
    const [alertState, setAlertState] = useState<AlertState>(null);
    const [draftValue, setDraftValue] = useState('');

    const phaseCopy = PHASE_COPY[brewingPhase] ?? PHASE_COPY[BrewingPhase.IDLE];
    const hasTeaName = Boolean(activeSession?.teaName?.trim());

    const setupItems = useMemo(() => ([
        { label: 'Vessel', value: formatWeight(activeSession?.vesselWeight) },
        { label: 'Lid', value: formatWeight(activeSession?.lidWeight) },
        { label: 'Tray', value: formatWeight(activeSession?.trayWeight) },
        { label: 'Tea', value: formatWeight(activeSession?.dryTeaLeavesWeight) },
    ]), [activeSession]);

    const timingItems = useMemo(() => ([
        { label: 'Started', value: formatDateTime(activeSession?.startTime) },
        { label: 'Ended', value: formatDateTime(activeSession?.endTime) },
    ]), [activeSession]);

    const openAlert = (field: EditableField) => {
        if (!activeSession && field !== 'teaName') {
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
        };

        setAlertState({
            field,
            header: config[field].header,
            inputType: config[field].inputType,
        });
        setDraftValue(config[field].value);
    };

    const closeEditor = () => {
        setAlertState(null);
        setDraftValue('');
    };

    const handleAlertSave = () => {
        if (!alertState) {
            return;
        }

        const nextValue = draftValue;
        if (alertState.field === 'teaName') {
            brewingSessionService.updateTeaName(nextValue);
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

    const renderFieldButton = (label: string, value: string, field: EditableField) => (
        <button
            type="button"
            onClick={() => openAlert(field)}
            style={{
                width: '100%',
                padding: '16px 18px',
                borderRadius: '18px',
                border: `1px solid ${PALETTE.border}`,
                background: field === 'teaName' && !hasTeaName ? PALETTE.accentSoft : 'rgba(255, 255, 255, 0.52)',
                color: PALETTE.text,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '1rem',
                cursor: 'pointer',
            }}
        >
            <span style={{ color: PALETTE.muted, letterSpacing: '0.03em' }}>{label}</span>
            <span>{value}</span>
        </button>
    );

    const renderDisconnectedState = () => (
        <div style={{ ...stackStyle, justifyContent: 'center', minHeight: 'calc(100vh - 120px)' }}>
            <button
                type="button"
                onClick={() => bluetoothScaleService.connectNewDevice()}
                disabled={connectionStatus === 'connecting'}
                style={{
                    ...heroButtonStyle,
                    cursor: connectionStatus === 'connecting' ? 'default' : 'pointer',
                }}
            >
                CONNECT TO SCALE
            </button>
        </div>
    );

    const renderSetupView = () => (
        <div style={stackStyle}>
            <section style={secondaryPanelStyle}>
                <p style={{ margin: 0, color: PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: '0.76rem' }}>
                    {phaseCopy.label}
                </p>
                <div style={{ fontSize: '3.4rem', lineHeight: 1, fontWeight: 300 }}>
                    {formatWeight(currentWeight)}
                </div>
            </section>

            <section style={panelStyle}>
                <div style={{ display: 'grid', gap: '12px' }}>
                    {renderFieldButton('Vessel', formatWeight(activeSession?.vesselWeight), 'vesselWeight')}
                    {renderFieldButton('Lid', formatWeight(activeSession?.lidWeight), 'lidWeight')}
                    {renderFieldButton('Tray', formatWeight(activeSession?.trayWeight), 'trayWeight')}
                    {renderFieldButton('Tea', formatWeight(activeSession?.dryTeaLeavesWeight), 'dryTeaLeavesWeight')}
                    {renderFieldButton('Tea name', activeSession?.teaName?.trim() || 'no tea selected', 'teaName')}
                </div>
            </section>

            <section style={actionRowStyle}>
                <IonButton
                    expand="block"
                    shape="round"
                    onClick={() => handleEndSession()}
                    style={{ '--background': PALETTE.dangerSoft, '--color': '#000000' }}
                >
                    End Session
                </IonButton>
                <IonButton
                    expand="block"
                    shape="round"
                    onClick={() => brewingSessionService.confirmSetupDone()}
                    style={{ '--background': PALETTE.buttonSoft, '--color': '#000000' }}
                >
                    Confirm Setup
                </IonButton>
            </section>
        </div>
    );

    const renderActiveView = (options?: { greyTimer?: boolean }) => (
        <div style={stackStyle}>
            <section style={{ ...secondaryPanelStyle, textAlign: 'center' }}>
                <p style={{ margin: 0, color: PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: '0.76rem' }}>
                    {phaseCopy.label}
                </p>
                <div
                    style={{
                        margin: '14px auto 10px',
                        width: 'min(320px, 78vw)',
                        aspectRatio: '1 / 1',
                        borderRadius: '50%',
                        border: `1px solid ${PALETTE.border}`,
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
                            color: options?.greyTimer ? PALETTE.restTimer : PALETTE.text,
                            transition: 'color 200ms ease',
                        }}
                    >
                        {formatTime(timerValue)}
                    </span>
                    <span style={{ marginTop: '8px', color: PALETTE.muted, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.82rem' }}>
                        {phaseCopy.label}
                    </span>
                </div>
                {phaseCopy.message && (
                    <p style={{ margin: 0, color: PALETTE.muted, lineHeight: 1.6 }}>
                        {phaseCopy.message}
                    </p>
                )}
            </section>

            {!hasTeaName && (
                <section style={panelStyle}>
                    {renderFieldButton('Tea name', 'no tea selected', 'teaName')}
                </section>
            )}

            <section style={actionRowStyle}>
                <IonButton
                    expand="block"
                    shape="round"
                    onClick={() => handleEndSession()}
                    style={{ '--background': PALETTE.dangerSoft, '--color': '#000000' }}
                >
                    End Session
                </IonButton>
                {(brewingPhase === BrewingPhase.INFUSION || brewingPhase === BrewingPhase.INFUSION_VESSEL_LIFTED) && (
                    <IonButton
                        expand="block"
                        shape="round"
                        onClick={() => brewingSessionService.manuallyStopInfusion()}
                        style={{ '--background': PALETTE.buttonSoft, '--color': '#000000' }}
                    >
                        End Infusion
                    </IonButton>
                )}
                {(brewingPhase === BrewingPhase.READY || brewingPhase === BrewingPhase.REST) && (
                    <IonButton
                        expand="block"
                        shape="round"
                        onClick={() => brewingSessionService.manuallyStartInfusion()}
                        style={{ '--background': PALETTE.buttonSoft, '--color': '#000000' }}
                    >
                        Start Infusion
                    </IonButton>
                )}
            </section>
        </div>
    );

    const renderEndedView = () => (
        <div style={stackStyle}>
            <section style={secondaryPanelStyle}>
                <p style={{ margin: 0, color: PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: '0.76rem' }}>
                    Session Summary
                </p>
                <h2 style={{ margin: '10px 0 8px', fontSize: '1.9rem', fontWeight: 400 }}>
                    {activeSession?.teaName?.trim() || 'no tea selected'}
                </h2>
            </section>

            <section style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 500 }}>Setup</h3>
                </div>
                <div style={{ marginBottom: '12px' }}>
                    {renderFieldButton('Tea name', activeSession?.teaName?.trim() || 'no tea selected', 'teaName')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                    {setupItems.map((item) => (
                        <div
                            key={item.label}
                            style={{
                                padding: '14px 16px',
                                borderRadius: '18px',
                                background: 'rgba(255,255,255,0.55)',
                                border: `1px solid ${PALETTE.border}`,
                            }}
                        >
                            <div style={{ color: PALETTE.muted, fontSize: '0.82rem', marginBottom: '6px' }}>{item.label}</div>
                            <div>{item.value}</div>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '12px' }}>
                    {timingItems.map((item) => (
                        <div
                            key={item.label}
                            style={{
                                padding: '14px 16px',
                                borderRadius: '18px',
                                background: 'rgba(255,255,255,0.55)',
                                border: `1px solid ${PALETTE.border}`,
                            }}
                        >
                            <div style={{ color: PALETTE.muted, fontSize: '0.82rem', marginBottom: '6px' }}>{item.label}</div>
                            <div>{item.value}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 500 }}>Infusions</h3>
                    <span style={{ color: PALETTE.muted, fontSize: '0.9rem' }}>{activeSession?.infusions?.length ?? 0} total</span>
                </div>

                {(activeSession?.infusions?.length ?? 0) > 0 ? (
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {activeSession?.infusions?.map((infusion) => (
                            <div
                                key={infusion.infusionId}
                                style={{
                                    padding: '14px 16px',
                                    borderRadius: '18px',
                                    border: `1px solid ${PALETTE.border}`,
                                    background: 'rgba(255,255,255,0.58)',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <strong>Infusion {infusion.infusionNumber}</strong>
                                    <span style={{ color: PALETTE.muted }}>{formatSeconds(infusion.duration)}</span>
                                </div>
                                <div style={{ color: PALETTE.muted, display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.92rem' }}>
                                    <span>Water {formatWeight(infusion.waterWeight)}</span>
                                    <span>Wet leaves {formatWeight(infusion.wetTeaLeavesWeight)}</span>
                                    <span>Rest {formatSeconds(infusion.restDuration)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ margin: 0, color: PALETTE.muted }}>No infusions were recorded for this session.</p>
                )}
            </section>

            <section style={actionRowStyle}>
                <IonButton
                    expand="block"
                    shape="round"
                    onClick={() => startBrewingSession()}
                    style={{ '--background': PALETTE.buttonSoft, '--color': '#000000' }}
                >
                    Start New Session
                </IonButton>
            </section>
        </div>
    );

    const renderIdleView = () => (
        <div style={stackStyle}>
            <button
                type="button"
                onClick={() => startBrewingSession()}
                style={heroButtonStyle}
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
                <div style={containerStyle}>
                    {renderPhaseContent()}
                </div>

                {alertState && (
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
                                border: `1px solid ${PALETTE.border}`,
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
                                    border: `1px solid ${PALETTE.border}`,
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
                                    style={{ '--background': PALETTE.buttonSoft, '--color': '#000000' }}
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
