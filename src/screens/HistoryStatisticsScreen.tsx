import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { BrewingSession } from '../entities/BrewingSession.entity';
import HistoryFilters from '../components/history/HistoryFilters';
import StatisticsBreakdownCard from '../components/history/StatisticsBreakdownCard';
import { createLogger } from '../services/logging';
import { useHistoryFiltersStore } from '../stores/useHistoryFiltersStore';
import { historyStore, useHistoryStore } from '../stores/useHistoryStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import {
  cn,
  zenListPageClass,
  zenListToolbarClass,
  zenMetricCardClass,
  zenPageShellClass,
  zenPanelClass,
  zenPanelStrongClass,
  zenSectionEyebrowClass,
  zenStackClass,
  zenSummaryStatLabelClass,
} from '../styles/zen';
import {
  calculateHistoryStatistics,
  formatStatisticLiquid,
  formatStatisticWeight,
  type StatisticsPeriod,
} from '../utils/HistoryStatistics';
import { createHistoryQuery, getHistoryQueryKey } from '../utils/historyFilters';

type LoadState = 'loading' | 'ready' | 'error';

const PERIOD_OPTIONS: Array<{ value: StatisticsPeriod; label: string }> = [
  { value: 'total', label: 'Total' },
  { value: 'lastYear', label: 'Last year' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'lastWeek', label: 'Last week' },
];

const logger = createLogger('HistoryStatisticsScreen');

const HistoryStatisticsScreen: React.FC = () => {
  const { knownTeas, loadAllHistory, loadKnownTeas } = useHistoryStore(
    useShallow((state) => ({
      knownTeas: state.knownTeas,
      loadAllHistory: state.loadAllHistory,
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
  const [statisticsSessions, setStatisticsSessions] = useState<BrewingSession[]>([]);
  const loadSequence = useRef(0);
  const skipInitialFilterReload = useRef(true);
  const historyQuery = useMemo(
    () => createHistoryQuery(knownTeas, searchText, filters),
    [filters, knownTeas, searchText],
  );
  const historyQueryKey = getHistoryQueryKey(historyQuery);
  const statistics = useMemo(
    () => settingsLoaded ? calculateHistoryStatistics(statisticsSessions, statisticsPeriod) : null,
    [settingsLoaded, statisticsPeriod, statisticsSessions],
  );

  const reload = useCallback(async (forceTeas = false) => {
    const sequence = ++loadSequence.current;
    setLoadState('loading');
    try {
      await loadKnownTeas(forceTeas);
      const sessions = await loadAllHistory(createHistoryQuery(
        historyStore.getState().knownTeas,
        searchText,
        filters,
      ));
      if (sequence === loadSequence.current) {
        setStatisticsSessions(sessions);
        setLoadState('ready');
      }
    } catch (error) {
      logger.error('Failed to load tea statistics', error);
      if (sequence === loadSequence.current) {
        setLoadState('error');
      }
    }
  }, [filters, loadAllHistory, loadKnownTeas, searchText]);

  useIonViewWillEnter(() => { void reload(); });

  useEffect(() => {
    if (skipInitialFilterReload.current) {
      skipInitialFilterReload.current = false;
      return;
    }

    void reload();
  }, [historyQueryKey, reload]);

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
                <section className={zenPanelStrongClass}>
                  <div>
                    <p className={zenSectionEyebrowClass}>Sessions</p>
                    <h2 className="mt-[10px] mb-2 text-[1.9rem] font-normal text-zen-text">
                      {statistics.sessionCount} {statistics.sessionCount === 1 ? 'session' : 'sessions'}
                    </h2>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className={zenMetricCardClass}>
                      <div className={zenSummaryStatLabelClass}>Dry leaf</div>
                      <div>{formatStatisticWeight(statistics.totalDryLeafWeight)}</div>
                    </div>
                    <div className={zenMetricCardClass}>
                      <div className={zenSummaryStatLabelClass}>Liquid</div>
                      <div>{formatStatisticLiquid(statistics.totalLiquidWeight)}</div>
                    </div>
                  </div>
                </section>

                {statistics.sessionCount === 0 && (
                  <p className="m-0 text-center text-zen-muted">No completed sessions match these filters.</p>
                )}

                <StatisticsBreakdownCard rankings={statistics.rankings} />

                <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
                  <section className={zenPanelClass}>
                    <p className={zenSectionEyebrowClass}>Brewing averages</p>
                    <div className="mt-4 grid">
                      {[
                        { label: 'leaf per session', value: formatStatisticWeight(statistics.averages.dryLeafWeight) },
                        { label: 'liquid per session', value: formatStatisticLiquid(statistics.averages.liquidWeight) },
                        { label: 'infusions per session', value: statistics.averages.infusionCount },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between gap-4 border-t border-zen-border py-3 first:border-t-0 first:pt-0 last:pb-0"
                        >
                          <span className="text-[0.9rem] text-zen-muted">{item.label}</span>
                          <strong className="font-medium text-zen-text">{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className={zenPanelClass}>
                    <p className={zenSectionEyebrowClass}>Tea exploration</p>
                    <div className="mt-4 grid">
                      {[
                        { label: 'teas', value: statistics.exploration.teaCount },
                        { label: 'types', value: statistics.exploration.typeCount },
                        { label: 'regions', value: statistics.exploration.regionCount },
                        { label: 'subregions', value: statistics.exploration.subregionCount },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between gap-4 border-t border-zen-border py-3 first:border-t-0 first:pt-0 last:pb-0"
                        >
                          <span className="text-[0.9rem] text-zen-muted">{item.label}</span>
                          <strong className="font-medium text-zen-text">{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default HistoryStatisticsScreen;
