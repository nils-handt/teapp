import React, { useMemo, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonSearchbar,
  IonRefresher,
  IonRefresherContent,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonIcon,
  useIonViewWillEnter
} from '@ionic/react';
import { chevronDown, trash } from 'ionicons/icons';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { calculateSessionStats } from '../utils/SessionStatistics';
import { useShallow } from 'zustand/react/shallow';
import { useHistoryStore } from '../stores/useHistoryStore';
import SuggestionList from '../components/ui/SuggestionList';
import SuggestedInput from '../components/ui/SuggestedInput';
import {
  cn,
  zenListItemMetaClass,
  zenListItemTitleClass,
  zenListPageClass,
  zenListSearchClass,
  zenListSurfaceClass,
  zenListToolbarClass,
} from '../styles/zen';
import {
  filterSessionsByTeaFilters,
  formatTeaLabel,
  getTeaAttributeSuggestions,
  getTeaSuggestions,
  type TeaFilters,
} from '../utils/teaSearch';

type TeaFilterDraft = {
  name: string;
  brand: string;
  type: string;
  subtype: string;
  region: string;
  subregion: string;
  season: string;
  year: string;
};

const EMPTY_FILTERS: TeaFilterDraft = {
  name: '',
  brand: '',
  type: '',
  subtype: '',
  region: '',
  subregion: '',
  season: '',
  year: '',
};

const FILTER_FIELDS: Array<{ key: keyof TeaFilterDraft; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'brand', label: 'Brand' },
  { key: 'type', label: 'Type' },
  { key: 'subtype', label: 'Subtype' },
  { key: 'region', label: 'Region' },
  { key: 'subregion', label: 'Subregion' },
  { key: 'season', label: 'Season' },
];

