import { describe, expect, it } from 'vitest';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Infusion } from '../entities/Infusion.entity';
import { Tea } from '../entities/Tea.entity';
import {
    calculateHistoryStatistics,
    formatStatisticLiquid,
    formatStatisticWeight,
    isStatisticsPeriod,
} from './HistoryStatistics';

const NOW = new Date('2026-07-11T12:00:00.000Z');

const createTea = (overrides: Partial<Tea> = {}): Tea => Object.assign(new Tea(), {
    teaId: 'tea-1', name: 'Gao Jia Shan', brand: 'Farmer Leaf', type: 'Oolong',
    subtype: null, region: 'Hunan', subregion: 'Anhua', year: 2015, season: null, sessions: [],
}, overrides);

const createInfusion = (waterWeight: number): Infusion => Object.assign(new Infusion(), {
    infusionId: crypto.randomUUID(), infusionNumber: 1, waterWeight,
    startTime: '2026-07-10T12:00:00.000Z', duration: 60, restDuration: 0,
    wetTeaLeavesWeight: 0, note: null, temperature: null, sessionId: 'session',
});

const createSession = (overrides: Partial<BrewingSession> = {}): BrewingSession => {
    const linkedTea = overrides.tea === undefined ? createTea() : overrides.tea;
    return Object.assign(new BrewingSession(), {
        sessionId: crypto.randomUUID(), teaId: linkedTea?.teaId ?? null, tea: linkedTea,
        teaName: linkedTea?.name ?? '', startTime: '2026-07-10T12:00:00.000Z', endTime: '',
        vesselWeight: 0, lidWeight: 0, dryTeaLeavesWeight: 4, currentWasteWater: 0,
        notes: '', status: 'completed', waterTemperature: 0, brewingVesselId: null,
        brewingVessel: null, infusions: [createInfusion(200)],
    }, overrides);
};

describe('HistoryStatistics', () => {
    it('recognizes only supported statistics periods', () => {
        expect(isStatisticsPeriod('total')).toBe(true);
        expect(isStatisticsPeriod('lastYear')).toBe(true);
        expect(isStatisticsPeriod('lastMonth')).toBe(true);
        expect(isStatisticsPeriod('lastWeek')).toBe(true);
        expect(isStatisticsPeriod('week')).toBe(false);
        expect(isStatisticsPeriod(null)).toBe(false);
    });

    it('counts only completed sessions inside the inclusive rolling boundary', () => {
        const boundary = createSession({
            sessionId: 'boundary', status: 'completed', startTime: '2026-07-04T12:00:00.000Z',
            dryTeaLeavesWeight: 5, infusions: [createInfusion(250)],
        });
        const tooOld = createSession({
            sessionId: 'old', status: 'completed', startTime: '2026-07-04T11:59:59.999Z',
        });
        const active = createSession({
            sessionId: 'active', status: 'active', startTime: '2026-07-10T12:00:00.000Z',
        });
        const result = calculateHistoryStatistics([boundary, tooOld, active], 'lastWeek', NOW);
        expect(result.sessionCount).toBe(1);
        expect(result.totalDryLeafWeight).toBe(5);
        expect(result.totalLiquidWeight).toBe(250);
    });

    it('keeps invalid dates only in Total and clamps invalid weights to zero', () => {
        const invalid = createSession({
            sessionId: 'invalid', status: 'completed', startTime: 'not-a-date',
            dryTeaLeavesWeight: Number.NaN,
            infusions: [createInfusion(-10), createInfusion(Number.POSITIVE_INFINITY)],
        });
        expect(calculateHistoryStatistics([invalid], 'total', NOW).sessionCount).toBe(1);
        expect(calculateHistoryStatistics([invalid], 'lastYear', NOW).sessionCount).toBe(0);
        expect(calculateHistoryStatistics([invalid], 'total', NOW).totalLiquidWeight).toBe(0);
    });

    it.each([
        ['lastMonth', '2026-06-11T12:00:00.000Z'],
        ['lastYear', '2025-07-11T12:00:00.000Z'],
    ] as const)('includes the exact %s lower boundary', (period, startTime) => {
        expect(calculateHistoryStatistics([createSession({ startTime })], period, NOW).sessionCount).toBe(1);
    });

    it('returns a fully zeroed result for empty input', () => {
        expect(calculateHistoryStatistics([], 'total', NOW)).toEqual({
            sessionCount: 0,
            totalDryLeafWeight: 0,
            totalLiquidWeight: 0,
            averages: { dryLeafWeight: 0, liquidWeight: 0, infusionCount: 0 },
            exploration: { teaCount: 0, typeCount: 0, regionCount: 0, subregionCount: 0 },
            rankings: { types: [], teas: [], brands: [] },
        });
    });

    it('groups metadata, averages eligible sessions, and excludes unknowns from exploration', () => {
        const linkedTea = createTea();
        const first = createSession({
            sessionId: 'one', tea: linkedTea, teaId: linkedTea.teaId,
            dryTeaLeavesWeight: 4, infusions: [createInfusion(150), createInfusion(250)],
        });
        const second = createSession({
            sessionId: 'two', tea: linkedTea, teaId: linkedTea.teaId,
            dryTeaLeavesWeight: 4, infusions: [createInfusion(200), createInfusion(200)],
        });
        const unknown = createSession({
            sessionId: 'unknown', tea: null, teaId: null, teaName: '',
            dryTeaLeavesWeight: 4, infusions: [createInfusion(200), createInfusion(200)],
        });

        const result = calculateHistoryStatistics([first, second, unknown], 'total', NOW);
        expect(result.rankings.types).toEqual([
            { key: 'oolong', label: 'Oolong', sessionCount: 2 },
            { key: 'unknown', label: 'Unknown', sessionCount: 1 },
        ]);
        expect(result.rankings.teas[0]).toMatchObject({ key: 'tea-1', sessionCount: 2 });
        expect(result.rankings.brands[0]).toMatchObject({ label: 'Farmer Leaf', sessionCount: 2 });
        expect(result.averages).toEqual({ dryLeafWeight: 4, liquidWeight: 400, infusionCount: 2 });
        expect(result.exploration).toEqual({ teaCount: 1, typeCount: 1, regionCount: 1, subregionCount: 1 });
    });

    it('keeps Tea entities distinct and uses deterministic label tie ordering', () => {
        const alpha = createTea({ teaId: 'tea-a', name: 'Alpha', brand: 'Zulu', type: 'White' });
        const beta = createTea({ teaId: 'tea-b', name: 'Beta', brand: 'alpha', type: 'Black' });
        const result = calculateHistoryStatistics([
            createSession({ tea: beta, teaId: beta.teaId }),
            createSession({ tea: alpha, teaId: alpha.teaId }),
        ], 'total', NOW);
        expect(result.rankings.teas.map((group) => group.key)).toEqual(['tea-a', 'tea-b']);
        expect(result.rankings.brands.map((group) => group.label)).toEqual(['alpha', 'Zulu']);
    });

    it('formats weights and liquid with one-decimal rounding and unit conversion', () => {
        expect(formatStatisticWeight(12)).toBe('12 g');
        expect(formatStatisticWeight(12.25)).toBe('12.3 g');
        expect(formatStatisticLiquid(950)).toBe('950 ml');
        expect(formatStatisticLiquid(1250)).toBe('1.3 L');
    });
});
