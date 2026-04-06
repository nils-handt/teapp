import React from 'react';
import { BrewingSession } from '../entities/BrewingSession.entity';
import {
    formatZenDateTime,
    formatZenSeconds,
    formatZenTemperature,
    formatZenWeight,
} from '../screens/brewing/zenBrewingShared';
import {
    cn,
    zenActionRowClass,
    zenFieldBaseClass,
    zenFieldLabelClass,
    zenFieldStateClassMap,
    zenFieldToneClassMap,
    zenMetricCardClass,
    zenPanelClass,
    zenPanelStrongClass,
    zenStackClass,
    zenSummaryListClass,
    zenSummaryListItemClass,
    zenSummarySectionHeadingClass,
    zenSummarySectionTitleClass,
    zenSummaryStatLabelClass,
} from '../styles/zen';

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
            <span className={zenFieldLabelClass}>{label}</span>
            <span>{value}</span>
        </>
    );

    const className = cn(
        zenFieldBaseClass,
        highlighted ? zenFieldToneClassMap.highlighted : zenFieldToneClassMap.default,
        disabled ? zenFieldStateClassMap.disabled : zenFieldStateClassMap.enabled,
    );

    if (!onClick) {
        return <div className={cn(className, 'cursor-default')}>{content}</div>;
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={className}
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
        <div className={zenStackClass}>
            <section className={zenPanelStrongClass}>
                <p className="m-0 text-[0.76rem] uppercase tracking-[0.16em] text-zen-muted">
                    {title}
                </p>
                <h2 className="mt-[10px] mb-2 text-[1.9rem] font-normal text-zen-text">
                    {session.teaName?.trim() || 'no tea selected'}
                </h2>
            </section>

            <section className={zenPanelClass}>
                <div className={zenSummarySectionHeadingClass}>
                    <h3 className={zenSummarySectionTitleClass}>Setup</h3>
                </div>
                <div className="mb-3">
                    <SummaryField
                        label="Tea name"
                        value={session.teaName?.trim() || 'no tea selected'}
                        onClick={teaNameAction}
                        highlighted={Boolean(teaNameAction) && !hasTeaName}
                    />
                </div>
                <div className="mb-3">
                    <SummaryField
                        label="Vessel name"
                        value={brewingVesselLabel}
                        onClick={brewingVesselAction}
                        disabled={brewingVesselActionDisabled}
                        highlighted={Boolean(brewingVesselAction) && !hasBrewingVesselName && hasBrewingVesselWeights}
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {setupItems.map((item) => (
                        <div key={item.label} className={zenMetricCardClass}>
                            <div className={zenSummaryStatLabelClass}>{item.label}</div>
                            <div>{item.value}</div>
                        </div>
                    ))}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {timingItems.map((item) => (
                        <div key={item.label} className={zenMetricCardClass}>
                            <div className={zenSummaryStatLabelClass}>{item.label}</div>
                            <div>{item.value}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section className={zenPanelClass}>
                <div className={zenSummarySectionHeadingClass}>
                    <h3 className={zenSummarySectionTitleClass}>Infusions</h3>
                    <span className="text-[0.9rem] text-zen-muted">{session.infusions?.length ?? 0} total</span>
                </div>

                {(session.infusions?.length ?? 0) > 0 ? (
                    <div className={zenSummaryListClass}>
                        {session.infusions.map((infusion) => (
                            <button
                                key={infusion.infusionId}
                                type="button"
                                onClick={() => onInfusionPress?.(infusion.infusionId, infusion.note ?? '')}
                                disabled={!onInfusionPress}
                                className={cn(zenSummaryListItemClass, onInfusionPress ? 'cursor-pointer' : 'cursor-default')}
                            >
                                <div className="mb-2 flex justify-between gap-3">
                                    <strong>Infusion {infusion.infusionNumber}</strong>
                                    <span className="text-zen-muted">{formatZenSeconds(infusion.duration)}</span>
                                </div>
                                <div className="flex flex-wrap gap-4 text-[0.92rem] text-zen-muted">
                                    <span>Water {formatZenWeight(infusion.waterWeight)}</span>
                                    <span>Wet leaves {formatZenWeight(infusion.wetTeaLeavesWeight)}</span>
                                    <span>Rest {formatZenSeconds(infusion.restDuration)}</span>
                                    {infusion.temperature !== null && infusion.temperature !== undefined && (
                                        <span>{formatZenTemperature(infusion.temperature)}</span>
                                    )}
                                </div>
                                {infusion.note?.trim() && (
                                    <div className="mt-[10px] text-[0.95rem] text-zen-text">
                                        {infusion.note}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="m-0 text-zen-muted">No infusions were recorded for this session.</p>
                )}
            </section>

            {showNotes && (
                <section className={zenPanelClass}>
                    <div className={zenSummarySectionHeadingClass}>
                        <h3 className={zenSummarySectionTitleClass}>Notes</h3>
                    </div>
                    <p className={cn('m-0', session.notes?.trim() ? 'text-zen-text' : 'text-zen-muted')}>
                        {session.notes?.trim() || 'No notes'}
                    </p>
                </section>
            )}

            {footer ? <section className={zenActionRowClass}>{footer}</section> : null}
        </div>
    );
};

export default SessionSummaryView;