const HistoryScreen: React.FC = () => {
  const { sessionList, loadHistory, deleteSession, knownTeas, loadKnownTeas } = useHistoryStore(
    useShallow((state) => ({
      sessionList: state.sessionList,
      loadHistory: state.loadHistory,
      deleteSession: state.deleteSession,
      knownTeas: state.knownTeas,
      loadKnownTeas: state.loadKnownTeas,
    }))
  );
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState<TeaFilterDraft>(EMPTY_FILTERS);
  const [areFiltersExpanded, setAreFiltersExpanded] = useState(false);

  // Load history when entering the view
  useIonViewWillEnter(() => {
    void loadHistory();
    void loadKnownTeas();
  });

  // Handle refresh
  const handleRefresh = async (event: CustomEvent) => {
    await Promise.all([loadHistory(), loadKnownTeas(true)]);
    setSearchText(''); // Reset search on refresh
    setFilters(EMPTY_FILTERS);
    setAreFiltersExpanded(false);
    event.detail.complete();
  };

  // Handle search
  const handleSearch = (e: CustomEvent) => {
    const query = e.detail.value;
    setSearchText(query || '');
  };

  const applySearchSuggestion = (suggestion: string) => {
    setSearchText(suggestion);
  };

  const suggestions = useMemo(
    () => (searchText.trim() ? getTeaSuggestions(knownTeas, searchText).map(formatTeaLabel) : []),
    [knownTeas, searchText],
  );

  const activeFilters: TeaFilters = useMemo(() => ({
    name: filters.name,
    brand: filters.brand,
    type: filters.type,
    subtype: filters.subtype,
    region: filters.region,
    subregion: filters.subregion,
    season: filters.season,
    year: filters.year.trim() ? Number(filters.year) : null,
  }), [filters]);

  const filteredSessions = useMemo(
    () => {
      let searchedSessions = sessionList;
      if (searchText.trim()) {
        const matchedTeaIds = new Set(getTeaSuggestions(knownTeas, searchText, knownTeas.length).map((tea) => tea.teaId));
        searchedSessions = sessionList.filter((session) => Boolean(session.teaId && matchedTeaIds.has(session.teaId)));
      }

      return filterSessionsByTeaFilters(searchedSessions, activeFilters);
    },
    [activeFilters, knownTeas, searchText, sessionList],
  );

  // Handle delete
  const handleDelete = async (sessionId: string) => {
    await deleteSession(sessionId);
  };

  const formatDate = (value: string | number | Date) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (isNaN(date.getTime())) return 'Invalid Date';

    return new Intl.DateTimeFormat('default', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Calculate total duration of all infusions
  const getSessionDuration = (session: BrewingSession) => {
    const stats = calculateSessionStats(session);
    return stats.totalBrewTime;
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className={zenListToolbarClass}>
          <IonTitle>History</IonTitle>
        </IonToolbar>
        <IonToolbar className={zenListToolbarClass}>
          <div
            onClick={() => {
              if (!areFiltersExpanded) {
                setAreFiltersExpanded(true);
              }
            }}
          >
            <IonSearchbar
              className={zenListSearchClass}
              value={searchText}
              onIonInput={handleSearch}
              placeholder="Search teas"
              debounce={500}
            />
            <button
              type="button"
              aria-label={areFiltersExpanded ? 'Hide history filters' : 'Show history filters'}
              aria-expanded={areFiltersExpanded}
              onClick={(event) => {
                event.stopPropagation();
                setAreFiltersExpanded((current) => !current);
              }}
              className="flex h-6 w-full items-center justify-center text-zen-muted"
            >
              <IonIcon
                icon={chevronDown}
                className={cn(
                  'text-base transition-transform',
                  areFiltersExpanded && 'rotate-180',
                )}
              />
            </button>
          </div>
        </IonToolbar>
        {areFiltersExpanded && (
          <IonToolbar className={zenListToolbarClass}>
            <div className="grid gap-2 px-4 py-3 sm:grid-cols-2">
              {FILTER_FIELDS.map((field) => {
                const fieldSuggestions = getTeaAttributeSuggestions(knownTeas, field.key, filters[field.key], 8);

                return (
                  <label key={field.key} className="grid gap-1 text-[0.82rem] text-zen-muted">
                    {field.label}
                    <SuggestedInput
                      ariaLabel={`Filter ${field.label}`}
                      value={filters[field.key]}
                      suggestions={fieldSuggestions}
                      onChange={(value) => setFilters((currentFilters) => ({
                        ...currentFilters,
                        [field.key]: value,
                      }))}
                    />
                  </label>
                );
              })}
              <label className="grid gap-1 text-[0.82rem] text-zen-muted">
                Year
                <SuggestedInput
                  ariaLabel="Filter Year"
                  type="number"
                  inputMode="numeric"
                  value={filters.year}
                  suggestions={getTeaAttributeSuggestions(knownTeas, 'year', filters.year, 24)}
                  onChange={(value) => setFilters((currentFilters) => ({
                    ...currentFilters,
                    year: value,
                  }))}
                />
              </label>
            </div>
          </IonToolbar>
        )}
      </IonHeader>
      <IonContent fullscreen data-testid="history-page" className={zenListPageClass}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonList className={zenListSurfaceClass} onClick={() => {
          if (areFiltersExpanded) {
            setAreFiltersExpanded(false);
          }
        }}>
          {!areFiltersExpanded && suggestions.length > 0 && (
            <div className="px-4 pt-4">
              <SuggestionList items={suggestions} onSelect={applySearchSuggestion} />
            </div>
          )}
          {filteredSessions.length === 0 ? (
            <div className="p-5 text-center">
              <IonLabel color="medium">No brewing sessions found.</IonLabel>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <IonItemSliding key={session.sessionId}>
                <IonItem routerLink={`/tabs/history/${session.sessionId}`} detail>
                  <IonLabel>
                    <h2 className={zenListItemTitleClass}>{formatTeaLabel(session.tea) || session.teaName}</h2>
                    <p className={zenListItemMetaClass}>{formatDate(session.startTime)}</p>
                  </IonLabel>
                  <div slot="end" className="text-right">
                    <IonNote color="medium" className="block text-zen-muted">
                      {session.infusions?.length || 0} Infusions
                    </IonNote>
                    <IonNote color="medium" className={zenListItemMetaClass}>
                      {formatDuration(getSessionDuration(session))}
                    </IonNote>
                  </div>
                </IonItem>
                <IonItemOptions side="end">
                  <IonItemOption
                    color="danger"
                    onClick={() => handleDelete(session.sessionId)}
                  >
                    <IonIcon slot="icon-only" icon={trash} />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))
          )}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default HistoryScreen;
