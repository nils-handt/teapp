import React, { useMemo } from 'react';
import { IonIcon, IonSearchbar, IonToolbar } from '@ionic/react';
import { chevronDown } from 'ionicons/icons';
import { useShallow } from 'zustand/react/shallow';
import { Tea } from '../../entities/Tea.entity';
import { useHistoryFiltersStore } from '../../stores/useHistoryFiltersStore';
import { cn, zenListSearchClass, zenListToolbarClass } from '../../styles/zen';
import { formatTeaLabel, getTeaAttributeSuggestions, getTeaSuggestions } from '../../utils/teaSearch';
import type { HistoryTeaFilterDraft } from '../../utils/historyFilters';
import SuggestionList from '../ui/SuggestionList';
import SuggestedInput from '../ui/SuggestedInput';

type HistoryFiltersProps = {
  knownTeas: Tea[];
  areFiltersExpanded: boolean;
  onToggleFilters: () => void;
  searchAction?: React.ReactNode;
};

const FILTER_FIELDS: Array<{ key: Exclude<keyof HistoryTeaFilterDraft, 'year'>; label: string }> = [
  { key: 'name', label: 'Name' }, { key: 'brand', label: 'Brand' },
  { key: 'type', label: 'Type' }, { key: 'subtype', label: 'Subtype' },
  { key: 'region', label: 'Region' }, { key: 'subregion', label: 'Subregion' },
  { key: 'season', label: 'Season' },
];

const HistoryFilters: React.FC<HistoryFiltersProps> = ({
  knownTeas, areFiltersExpanded, onToggleFilters, searchAction,
}) => {
  const { searchText, filters, setSearchText, setFilter, clearFilters } = useHistoryFiltersStore(
    useShallow((state) => ({
      searchText: state.searchText,
      filters: state.filters,
      setSearchText: state.setSearchText,
      setFilter: state.setFilter,
      clearFilters: state.clearFilters,
    })),
  );
  const suggestions = useMemo(
    () => searchText.trim() ? getTeaSuggestions(knownTeas, searchText).map(formatTeaLabel) : [],
    [knownTeas, searchText],
  );
  const activeFilterCount = Object.values(filters).filter((value) => value.trim()).length;
  const filterToggleLabel = `${areFiltersExpanded ? 'Hide' : 'Show'} history filters${
    activeFilterCount ? ` (${activeFilterCount} active)` : ''
  }`;

  return (
    <>
      <IonToolbar className={zenListToolbarClass}>
        <div className="flex items-center gap-2 pr-4">
          <IonSearchbar
            className={cn(zenListSearchClass, 'min-w-0 flex-1')}
            value={searchText}
            onIonInput={(event) => setSearchText(event.detail.value || '')}
            placeholder="Search teas"
            debounce={500}
          />
          {searchAction}
        </div>
        <div className="flex items-center gap-3 px-4 pb-2">
          <button type="button" aria-label={filterToggleLabel} aria-expanded={areFiltersExpanded}
            onClick={onToggleFilters}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-zen-muted">
            <span>Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</span>
            <IonIcon icon={chevronDown} className={cn('text-base transition-transform', areFiltersExpanded && 'rotate-180')} />
          </button>
          {activeFilterCount > 0 && (
            <button type="button" onClick={clearFilters}
              className="min-h-11 shrink-0 px-2 text-[0.9rem] text-zen-muted underline">
              Clear filters
            </button>
          )}
        </div>
        {!areFiltersExpanded && suggestions.length > 0 && (
          <div className="px-4 pb-3">
            <SuggestionList items={suggestions} onSelect={setSearchText} />
          </div>
        )}
      </IonToolbar>
      {areFiltersExpanded && (
        <IonToolbar className={zenListToolbarClass}>
          <div className="grid gap-2 px-4 py-3 sm:grid-cols-2">
            {FILTER_FIELDS.map((field) => (
              <label key={field.key} className="grid gap-1 text-[0.82rem] text-zen-muted">
                {field.label}
                <SuggestedInput ariaLabel={`Filter ${field.label}`} value={filters[field.key]}
                  suggestions={getTeaAttributeSuggestions(knownTeas, field.key, filters[field.key], 8)}
                  onChange={(value) => setFilter(field.key, value)} />
              </label>
            ))}
            <label className="grid gap-1 text-[0.82rem] text-zen-muted">
              Year
              <SuggestedInput ariaLabel="Filter Year" type="number" inputMode="numeric"
                value={filters.year} suggestions={getTeaAttributeSuggestions(knownTeas, 'year', filters.year, 24)}
                onChange={(value) => setFilter('year', value)} />
            </label>
          </div>
        </IonToolbar>
      )}
    </>
  );
};

export default HistoryFilters;
