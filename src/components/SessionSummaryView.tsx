import React from 'react';
import { BrewingSession } from '../entities/BrewingSession.entity';
import {
    formatZenDateTime,
    formatZenSeconds,
    formatZenTemperature,
    formatZenWeight,
    zenActionRowStyle,
    zenMetricGridCardStyle,
    zenPanelStyle,
    zenSecondaryPanelStyle,
    zenStackStyle,
    ZEN_PALETTE,
} from '../screens/brewing/zenBrewingShared';

type SummaryFieldProps = {
    label: string;
    value: string;
    onClick?: () => void;
    disabled?: boolean;
    highlighted?: boolean;
};

type SessionSummaryViewProps = {
    session: BrewingSession;
    brewingVesselLabel: string;
    title?: string;
    teaNameAction?: () => void;
    brewingVesselAction?: () => void;
    brewingVesselActionDisabled?: boolean;
    onInfusionPress?: (infusionId: string, currentNote: string) => void;
    showNotes?: boolean;
    footer?: React.ReactNode;
};

const SummaryField: React.FC<SummaryFieldProps> = ({ label, value, onClick, disabled, highlighted }) => {
    const content = (
        <>
            <span style={{ color: ZEN_PALETTE.muted, letterSpacing: '0.03em' }}>{label}</span>
            <span>{value}</span>
        </>
    );

    const baseStyle: React.CSSProperties = {
        width: '100%',
        padding: '16px 18px',
        borderRadius: '18px',
        border: `1px solid ${ZEN_PALETTE.border}`,
        background: highlighted ? ZEN_PALETTE.accentSoft : 'rgba(255, 255, 255, 0.52)',
        color: ZEN_PALETTE.text,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '1rem',
    };

    if (!onClick) {
        return <div style={baseStyle}>{content}</div>;
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            style={{
                ...baseStyle,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
            }}
        >
            {content}
        </button>
    );
};

const SessionSummaryView: React.FC<SessionSummaryViewProps> = ({
    session,
    brewingVesselLabel,
    title = 'Session Summary',
    teaNameAction,
    brewingVesselAction,
    brewingVesselActionDisabled = false,
    onInfusionPress,
    showNotes = false,
    footer,
}) => {
    const hasTeaName = Boolean(session.teaName?.trim());
    const hasBrewingVesselWeights = Boolean((session.vesselWeight ?? 0) > 0 && (session.lidWeight ?? 0) > 0);
    const hasBrewingVesselName = Boolean(session.brewingVessel?.name?.trim());

    const setupItems = [
        { label: 'Vessel', value: formatZenWeight(session.vesselWeight) },
        { label: 'Lid', value: formatZenWeight(session.lidWeight) },
        { label: 'Tray', value: formatZenWeight(session.trayWeight) },
        { label: 'Tea', value: formatZenWeight(session.dryTeaLeavesWeight) },
    ];

    const timingItems = [
        { label: 'Started', value: formatZenDateTime(session.startTime) },
        { label: 'Ended', value: formatZenDateTime(session.endTime) },
    ];

    return (
        <div style={zenStackStyle}>
            <section style={zenSecondaryPanelStyle}>
                <p style={{ margin: 0, color: ZEN_PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: '0.76rem' }}>
                    {title}
                </p>
                <h2 style={{ margin: '10px 0 8px', fontSize: '1.9rem', fontWeight: 400 }}>
                    {session.teaName?.trim() || 'no tea selected'}
                </h2>
            </section>

            <section style={zenPanelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 500 }}>Setup</h3>
                </div>
                <div style={{ marginBottom: '12px' }}>
                    <SummaryField
                        label="Tea name"
                        value={session.teaName?.trim() || 'no tea selected'}
                        onClick={teaNameAction}
                        highlighted={Boolean(teaNameAction) && !hasTeaName}
                    />
                </div>
                <div style={{ marginBottom: '12px' }}>
                    <SummaryField
                        label="Vessel name"
                        value={brewingVesselLabel}
                        onClick={brewingVesselAction}
                        disabled={brewingVesselActionDisabled}
                        highlighted={Boolean(brewingVesselAction) && !hasBrewingVesselName && hasBrewingVesselWeights}
                    />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                    {setupItems.map((item) => (
                        <div key={item.label} style={zenMetricGridCardStyle}>
                            <div style={{ color: ZEN_PALETTE.muted, fontSize: '0.82rem', marginBottom: '6px' }}>{item.label}</div>
                            <div>{item.value}</div>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '12px' }}>
                    {timingItems.map((item) => (
                        <div key={item.label} style={zenMetricGridCardStyle}>
                            <div style={{ color: ZEN_PALETTE.muted, fontSize: '0.82rem', marginBottom: '6px' }}>{item.label}</div>
                            <div>{item.value}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section style={zenPanelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 500 }}>Infusions</h3>
                    <span style={{ color: ZEN_PALETTE.muted, fontSize: '0.9rem' }}>{session.infusions?.length ?? 0} total</span>
                </div>

                {(session.infusions?.length ?? 0) > 0 ? (
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {session.infusions.map((infusion) => (
                            <button
                                key={infusion.infusionId}
                                type="button"
                                onClick={() => onInfusionPress?.(infusion.infusionId, infusion.note ?? '')}
                                disabled={!onInfusionPress}
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: '18px',
                                    border: `1px solid ${ZEN_PALETTE.border}`,
                                    background: 'rgba(255,255,255,0.58)',
                                    textAlign: 'left',
                                    color: ZEN_PALETTE.text,
                                    cursor: onInfusionPress ? 'pointer' : 'default',
                                    opacity: 1,
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <strong>Infusion {infusion.infusionNumber}</strong>
                                    <span style={{ color: ZEN_PALETTE.muted }}>{formatZenSeconds(infusion.duration)}</span>
                                </div>
                                <div style={{ color: ZEN_PALETTE.muted, display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.92rem' }}>
                                    <span>Water {formatZenWeight(infusion.waterWeight)}</span>
                                    <span>Wet leaves {formatZenWeight(infusion.wetTeaLeavesWeight)}</span>
                                    <span>Rest {formatZenSeconds(infusion.restDuration)}</span>
                                    {infusion.temperature !== null && infusion.temperature !== undefined && (
                                        <span>{formatZenTemperature(infusion.temperature)}</span>
                                    )}
                                </div>
                                {infusion.note?.trim() && (
                                    <div style={{ marginTop: '10px', color: ZEN_PALETTE.text, fontSize: '0.95rem' }}>
                                        {infusion.note}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                ) : (
                    <p style={{ margin: 0, color: ZEN_PALETTE.muted }}>No infusions were recorded for this session.</p>
                )}
            </section>

            {showNotes && (
                <section style={zenPanelStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 500 }}>Notes</h3>
                    </div>
                    <p style={{ margin: 0, color: session.notes?.trim() ? ZEN_PALETTE.text : ZEN_PALETTE.muted }}>
                        {session.notes?.trim() || 'No notes'}
                    </p>
                </section>
            )}

            {footer ? <section style={zenActionRowStyle}>{footer}</section> : null}
        </div>
    );
};

export default SessionSummaryView;
