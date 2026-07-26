import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { IonIcon, IonSearchbar } from '@ionic/react';
import { closeOutline, optionsOutline } from 'ionicons/icons';
import { useShallow } from 'zustand/react/shallow';
import { Tea } from '../../entities/Tea.entity';
import { useHistoryFiltersStore } from '../../stores/useHistoryFiltersStore';
import { cn, zenHistoryHeaderButtonClass, zenListSearchClass } from '../../styles/zen';
import { formatTeaLabel, getTeaAttributeSuggestions, getTeaSuggestions } from '../../utils/teaSearch';
import type { HistoryTeaFilterDraft } from '../../utils/historyFilters';
import SuggestionDropdown from '../ui/SuggestionDropdown';
import SuggestedInput from '../ui/SuggestedInput';

type HistoryFiltersProps = {
  knownTeas: Tea[];
  areFiltersExpanded: boolean;
  onToggleFilters: () => void;
  searchLeadingAction?: React.ReactNode;
  searchAction?: React.ReactNode;
};

type SearchKeyEvent = {
  key: string;
  isComposing: boolean;
  preventDefault: () => void;
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
  const searchListId = useId();
  const filterFieldsRef = useRef<HTMLDivElement>(null);
  const searchbarRef = useRef<HTMLIonSearchbarElement>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isSearchSuggestionsOpen, setIsSearchSuggestionsOpen] = useState(false);
  const [activeSearchSuggestionIndex, setActiveSearchSuggestionIndex] = useState<number | null>(null);
  const searchInteractionStateRef = useRef({
    activeIndex: activeSearchSuggestionIndex,
    areFiltersExpanded,
    isOpen: isSearchSuggestionsOpen,
    suggestions: [] as string[],
  });
  const searchAriaStateRef = useRef({
    activeIndex: activeSearchSuggestionIndex,
    isOpen: isSearchSuggestionsOpen,
    suggestionsLength: 0,
  });
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
  searchAriaStateRef.current = {
    activeIndex: activeSearchSuggestionIndex,
    isOpen: isSearchSuggestionsOpen,
    suggestionsLength: suggestions.length,
  };
  searchInteractionStateRef.current = {
    activeIndex: activeSearchSuggestionIndex,
    areFiltersExpanded,
    isOpen: isSearchSuggestionsOpen,
    suggestions,
  };
  const activeFilterCount = Object.values(filters).filter((value) => value.trim()).length;
  const filterToggleLabel = `${areFiltersExpanded ? 'Hide' : 'Show'} history filters${
    activeFilterCount ? ` (${activeFilterCount} active)` : ''
  }`;

  const closeSearchSuggestions = useCallback(() => {
    setIsSearchSuggestionsOpen(false);
    setActiveSearchSuggestionIndex(null);
  }, []);

  const selectSearchSuggestion = useCallback((suggestion: string) => {
    setSearchText(suggestion);
    closeSearchSuggestions();
  }, [closeSearchSuggestions, setSearchText]);

  const handleSearchKey = useCallback((event: SearchKeyEvent, blurSearch: () => void) => {
    const {
      activeIndex,
      areFiltersExpanded: filtersExpanded,
      isOpen,
      suggestions: currentSuggestions,
    } = searchInteractionStateRef.current;

    if (event.isComposing) {
      return false;
    }

    if (event.key === 'ArrowDown' && currentSuggestions.length > 0) {
      event.preventDefault();
      setIsSearchSuggestionsOpen(true);
      setActiveSearchSuggestionIndex((currentIndex) => (
        currentIndex === null ? 0 : Math.min(currentIndex + 1, currentSuggestions.length - 1)
      ));
      return true;
    }

    if (event.key === 'ArrowUp' && currentSuggestions.length > 0) {
      event.preventDefault();
      setIsSearchSuggestionsOpen(true);
      setActiveSearchSuggestionIndex((currentIndex) => (
        currentIndex === null ? currentSuggestions.length - 1 : Math.max(currentIndex - 1, 0)
      ));
      return true;
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setIsSearchSuggestionsOpen(false);
      setActiveSearchSuggestionIndex(null);
      return true;
    }

    if (event.key !== 'Enter') {
      return false;
    }

    if (isOpen) {
      event.preventDefault();
      if (activeIndex !== null) {
        setSearchText(currentSuggestions[activeIndex]);
        setIsSearchSuggestionsOpen(false);
        setActiveSearchSuggestionIndex(null);
      }
      return true;
    }

    event.preventDefault();
    const firstFilter = filterFieldsRef.current?.querySelector<HTMLInputElement>('input');
    if (filtersExpanded && firstFilter) {
      firstFilter.focus();
      return true;
    }

    blurSearch();
    return true;
  }, [setSearchText]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLIonSearchbarElement>) => {
    handleSearchKey({
      key: event.key,
      isComposing: event.nativeEvent.isComposing,
      preventDefault: () => event.preventDefault(),
    }, () => {
      void event.currentTarget.getInputElement().then((input) => input.blur());
    });
  };

  const updateSearchInputAria = useCallback((input: HTMLInputElement) => {
    const { activeIndex, isOpen, suggestionsLength } = searchAriaStateRef.current;
    input.setAttribute('aria-expanded', String(suggestionsLength > 0 && isOpen));

    if (suggestionsLength > 0) {
      input.setAttribute('aria-controls', searchListId);
    } else {
      input.removeAttribute('aria-controls');
    }

    if (isOpen && activeIndex !== null) {
      input.setAttribute('aria-activedescendant', `${searchListId}-option-${activeIndex}`);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }, [searchListId]);

  useEffect(() => {
    let cancelled = false;

    const handleNativeKeyDown = (event: KeyboardEvent) => {
      const handled = handleSearchKey({
        key: event.key,
        isComposing: event.isComposing,
        preventDefault: () => event.preventDefault(),
      }, () => searchInputRef.current?.blur());

      if (handled) {
        event.stopPropagation();
      }
    };

    void searchbarRef.current?.getInputElement().then((searchInput) => {
      if (cancelled) {
        return;
      }

      searchInputRef.current = searchInput;
      searchInput.setAttribute('role', 'combobox');
      searchInput.setAttribute('aria-autocomplete', 'list');
      updateSearchInputAria(searchInput);
      searchInput.addEventListener('keydown', handleNativeKeyDown);
    });

    return () => {
      cancelled = true;
      searchInputRef.current?.removeEventListener('keydown', handleNativeKeyDown);
      searchInputRef.current = null;
    };
  }, [handleSearchKey, updateSearchInputAria]);

  useEffect(() => {
    const input = searchInputRef.current;
    if (!input) {
      return;
    }

    updateSearchInputAria(input);
  }, [activeSearchSuggestionIndex, isSearchSuggestionsOpen, suggestions.length, updateSearchInputAria]);

  const handleFilterEnter = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.getAttribute('role') === 'combobox' && target.getAttribute('aria-expanded') === 'true') {
      return;
    }

    event.preventDefault();
    const inputs = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input'));
    const nextInput = inputs[inputs.indexOf(target) + 1];
    if (nextInput) {
      nextInput.focus();
    } else {
      target.blur();
    }
  };

  return (
    <div className="zen-history-filter-deck">
      <div className="flex items-center gap-1.5" data-testid="history-filter-row">
        {searchLeadingAction}
        <IonSearchbar
          ref={searchbarRef}
          className={cn(zenListSearchClass, 'm-0 min-w-0 flex-1')}
          autocomplete="off"
          enterkeyhint={areFiltersExpanded ? 'next' : 'search'}
          value={searchText}
          onIonInput={(event) => {
            const value = event.detail.value || '';
            setSearchText(value);
            setActiveSearchSuggestionIndex(null);
            setIsSearchSuggestionsOpen(Boolean(value.trim()));
          }}
          onIonFocus={() => setIsSearchSuggestionsOpen(suggestions.length > 0)}
          onIonBlur={() => window.setTimeout(closeSearchSuggestions, 120)}
          onKeyDown={handleSearchKeyDown}
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
      {!areFiltersExpanded && suggestions.length > 0 && isSearchSuggestionsOpen && (
        <SuggestionDropdown
          id={searchListId}
          items={suggestions}
          activeIndex={activeSearchSuggestionIndex}
          onActiveIndexChange={setActiveSearchSuggestionIndex}
          onSelect={selectSearchSuggestion}
          className="relative max-h-56"
        />
      )}
      {areFiltersExpanded && (
        <div
          id={filterFieldsId}
          ref={filterFieldsRef}
          onKeyDownCapture={handleFilterEnter}
          className="zen-history-filter-fields mt-3 grid gap-2 border-t border-zen-border pt-3 sm:grid-cols-2"
        >
          {FILTER_FIELDS.map((field) => (
            <label key={field.key} className="grid gap-1 text-[0.82rem] text-zen-muted">
              {field.label}
              <SuggestedInput ariaLabel={`Filter ${field.label}`} value={filters[field.key]}
                enterKeyHint="next"
                suggestions={getTeaAttributeSuggestions(knownTeas, field.key, filters[field.key], 8)}
                onChange={(value) => setFilter(field.key, value)} />
            </label>
          ))}
          <label className="grid gap-1 text-[0.82rem] text-zen-muted">
            Year
            <SuggestedInput ariaLabel="Filter Year" type="number" inputMode="numeric"
              enterKeyHint="done"
              value={filters.year} suggestions={getTeaAttributeSuggestions(knownTeas, 'year', filters.year, 24)}
              onChange={(value) => setFilter('year', value)} />
          </label>
        </div>
      )}
    </div>
  );
};

export default HistoryFilters;
