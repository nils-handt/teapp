import { BrewingSession } from '../entities/BrewingSession.entity';
import { Tea } from '../entities/Tea.entity';
import {
  filterSessionsByTeaFilters,
  getTeaSuggestions,
  type TeaFilters,
  type TeaTextAttribute,
} from './teaSearch';

export type HistoryTeaFilterDraft = Record<TeaTextAttribute, string> & { year: string };

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

export const filterHistorySessions = (
  sessions: BrewingSession[],
  knownTeas: Tea[],
  searchText: string,
  filters: HistoryTeaFilterDraft,
): BrewingSession[] => {
  let searchedSessions = sessions;
  if (searchText.trim()) {
    const matchedTeaIds = new Set(
      getTeaSuggestions(knownTeas, searchText, knownTeas.length).map((candidate) => candidate.teaId),
    );
    searchedSessions = sessions.filter((session) => Boolean(session.teaId && matchedTeaIds.has(session.teaId)));
  }
  return filterSessionsByTeaFilters(searchedSessions, toTeaFilters(filters));
};
