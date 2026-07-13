import { BrewingSession } from '../entities/BrewingSession.entity';
import { Tea } from '../entities/Tea.entity';
import {
  getTeaSuggestions,
  teaMatchesFilters,
  type TeaFilters,
  type TeaTextAttribute,
} from './teaSearch';

export type HistoryTeaFilterDraft = Record<TeaTextAttribute, string> & { year: string };
export type HistoryQuery = { teaIds?: string[] };

export const EMPTY_HISTORY_TEA_FILTERS: HistoryTeaFilterDraft = {
  name: '', brand: '', type: '', subtype: '', region: '', subregion: '', season: '', year: '',
};

const toTeaFilters = (filters: HistoryTeaFilterDraft): TeaFilters => ({
  name: filters.name,
  brand: filters.brand,
  type: filters.type,
  subtype: filters.subtype,
  region: filters.region,
  subregion: filters.subregion,
  season: filters.season,
  year: filters.year.trim() ? Number(filters.year) : null,
});

const hasActiveHistoryFilters = (searchText: string, filters: HistoryTeaFilterDraft): boolean => (
  Boolean(searchText.trim()) || Object.values(filters).some((value) => value.trim())
);

export const createHistoryQuery = (
  knownTeas: Tea[],
  searchText: string,
  filters: HistoryTeaFilterDraft,
): HistoryQuery => {
  if (!hasActiveHistoryFilters(searchText, filters)) {
    return {};
  }

  const matchedSearchTeas = searchText.trim()
    ? getTeaSuggestions(knownTeas, searchText, knownTeas.length)
    : knownTeas;

  return {
    teaIds: matchedSearchTeas
      .filter((tea) => teaMatchesFilters(tea, toTeaFilters(filters)))
      .map((tea) => tea.teaId),
  };
};

export const getHistoryQueryKey = (query: HistoryQuery): string => (
  query.teaIds
    ? `teas:${[...query.teaIds].sort().join(',')}`
    : 'all'
);

export const filterHistorySessions = (
  sessions: BrewingSession[],
  knownTeas: Tea[],
  searchText: string,
  filters: HistoryTeaFilterDraft,
): BrewingSession[] => {
  const query = createHistoryQuery(knownTeas, searchText, filters);
  if (!query.teaIds) {
    return sessions;
  }

  const teaIds = new Set(query.teaIds);
  return sessions.filter((session) => Boolean(session.teaId && teaIds.has(session.teaId)));
};
