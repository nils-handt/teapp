import React, { useMemo, useState } from 'react';
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
  useIonToast,
  useIonViewWillEnter
} from '@ionic/react';
import { trash } from 'ionicons/icons';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { calculateSessionStats } from '../utils/SessionStatistics';
import { useShallow } from 'zustand/react/shallow';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useHistoryFiltersStore } from '../stores/useHistoryFiltersStore';
import HistoryFilters from '../components/history/HistoryFilters';
import {
  zenListItemMetaClass,
  zenListItemTitleClass,
  zenListPageClass,
  zenListSurfaceClass,
} from '../styles/zen';
import { formatTeaLabel } from '../utils/teaSearch';
import { filterHistorySessions } from '../utils/historyFilters';

const HistoryScreen: React.FC = () => {
  const { sessionList, loadHistory, deleteSession, restoreSession, knownTeas, loadKnownTeas } = useHistoryStore(
    useShallow((state) => ({
      sessionList: state.sessionList,
      loadHistory: state.loadHistory,
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

  // Load history when entering the view
  useIonViewWillEnter(() => {
    void loadHistory();
    void loadKnownTeas();
  });

  // Handle refresh
  const handleRefresh = async (event: CustomEvent) => {
    await Promise.all([loadHistory(), loadKnownTeas(true)]);
    setAreFiltersExpanded(false);
    event.detail.complete();
  };

  const filteredSessions = useMemo(
    () => filterHistorySessions(sessionList, knownTeas, searchText, filters),
    [filters, knownTeas, searchText, sessionList],
  );

  // Handle delete
  const handleDelete = async (sessionId: string) => {
    const deletedSession = sessionList.find((session) => session.sessionId === sessionId);
    await deleteSession(sessionId);

    if (!deletedSession) {
      return;
    }

    presentToast({
      message: 'Session deleted',
      duration: 5000,
      position: 'bottom',
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
        />
      </IonHeader>
      <IonContent fullscreen data-testid="history-page" className={zenListPageClass}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonList className={zenListSurfaceClass}>
          {filteredSessions.length === 0 ? (
            <div className="p-5 text-center">
              <IonLabel color="medium">No brewing sessions found.</IonLabel>
            </div>
          ) : (
            filteredSessions.map((session) => (
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
      </IonContent>
    </IonPage>
  );
};

export default HistoryScreen;
