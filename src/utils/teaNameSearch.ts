import { matchSorter, rankings } from 'match-sorter';
import { BrewingSession } from '../entities/BrewingSession.entity';

const RECENT_TEA_NAME_LIMIT = 8;

export const normalizeTeaName = (value: string): string =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, ' ')
        .trim()
        .replace(/\s+/g, ' ');

const stableBaseSort = (a: { index: number }, b: { index: number }) => a.index - b.index;

const rankTeaNamesByTerm = (teaNames: string[], term: string) =>
    matchSorter(teaNames, term, {
        keys: [(teaName) => normalizeTeaName(teaName)],
        threshold: rankings.CONTAINS,
        baseSort: stableBaseSort,
    });

export const getTeaNameSuggestions = (teaNames: string[], query: string, limit = RECENT_TEA_NAME_LIMIT): string[] => {
    const uniqueTeaNames = teaNames
        .map((teaName) => teaName.trim())
        .filter(Boolean)
        .filter((teaName, index, values) => values.findIndex((value) => value.toLowerCase() === teaName.toLowerCase()) === index);

    const normalizedQuery = normalizeTeaName(query);
    if (!normalizedQuery) {
        return uniqueTeaNames.slice(0, limit);
    }

    const terms = normalizedQuery.split(' ').filter(Boolean);
    const matchedTeaNames = terms.reduce((results, term) => rankTeaNamesByTerm(results, term), uniqueTeaNames);

    return matchedTeaNames.slice(0, limit);
};

export const filterSessionsByTeaName = (
    sessions: BrewingSession[],
    teaNames: string[],
    query: string,
): BrewingSession[] => {
    const normalizedQuery = normalizeTeaName(query);
    if (!normalizedQuery) {
        return sessions;
    }

    const matchedTeaNames = new Set(getTeaNameSuggestions(teaNames, normalizedQuery, teaNames.length).map((teaName) => teaName.toLowerCase()));
    return sessions.filter((session) => matchedTeaNames.has(session.teaName?.trim().toLowerCase()));
};
