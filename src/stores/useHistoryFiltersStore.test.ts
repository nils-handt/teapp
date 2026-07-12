import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_HISTORY_TEA_FILTERS } from '../utils/historyFilters';
import { historyFiltersStore, initialHistoryFiltersState } from './useHistoryFiltersStore';

describe('useHistoryFiltersStore', () => {
  beforeEach(() => historyFiltersStore.setState(initialHistoryFiltersState));

  it('updates shared search and individual Tea fields', () => {
    historyFiltersStore.getState().setSearchText('sencha');
    historyFiltersStore.getState().setFilter('region', 'Uji');
    expect(historyFiltersStore.getState()).toMatchObject({
      searchText: 'sencha',
      filters: { ...EMPTY_HISTORY_TEA_FILTERS, region: 'Uji' },
    });
  });

  it('clears every shared filter value', () => {
    historyFiltersStore.getState().setSearchText('sencha');
    historyFiltersStore.getState().setFilter('year', '2024');
    historyFiltersStore.getState().clearFilters();
    expect(historyFiltersStore.getState()).toMatchObject({
      searchText: '',
      filters: EMPTY_HISTORY_TEA_FILTERS,
    });
  });
});
