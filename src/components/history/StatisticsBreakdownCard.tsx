import React, { useId, useState } from 'react';
import { cn } from '../../styles/zen';
import type { HistoryStatisticsResult } from '../../utils/HistoryStatistics';

type BreakdownTab = 'types' | 'teas' | 'brands';

const TABS: Array<{ key: BreakdownTab; label: string }> = [
    { key: 'types', label: 'Tea types' },
    { key: 'teas', label: 'Tea names' },
    { key: 'brands', label: 'Brands' },
];

type StatisticsBreakdownCardProps = {
    rankings: HistoryStatisticsResult['rankings'];
};

const StatisticsBreakdownCard: React.FC<StatisticsBreakdownCardProps> = ({ rankings }) => {
    const [activeTab, setActiveTab] = useState<BreakdownTab>('types');
    const [expanded, setExpanded] = useState(false);
    const id = useId();
    const panelId = `${id}-panel`;
    const groups = rankings[activeTab];
    const visibleGroups = expanded ? groups : groups.slice(0, 5);
    const largestCount = groups[0]?.sessionCount ?? 0;
    const activeDefinition = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];

    const selectTab = (tab: BreakdownTab) => {
        setActiveTab(tab);
        setExpanded(false);
    };

    return (
        <section className="overflow-hidden rounded-[18px] border border-zen-border bg-white/55">
            <div role="tablist" aria-label="Statistics breakdown" className="grid grid-cols-3 bg-zen-accent-soft">
                {TABS.map((tab) => {
                    const selected = activeTab === tab.key;
                    const tabId = `${id}-${tab.key}-tab`;

                    return (
                        <button
                            key={tab.key}
                            id={tabId}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            aria-controls={panelId}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => selectTab(tab.key)}
                            className={cn(
                                'min-h-11 px-2 text-sm transition',
                                selected
                                    ? 'rounded-t-2xl bg-[#fffdf8] font-medium text-zen-text'
                                    : 'text-zen-muted',
                            )}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div
                id={panelId}
                role="tabpanel"
                aria-labelledby={`${id}-${activeTab}-tab`}
                className="grid gap-3 p-4"
            >
                {visibleGroups.length === 0 ? (
                    <p className="m-0 text-sm text-zen-muted">No {activeDefinition.label} to display.</p>
                ) : visibleGroups.map((group) => (
                    <div key={group.key} data-testid="statistics-ranking-row" className="grid gap-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="font-medium text-zen-text">{group.label}</span>
                            <span className="shrink-0 text-zen-muted">
                                {group.sessionCount} {group.sessionCount === 1 ? 'session' : 'sessions'}
                            </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zen-accent-soft" aria-hidden="true">
                            <div
                                data-testid={`statistics-ranking-bar-${group.key}`}
                                className="h-full rounded-full bg-[#718574]"
                                style={{
                                    width: `${largestCount ? (group.sessionCount / largestCount) * 100 : 0}%`,
                                }}
                            />
                        </div>
                    </div>
                ))}

                {groups.length > 5 && (
                    <button
                        type="button"
                        onClick={() => setExpanded((value) => !value)}
                        className="min-h-11 text-sm text-zen-muted underline"
                    >
                        {expanded ? 'Show less' : 'Show all'}
                    </button>
                )}
            </div>
        </section>
    );
};

export default StatisticsBreakdownCard;
