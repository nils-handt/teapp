import { describe, expect, it } from 'vitest';
import { Tea } from '../entities/Tea.entity';
import {
    filterSessionsByTeaFilters,
    formatTeaLabel,
    getTeaAttributeSuggestions,
    getTeaSuggestions,
} from './teaSearch';
import { BrewingSession } from '../entities/BrewingSession.entity';

const createTea = (overrides: Partial<Tea>): Tea => Object.assign(new Tea(), {
    teaId: crypto.randomUUID(),
    name: '',
    brand: null,
    type: null,
    subtype: null,
    region: null,
    subregion: null,
    year: null,
    season: null,
    sessions: [],
}, overrides);

const createSession = (tea: Tea | null): BrewingSession => Object.assign(new BrewingSession(), {
    sessionId: crypto.randomUUID(),
    teaId: tea?.teaId ?? null,
    tea,
    teaName: '',
    startTime: '2026-03-14T10:00:00.000Z',
    endTime: '',
    vesselWeight: 0,
    lidWeight: 0,
    dryTeaLeavesWeight: 0,
    currentWasteWater: 0,
    notes: '',
    status: 'completed',
    waterTemperature: 0,
    brewingVesselId: null,
    brewingVessel: null,
    infusions: [],
});

describe('teaSearch', () => {
    it('formats tea labels as YEAR NAME BRAND TYPE while omitting empty fields', () => {
        expect(formatTeaLabel(createTea({
            name: 'Longjing',
            brand: 'Lipton',
            type: 'Green Tea',
            year: 2020,
        }))).toBe('2020 Longjing Lipton Green Tea');

        expect(formatTeaLabel(createTea({
            name: 'Rougui',
            brand: '   ',
            type: null,
            year: null,
        }))).toBe('Rougui');
    });

    it('matches every query token across any tea property including numeric year', () => {
        const matchingTea = createTea({
            name: 'Longjing',
            brand: 'Lipton',
            type: 'Green Tea',
            year: 2020,
        });
        const otherTea = createTea({
            name: 'Longjing',
            brand: 'Local Farm',
            type: 'Green Tea',
            year: 2021,
        });

        expect(getTeaSuggestions([matchingTea, otherTea], '2020 lipton longjing')).toEqual([matchingTea]);
    });

    it('returns attribute suggestions from previously used tea strings only', () => {
        const teas = [
            createTea({ name: 'Rougui', type: 'Yancha', year: 2020 }),
            createTea({ name: 'Mi Lan Xiang', type: 'Dancong', year: 2021 }),
            createTea({ name: 'Other Rougui', type: 'yancha', year: 2020 }),
        ];

        expect(getTeaAttributeSuggestions(teas, 'type', 'yan')).toEqual(['Yancha']);
        expect(getTeaAttributeSuggestions(teas, 'year', '20')).toEqual(['2020', '2021']);
    });

    it('filters sessions by multiple tea attributes with AND semantics', () => {
        const matchingTea = createTea({ name: 'Longjing', brand: 'Lipton', year: 2020, region: 'Zhejiang' });
        const wrongYearTea = createTea({ name: 'Longjing', brand: 'Lipton', year: 2021, region: 'Zhejiang' });
        const wrongBrandTea = createTea({ name: 'Longjing', brand: 'Other', year: 2020, region: 'Zhejiang' });

        const matchingSession = createSession(matchingTea);
        const sessions = [
            matchingSession,
            createSession(wrongYearTea),
            createSession(wrongBrandTea),
            createSession(null),
        ];

        expect(filterSessionsByTeaFilters(sessions, {
            brand: 'lipton',
            year: 2020,
        })).toEqual([matchingSession]);
    });
});
