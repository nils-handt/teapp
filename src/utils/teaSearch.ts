import { matchSorter, rankings } from 'match-sorter';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Tea } from '../entities/Tea.entity';

export type TeaTextAttribute = 'name' | 'brand' | 'type' | 'subtype' | 'region' | 'subregion' | 'season';
export type TeaAttribute = TeaTextAttribute | 'year';

export type TeaFilters = Partial<Record<TeaTextAttribute, string> & { year: number | null }>;

const RECENT_TEA_LIMIT = 8;

const stableBaseSort = (a: { index: number }, b: { index: number }) => a.index - b.index;

export const normalizeTeaValue = (value: string): string =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, ' ')
        .trim()
        .replace(/\s+/g, ' ');

const teaValues = (tea: Tea): string[] => [
    tea.name,
    tea.brand,
    tea.type,
    tea.subtype,
    tea.region,
    tea.subregion,
    tea.year === null || tea.year === undefined ? null : String(tea.year),
    tea.season,
].map((value) => value?.trim() ?? '').filter(Boolean);

export const formatTeaLabel = (tea: Tea | null | undefined): string => {
    if (!tea) {
        return '';
    }

    return [
        tea.year === null || tea.year === undefined ? '' : String(tea.year),
        tea.name,
        tea.brand,
        tea.type,
    ]
        .map((part) => part?.trim() ?? '')
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ');
};

const rankTeasByTerm = (teas: Tea[], term: string): Tea[] =>
    matchSorter(teas, term, {
        keys: [(tea) => teaValues(tea).map(normalizeTeaValue).join(' ')],
        threshold: rankings.CONTAINS,
        baseSort: stableBaseSort,
    });

export const getTeaSuggestions = (teas: Tea[], query: string, limit = RECENT_TEA_LIMIT): Tea[] => {
    const normalizedQuery = normalizeTeaValue(query);
    if (!normalizedQuery) {
        return teas.slice(0, limit);
    }

    const terms = normalizedQuery.split(' ').filter(Boolean);
    return terms.reduce((results, term) => rankTeasByTerm(results, term), teas).slice(0, limit);
};

const getAttributeValue = (tea: Tea, attribute: TeaAttribute): string => {
    if (attribute === 'year') {
        return tea.year === null || tea.year === undefined ? '' : String(tea.year);
    }

    return tea[attribute]?.trim() ?? '';
};

export const getTeaAttributeSuggestions = (
    teas: Tea[],
    attribute: TeaAttribute,
    query: string,
    limit = RECENT_TEA_LIMIT,
): string[] => {
    const values = teas
        .map((tea) => getAttributeValue(tea, attribute))
        .filter(Boolean)
        .filter((value, index, allValues) => (
            allValues.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index
        ));

    const normalizedQuery = normalizeTeaValue(query);
    if (!normalizedQuery) {
        return values.slice(0, limit);
    }

    return matchSorter(values, normalizedQuery, {
        keys: [(value) => normalizeTeaValue(value)],
        threshold: rankings.CONTAINS,
        baseSort: stableBaseSort,
    }).slice(0, limit);
};

export const teaMatchesFilters = (tea: Tea | null | undefined, filters: TeaFilters): boolean => {
    const entries = Object.entries(filters).filter(([, value]) => (
        value !== null && value !== undefined && String(value).trim() !== ''
    ));

    if (entries.length === 0) {
        return true;
    }

    if (!tea) {
        return false;
    }

    return entries.every(([attribute, value]) => {
        if (attribute === 'year') {
            return tea.year === Number(value);
        }

        return normalizeTeaValue(getAttributeValue(tea, attribute as TeaTextAttribute))
            .includes(normalizeTeaValue(String(value)));
    });
};

export const filterSessionsByTeaFilters = (sessions: BrewingSession[], filters: TeaFilters): BrewingSession[] => {
    return sessions.filter((session) => teaMatchesFilters(session.tea, filters));
};
