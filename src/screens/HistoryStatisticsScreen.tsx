import React, { useMemo, useRef, useState } from 'react';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { useShallow } from 'zustand/react/shallow';
import HistoryFilters from '../components/history/HistoryFilters';
import StatisticsBreakdownCard from '../components/history/StatisticsBreakdownCard';
import { createLogger } from '../services/logging';
import { useHistoryFiltersStore } from '../stores/useHistoryFiltersStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import {
  cn,
  zenListPageClass,
  zenListToolbarClass,
  zenMetricCardClass,
  zenPageShellClass,
  zenSectionEyebrowClass,
  zenStackClass,
} from '../styles/zen';
import {
  calculateHistoryStatistics,
  formatStatisticLiquid,
  formatStatisticWeight,
  type StatisticsPeriod,
} from '../utils/HistoryStatistics';
import { filterHistorySessions } from '../utils/historyFilters';

type LoadState = 'loading' | 'ready' | 'error';

const PERIOD_OPTIONS: Array<{ value: StatisticsPeriod; label: string }> = [
  { value: 'total', label: 'Total' },
  { value: 'lastYear', label: 'Last year' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'lastWeek', label: 'Last week' },
];

const logger = createLogger('HistoryStatisticsScreen');

const HistoryStatisticsScreen: React.FC = () => {
  const { sessionList, knownTeas, loadHistory, loadKnownTeas } = useHistoryStore(
    useShallow((state) => ({
      sessionList: state.sessionList,
      knownTeas: state.knownTeas,
      loadHistory: state.loadHistory,
      loadKnownTeas: state.loadKnownTeas,
    })),
  );
  const { searchText, filters } = useHistoryFiltersStore(useShallow((state) => ({
    searchText: state.searchText,
    filters: state.filters,
  })));
  const { statisticsPeriod, settingsLoaded, updateSettings } = useSettingsStore(useShallow((state) => ({
    statisticsPeriod: state.statisticsPeriod,
    settingsLoaded: state.settingsLoaded,
    updateSettings: state.updateSettings,
  })));
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [areFiltersExpanded, setAreFiltersExpanded] = useState(false);
  const loadSequence = useRef(0);

  const filteredSessions = useMemo(
    () => filterHistorySessions(sessionList, knownTeas, searchText, filters),
    [filters, knownTeas, searchText, sessionList],
  );
  const statistics = useMemo(
    () => settingsLoaded ? calculateHistoryStatistics(filteredSessions, statisticsPeriod) : null,
    [filteredSessions, settingsLoaded, statisticsPeriod],
  );

  const reload = async (forceTeas = false) => {
    const sequence = ++loadSequence.current;
    setLoadState('loading');
    try {
      await Promise.all([loadHistory(), loadKnownTeas(forceTeas)]);
      if (sequence === loadSequence.current) {
        setLoadState('ready');
      }
    } catch (error) {
      logger.error('Failed to load tea statistics', error);
      if (sequence === loadSequence.current) {
        setLoadState('error');
      }
    }
  };

  useIonViewWillEnter(() => { void reload(); });

  const handleRefresh = async (event: CustomEvent) => {
    await reload(true);
    event.detail.complete();
  };

  const selectPeriod = (nextStatisticsPeriod: StatisticsPeriod) => {
    if (settingsLoaded) {
      updateSettings({ statisticsPeriod: nextStatisticsPeriod });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className={zenListToolbarClass}>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/history" />
          </IonButtons>
          <IonTitle>Tea statistics</IonTitle>
        </IonToolbar>
        <HistoryFilters
          knownTeas={knownTeas}
          areFiltersExpanded={areFiltersExpanded}
          onToggleFilters={() => setAreFiltersExpanded((value) => !value)}
        />
      </IonHeader>
      <IonContent fullscreen className={zenListPageClass}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>
        <div className={zenPageShellClass}>
          <div className={zenStackClass}>
            <div role="group" aria-label="Statistics period" className="grid grid-cols-4 gap-2">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={statisticsPeriod === option.value}
                  disabled={!settingsLoaded}
                  onClick={() => selectPeriod(option.value)}
                  className={cn(
                    'min-h-11 rounded-xl border border-zen-border px-2 text-sm transition',
                    statisticsPeriod === option.value
                      ? 'bg-[#566b5b] text-white'
                      : 'bg-white/55 text-zen-muted',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {loadState === 'loading' || !settingsLoaded ? (
              <p className="m-0 text-center text-zen-muted">Loading tea statistics…</p>
            ) : loadState === 'error' ? (
              <p role="alert" className="m-0 text-center text-zen-muted">
                Statistics could not be loaded. Pull to refresh and try again.
              </p>
            ) : statistics && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className={zenMetricCardClass}>
                    <p className={zenSectionEyebrowClass}>Sessions</p>
                    <strong>{statistics.sessionCount} {statistics.sessionCount === 1 ? 'session' : 'sessions'}</strong>
                  </div>
                  <div className={zenMetricCardClass}>
                    <p className={zenSectionEyebrowClass}>Dry leaf</p>
                    <strong>{formatStatisticWeight(statistics.totalDryLeafWeight)}</strong>
                  </div>
                  <div className={zenMetricCardClass}>
                    <p className={zenSectionEyebrowClass}>Liquid</p>
                    <strong>{formatStatisticLiquid(statistics.totalLiquidWeight)}</strong>
                  </div>
                </div>

                {statistics.sessionCount === 0 && (
                  <p className="m-0 text-center text-zen-muted">No completed sessions match these filters.</p>
                )}

                <StatisticsBreakdownCard rankings={statistics.rankings} />

                <section className={zenMetricCardClass}>
                  <p className={zenSectionEyebrowClass}>Brewing averages</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <span><strong>{formatStatisticWeight(statistics.averages.dryLeafWeight)}</strong><br />leaf per session</span>
                    <span><strong>{formatStatisticLiquid(statistics.averages.liquidWeight)}</strong><br />liquid per session</span>
                    <span><strong>{statistics.averages.infusionCount}</strong><br />infusions per session</span>
                  </div>
                </section>

                <section className={zenMetricCardClass}>
                  <p className={zenSectionEyebrowClass}>Tea exploration</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <span><strong>{statistics.exploration.teaCount}</strong><br />teas</span>
                    <span><strong>{statistics.exploration.typeCount}</strong><br />types</span>
                    <span><strong>{statistics.exploration.regionCount}</strong><br />regions</span>
                    <span><strong>{statistics.exploration.subregionCount}</strong><br />subregions</span>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default HistoryStatisticsScreen;
