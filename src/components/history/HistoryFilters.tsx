import React, { useId, useMemo } from 'react';
import { IonIcon, IonSearchbar } from '@ionic/react';
import { closeOutline, optionsOutline } from 'ionicons/icons';
import { useShallow } from 'zustand/react/shallow';
import { Tea } from '../../entities/Tea.entity';
import { useHistoryFiltersStore } from '../../stores/useHistoryFiltersStore';
import { cn, zenHistoryHeaderButtonClass, zenListSearchClass } from '../../styles/zen';
import { formatTeaLabel, getTeaAttributeSuggestions, getTeaSuggestions } from '../../utils/teaSearch';
import type { HistoryTeaFilterDraft } from '../../utils/historyFilters';
import SuggestionList from '../ui/SuggestionList';
import SuggestedInput from '../ui/SuggestedInput';

type HistoryFiltersProps = {
  knownTeas: Tea[];
  areFiltersExpanded: boolean;
  onToggleFilters: () => void;
  searchLeadingAction?: React.ReactNode;
  searchAction?: React.ReactNode;
};

const FILTER_FIELDS: Array<{ key: Exclude<keyof HistoryTeaFilterDraft, 'year'>; label: string }> = [
  { key: 'name', label: 'Name' }, { key: 'brand', label: 'Brand' },
  { key: 'type', label: 'Type' }, { key: 'subtype', label: 'Subtype' },
  { key: 'region', label: 'Region' }, { key: 'subregion', label: 'Subregion' },
  { key: 'season', label: 'Season' },
];

const HistoryFilters: React.FC<HistoryFiltersProps> = ({
  knownTeas, areFiltersExpanded, onToggleFilters, searchLeadingAction, searchAction,
}) => {
  const filterFieldsId = useId();
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
    <div className="zen-history-filter-deck">
      <div className="flex items-center gap-1.5" data-testid="history-filter-row">
        {searchLeadingAction}
        <IonSearchbar
          className={cn(zenListSearchClass, 'm-0 min-w-0 flex-1')}
          value={searchText}
          onIonInput={(event) => setSearchText(event.detail.value || '')}
          placeholder="Search teas"
          debounce={500}
        />
        <button
          type="button"
          aria-label={filterToggleLabel}
          aria-expanded={areFiltersExpanded}
          aria-controls={filterFieldsId}
          onClick={onToggleFilters}
          className={cn(
            zenHistoryHeaderButtonClass,
            'relative',
            (areFiltersExpanded || activeFilterCount > 0) && 'zen-history-header-button--active',
          )}
        >
          <IonIcon icon={optionsOutline} aria-hidden="true" />
          {activeFilterCount > 0 && (
            <span
              aria-hidden="true"
              data-testid="history-active-filter-count"
              className="absolute top-0.5 right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#566b5b] px-1 text-[0.65rem] leading-none font-medium text-white"
            >
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button
            type="button"
            aria-label="Clear filters"
            onClick={clearFilters}
            className={cn(zenHistoryHeaderButtonClass, 'text-zen-muted')}
          >
            <IonIcon icon={closeOutline} aria-hidden="true" />
          </button>
        )}
        {searchAction}
      </div>
      {!areFiltersExpanded && suggestions.length > 0 && (
        <div className="mt-2">
          <SuggestionList items={suggestions} onSelect={setSearchText} />
        </div>
      )}
      {areFiltersExpanded && (
        <div
          id={filterFieldsId}
          className="zen-history-filter-fields mt-3 grid gap-2 border-t border-zen-border pt-3 sm:grid-cols-2"
        >
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
      )}
    </div>
  );
};

export default HistoryFilters;
