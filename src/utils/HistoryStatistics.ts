import { BrewingSession } from '../entities/BrewingSession.entity';
import { formatTeaLabel, normalizeTeaValue } from './teaSearch';

export type StatisticsPeriod = 'total' | 'lastYear' | 'lastMonth' | 'lastWeek';

export const STATISTICS_PERIODS: StatisticsPeriod[] = ['total', 'lastYear', 'lastMonth', 'lastWeek'];

export const isStatisticsPeriod = (value: unknown): value is StatisticsPeriod =>
    typeof value === 'string' && STATISTICS_PERIODS.includes(value as StatisticsPeriod);

export type HistoryStatisticGroup = {
    key: string;
    label: string;
    sessionCount: number;
};

export type HistoryStatisticsResult = {
    sessionCount: number;
    totalDryLeafWeight: number;
    totalLiquidWeight: number;
    averages: { dryLeafWeight: number; liquidWeight: number; infusionCount: number };
    exploration: { teaCount: number; typeCount: number; regionCount: number; subregionCount: number };
    rankings: { types: HistoryStatisticGroup[]; teas: HistoryStatisticGroup[]; brands: HistoryStatisticGroup[] };
};

const PERIOD_MS: Record<Exclude<StatisticsPeriod, 'total'>, number> = {
    lastYear: 365 * 24 * 60 * 60 * 1000,
    lastMonth: 30 * 24 * 60 * 60 * 1000,
    lastWeek: 7 * 24 * 60 * 60 * 1000,
};

const safeWeight = (value: number | null | undefined): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const roundOne = (value: number): number => Number(value.toFixed(1));
const formatOne = (value: number): string => roundOne(value).toString();

const sortGroups = (groups: HistoryStatisticGroup[]): HistoryStatisticGroup[] =>
    groups.sort((left, right) => right.sessionCount - left.sessionCount
        || left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));

const increment = (map: Map<string, HistoryStatisticGroup>, key: string, label: string): void => {
    const existing = map.get(key);
    if (existing) {
        existing.sessionCount += 1;
    } else {
        map.set(key, { key, label, sessionCount: 1 });
    }
};

const normalizedGroup = (value: string | null | undefined): { key: string; label: string } => {
    const label = value?.trim();
    return label ? { key: label.toLowerCase(), label } : { key: 'unknown', label: 'Unknown' };
};

const eligibleSessions = (
    sessions: BrewingSession[],
    period: StatisticsPeriod,
    now: Date,
): BrewingSession[] => sessions.filter((session) => {
    if (session.status !== 'completed') {
        return false;
    }
    if (period === 'total') {
        return true;
    }

    const timestamp = new Date(session.startTime).getTime();
    return Number.isFinite(timestamp)
        && timestamp >= now.getTime() - PERIOD_MS[period]
        && timestamp <= now.getTime();
});

export const calculateHistoryStatistics = (
    sessions: BrewingSession[],
    period: StatisticsPeriod,
    now = new Date(),
): HistoryStatisticsResult => {
    const eligible = eligibleSessions(sessions, period, now);
    const typeGroups = new Map<string, HistoryStatisticGroup>();
    const teaGroups = new Map<string, HistoryStatisticGroup>();
    const brandGroups = new Map<string, HistoryStatisticGroup>();
    const teaIds = new Set<string>();
    const types = new Set<string>();
    const regions = new Set<string>();
    const subregions = new Set<string>();

    let totalDryLeafWeight = 0;
    let totalLiquidWeight = 0;
    let totalInfusions = 0;

    eligible.forEach((session) => {
        totalDryLeafWeight += safeWeight(session.dryTeaLeavesWeight);
        const infusions = session.infusions ?? [];
        totalInfusions += infusions.length;
        totalLiquidWeight += infusions.reduce(
            (sum, infusion) => sum + safeWeight(infusion.waterWeight),
            0,
        );

        const type = normalizedGroup(session.tea?.type);
        const brand = normalizedGroup(session.tea?.brand);
        increment(typeGroups, type.key, type.label);
        increment(brandGroups, brand.key, brand.label);

        if (session.tea) {
            const teaId = session.tea.teaId || session.teaId;
            if (teaId) {
                increment(teaGroups, teaId, formatTeaLabel(session.tea));
                teaIds.add(teaId);
            }

            const normalizedType = normalizeTeaValue(session.tea.type ?? '');
            const normalizedRegion = normalizeTeaValue(session.tea.region ?? '');
            const normalizedSubregion = normalizeTeaValue(session.tea.subregion ?? '');
            if (normalizedType) types.add(normalizedType);
            if (normalizedRegion) regions.add(normalizedRegion);
            if (normalizedSubregion) subregions.add(normalizedSubregion);
        }
    });

    const sessionCount = eligible.length;
    return {
        sessionCount,
        totalDryLeafWeight: roundOne(totalDryLeafWeight),
        totalLiquidWeight: roundOne(totalLiquidWeight),
        averages: {
            dryLeafWeight: sessionCount ? roundOne(totalDryLeafWeight / sessionCount) : 0,
            liquidWeight: sessionCount ? roundOne(totalLiquidWeight / sessionCount) : 0,
            infusionCount: sessionCount ? roundOne(totalInfusions / sessionCount) : 0,
        },
        exploration: {
            teaCount: teaIds.size,
            typeCount: types.size,
            regionCount: regions.size,
            subregionCount: subregions.size,
        },
        rankings: {
            types: sortGroups([...typeGroups.values()]),
            teas: sortGroups([...teaGroups.values()]),
            brands: sortGroups([...brandGroups.values()]),
        },
    };
};

export const formatStatisticWeight = (grams: number): string => `${formatOne(grams)} g`;

export const formatStatisticLiquid = (grams: number): string => grams < 1000
    ? `${formatOne(grams)} ml`
    : `${formatOne(grams / 1000)} L`;
