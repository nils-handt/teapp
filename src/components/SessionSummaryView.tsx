import React, { useState } from 'react';
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
    zenSectionEyebrowClass,
    zenStackClass,
    zenSummaryListClass,
    zenSummaryListItemClass,
    zenSummarySectionHeadingClass,
    zenSummaryStatLabelClass,
} from '../styles/zen';
import { formatTeaLabel } from '../utils/teaSearch';

type SummaryFieldProps = {
    label: string;
    value: string;
    onClick?: () => void;
    disabled?: boolean;
    highlighted?: boolean;
    valueMuted?: boolean;
};

type SessionSummaryViewProps = {
    session: BrewingSession;
    brewingVesselLabel: string;
    title?: string;
    teaNameAction?: () => void;
    brewingVesselAction?: () => void;
    brewingVesselActionDisabled?: boolean;
    onInfusionPress?: (infusionId: string, currentNote: string) => void;
    notesAction?: () => void;
    footer?: React.ReactNode;
};

const SummaryField: React.FC<SummaryFieldProps> = ({ label, value, onClick, disabled, highlighted, valueMuted }) => {
    const content = (
        <>
            <span className={zenFieldLabelClass}>{label}</span>
            <span className={valueMuted ? 'text-zen-muted' : undefined}>{value}</span>
        </>
    );

    const className = cn(
        zenFieldBaseClass,
        highlighted ? zenFieldToneClassMap.highlighted : zenFieldToneClassMap.default,
        onClick
            ? (disabled ? zenFieldStateClassMap.disabled : zenFieldStateClassMap.enabled)
            : 'cursor-default',
    );

    if (!onClick) {
        return <div className={className}>{content}</div>;
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(className, 'pointer-events-auto')}
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
    notesAction,
    footer,
}) => {
    const [isSetupExpanded, setIsSetupExpanded] = useState(false);
    const [areInfusionsExpanded, setAreInfusionsExpanded] = useState(false);
    const teaLabel = formatTeaLabel(session.tea) || session.teaName?.trim() || '';
    const hasTeaName = Boolean(teaLabel);
    const hasBrewingVesselWeights = Boolean((session.vesselWeight ?? 0) > 0 && (session.lidWeight ?? 0) > 0);
    const hasBrewingVesselName = Boolean(session.brewingVessel?.name?.trim());

    const setupItems = [
        { label: 'Vessel', value: formatZenWeight(session.vesselWeight) },
        { label: 'Lid', value: formatZenWeight(session.lidWeight) },
    ];

    const totalWaterAmount = (session.infusions ?? []).reduce(
        (total, infusion) => total + (infusion.waterWeight ?? 0),
        0,
    );
    const totalInfusionDuration = (session.infusions ?? []).reduce(
        (total, infusion) => total + (infusion.duration ?? 0),
        0,
    );

    const timingItems = [
        { label: 'Started', value: formatZenDateTime(session.startTime) },
        { label: 'Ended', value: formatZenDateTime(session.endTime) },
    ];

    return (
        <div className={zenStackClass}>
            <section className={zenPanelStrongClass}>
                <p className={zenSectionEyebrowClass}>
                    {title}
                </p>
                {teaNameAction ? (
                    <button
                        type="button"
                        onClick={teaNameAction}
                        className="block w-full appearance-none border-0 bg-transparent p-0 text-left cursor-pointer"
                    >
                        <h2 className={hasTeaName
                            ? 'mt-[10px] mb-2 text-[1.9rem] font-normal text-zen-text'
                            : 'mt-[10px] mb-2 text-[1.9rem] font-normal text-zen-muted'}>
                            {teaLabel || 'No tea selected'}
                        </h2>
                    </button>
                ) : (
                    <h2 className={hasTeaName
                        ? 'mt-[10px] mb-2 text-[1.9rem] font-normal text-zen-text'
                        : 'mt-[10px] mb-2 text-[1.9rem] font-normal text-zen-muted'}>
                        {teaLabel || 'No tea selected'}
                    </h2>
                )}
                <div className="mt-3">
                    <SummaryField
                        label="Notes"
                        value={session.notes?.trim() || 'No notes'}
                        onClick={notesAction}
                        valueMuted={!session.notes?.trim()}
                    />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className={zenMetricCardClass}>
                        <div className={zenSummaryStatLabelClass}>Water amount</div>
                        <div>{formatZenWeight(totalWaterAmount)}</div>
                    </div>
                    <div className={zenMetricCardClass}>
                        <div className={zenSummaryStatLabelClass}>Infusion duration</div>
                        <div>{formatZenSeconds(totalInfusionDuration)}</div>
                    </div>
                </div>
            </section>

            <section className={cn(zenPanelClass, 'relative pb-9')}>
                <button
                    type="button"
                    aria-label="Setup"
                    aria-expanded={isSetupExpanded}
                    aria-controls="session-summary-setup-details"
                    onClick={() => setIsSetupExpanded((expanded) => !expanded)}
                    className="absolute inset-0 z-0 cursor-pointer appearance-none border-0 bg-transparent p-0 text-zen-muted"
                >
                    <span aria-hidden="true" className={cn('absolute right-5 bottom-2 transition-transform', isSetupExpanded && 'rotate-180')}>⌄</span>
                </button>
                <div className={cn(zenSummarySectionHeadingClass, 'pointer-events-none relative z-10')}>
                    <span role="heading" aria-level={3} className={zenSectionEyebrowClass}>Setup</span>
                </div>
                <div className={cn(zenMetricCardClass, 'pointer-events-none relative z-10')}>
                    <div className={zenSummaryStatLabelClass}>Tea</div>
                    <div>{formatZenWeight(session.dryTeaLeavesWeight)}</div>
                </div>
                {isSetupExpanded && (
                    <div id="session-summary-setup-details" className="pointer-events-none relative z-10 mt-3">
                        <div className="mb-3">
                            <SummaryField
                                label="Vessel name"
                                value={brewingVesselLabel}
                                onClick={brewingVesselAction}
                                disabled={brewingVesselActionDisabled}
                                highlighted={Boolean(brewingVesselAction) && !hasBrewingVesselName && hasBrewingVesselWeights}
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    </div>
                )}
            </section>

            <section className={cn(zenPanelClass, 'relative pb-9')}>
                <button
                    type="button"
                    aria-label={`Infusions ${session.infusions?.length ?? 0} total`}
                    aria-expanded={areInfusionsExpanded}
                    aria-controls="session-summary-infusion-details"
                    onClick={() => setAreInfusionsExpanded((expanded) => !expanded)}
                    className="absolute inset-0 z-0 cursor-pointer appearance-none border-0 bg-transparent p-0 text-zen-muted"
                >
                    <span aria-hidden="true" className={cn('absolute right-5 bottom-2 transition-transform', areInfusionsExpanded && 'rotate-180')}>⌄</span>
                </button>
                <div className={cn(zenSummarySectionHeadingClass, 'pointer-events-none relative z-10')}>
                    <span role="heading" aria-level={3} className={zenSectionEyebrowClass}>Infusions</span>
                    <span className="text-[0.9rem] text-zen-muted">{session.infusions?.length ?? 0} total</span>
                </div>

                {areInfusionsExpanded && (session.infusions?.length ?? 0) > 0 ? (
                    <div id="session-summary-infusion-details" className={cn(zenSummaryListClass, 'pointer-events-none relative z-10')}>
                        {session.infusions.map((infusion) => (
                            <button
                                key={infusion.infusionId}
                                type="button"
                                onClick={() => onInfusionPress?.(infusion.infusionId, infusion.note ?? '')}
                                disabled={!onInfusionPress}
                                className={cn(zenSummaryListItemClass, onInfusionPress ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none cursor-default')}
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
                ) : areInfusionsExpanded ? (
                    <p id="session-summary-infusion-details" className="pointer-events-none relative z-10 m-0 text-zen-muted">No infusions were recorded for this session.</p>
                ) : null}
            </section>

            {footer ? <section className={zenActionRowClass}>{footer}</section> : null}
        </div>
    );
};

export default SessionSummaryView;
