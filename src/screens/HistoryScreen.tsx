import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonIcon,
  IonButton,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  useIonToast,
  useIonViewWillEnter
} from '@ionic/react';
import { APP_TOAST_POSITION } from '../constants/ui';
import { pieChartOutline, trash } from 'ionicons/icons';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { calculateSessionStats } from '../utils/SessionStatistics';
import { useShallow } from 'zustand/react/shallow';
import { historyStore, useHistoryStore } from '../stores/useHistoryStore';
import { useHistoryFiltersStore } from '../stores/useHistoryFiltersStore';
import HistoryFilters from '../components/history/HistoryFilters';
import {
  zenListItemMetaClass,
  zenListItemTitleClass,
  zenListPageClass,
  zenListSurfaceClass,
} from '../styles/zen';
import { formatTeaLabel } from '../utils/teaSearch';
import { createHistoryQuery, getHistoryQueryKey } from '../utils/historyFilters';

const HistoryScreen: React.FC = () => {
  const {
    sessionList,
    hasMoreHistory,
    isHistoryLoading,
    reloadHistory,
    loadMoreHistory,
    deleteSession,
    restoreSession,
    knownTeas,
    loadKnownTeas,
  } = useHistoryStore(
    useShallow((state) => ({
      sessionList: state.sessionList,
      hasMoreHistory: state.hasMoreHistory,
      isHistoryLoading: state.isHistoryLoading,
      reloadHistory: state.reloadHistory,
      loadMoreHistory: state.loadMoreHistory,
      deleteSession: state.deleteSession,
      restoreSession: state.restoreSession,
      knownTeas: state.knownTeas,
      loadKnownTeas: state.loadKnownTeas,
    }))
  );
  const { searchText, filters } = useHistoryFiltersStore(useShallow((state) => ({
    searchText: state.searchText,
    filters: state.filters,
  })));
  const [areFiltersExpanded, setAreFiltersExpanded] = useState(false);
  const [presentToast] = useIonToast();
  const skipInitialFilterReload = useRef(true);

  const historyQuery = useMemo(
    () => createHistoryQuery(knownTeas, searchText, filters),
    [filters, knownTeas, searchText],
  );
  const historyQueryKey = getHistoryQueryKey(historyQuery);
  const historyQueryRef = useRef(historyQuery);
  historyQueryRef.current = historyQuery;

  const reloadCurrentHistory = useCallback(async (forceTeas = false) => {
    await loadKnownTeas(forceTeas);
    await reloadHistory(createHistoryQuery(historyStore.getState().knownTeas, searchText, filters));
  }, [filters, loadKnownTeas, reloadHistory, searchText]);

  // Load history when entering the view
  useIonViewWillEnter(() => {
    void reloadCurrentHistory();
  });

  useEffect(() => {
    if (skipInitialFilterReload.current) {
      skipInitialFilterReload.current = false;
      return;
    }

    void reloadHistory(historyQueryRef.current);
  }, [historyQueryKey, reloadHistory]);

  // Handle refresh
  const handleRefresh = async (event: CustomEvent) => {
    await reloadCurrentHistory(true);
    setAreFiltersExpanded(false);
    event.detail.complete();
  };

  const handleLoadMore = async (event: CustomEvent) => {
    await loadMoreHistory();
    (event.target as HTMLIonInfiniteScrollElement).complete();
  };

  // Handle delete
  const handleDelete = async (sessionId: string) => {
    const deletedSession = sessionList.find((session) => session.sessionId === sessionId);
    await deleteSession(sessionId);

    if (!deletedSession) {
      return;
    }

    presentToast({
      ...APP_TOAST_POSITION,
      message: 'Session deleted',
      duration: 5000,
      buttons: [
        {
          text: 'Undo',
          handler: () => {
            void restoreSession(deletedSession);
          },
        },
      ],
    });
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

  const getSessionTeaLabel = (session: BrewingSession) => (
    formatTeaLabel(session.tea) || session.teaName?.trim() || ''
  );

  return (
    <IonPage>
      <IonHeader>
        <HistoryFilters
          knownTeas={knownTeas}
          areFiltersExpanded={areFiltersExpanded}
          onToggleFilters={() => setAreFiltersExpanded((current) => !current)}
          searchAction={(
            <IonButton
              routerLink="/tabs/history/statistics"
              fill="clear"
              aria-label="Open tea statistics"
              className="m-0 h-11 w-11 shrink-0 rounded-2xl border border-zen-border text-zen-text"
            >
              <IonIcon icon={pieChartOutline} aria-hidden="true" />
            </IonButton>
          )}
        />
      </IonHeader>
      <IonContent fullscreen data-testid="history-page" className={zenListPageClass}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonList className={zenListSurfaceClass}>
          {isHistoryLoading && sessionList.length === 0 ? (
            <div className="p-5 text-center" role="status">Loading history…</div>
          ) : sessionList.length === 0 ? (
            <div className="p-5 text-center">
              <IonLabel color="medium">No brewing sessions found.</IonLabel>
            </div>
          ) : (
            sessionList.map((session) => (
              <IonItemSliding key={session.sessionId}>
                <IonItem routerLink={`/tabs/history/${session.sessionId}`} detail>
                  <IonLabel>
                    <h2 className={getSessionTeaLabel(session) ? zenListItemTitleClass : 'text-[0.98rem] font-medium text-zen-muted'}>
                      {getSessionTeaLabel(session) || 'No tea selected'}
                    </h2>
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
        <IonInfiniteScroll
          threshold="100px"
          disabled={!hasMoreHistory}
          onIonInfinite={handleLoadMore}
        >
          <IonInfiniteScrollContent loadingSpinner="bubbles" loadingText="Loading more history…" />
        </IonInfiniteScroll>
      </IonContent>
    </IonPage>
  );
};

export default HistoryScreen;
