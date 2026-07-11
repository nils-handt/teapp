import { useStore as useZustandStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import {
  EMPTY_HISTORY_TEA_FILTERS,
  type HistoryTeaFilterDraft,
} from '../utils/historyFilters';

type HistoryFiltersState = {
  searchText: string;
  filters: HistoryTeaFilterDraft;
};

type HistoryFiltersActions = {
  setSearchText: (value: string) => void;
  setFilter: (key: keyof HistoryTeaFilterDraft, value: string) => void;
  clearFilters: () => void;
};

export type HistoryFiltersStore = HistoryFiltersState & HistoryFiltersActions;

export const initialHistoryFiltersState: HistoryFiltersState = {
  searchText: '',
  filters: { ...EMPTY_HISTORY_TEA_FILTERS },
};

export const historyFiltersStore = createStore<HistoryFiltersStore>()((set) => ({
  ...initialHistoryFiltersState,
  setSearchText: (searchText) => set({ searchText }),
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  clearFilters: () => set({ searchText: '', filters: { ...EMPTY_HISTORY_TEA_FILTERS } }),
}));

export const useHistoryFiltersStore = <T>(selector: (state: HistoryFiltersStore) => T): T =>
  useZustandStore(historyFiltersStore, selector);
