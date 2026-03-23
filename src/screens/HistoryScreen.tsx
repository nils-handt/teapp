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
import { trash } from 'ionicons/icons';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { calculateSessionStats } from '../utils/SessionStatistics';
import { filterSessionsByTeaName, getTeaNameSuggestions } from '../utils/teaNameSearch';
import { useShallow } from 'zustand/react/shallow';
import { useHistoryStore } from '../stores/useHistoryStore';

const HistoryScreen: React.FC = () => {
  const { sessionList, loadHistory, deleteSession, knownTeaNames, loadKnownTeaNames } = useHistoryStore(
    useShallow((state) => ({
      sessionList: state.sessionList,
      loadHistory: state.loadHistory,
      deleteSession: state.deleteSession,
      knownTeaNames: state.knownTeaNames,
      loadKnownTeaNames: state.loadKnownTeaNames,
    }))
  );
  const [searchText, setSearchText] = useState('');

  // Load history when entering the view
  useIonViewWillEnter(() => {
    void loadHistory();
    void loadKnownTeaNames();
  });

  // Handle refresh
  const handleRefresh = async (event: CustomEvent) => {
    await Promise.all([loadHistory(), loadKnownTeaNames(true)]);
    setSearchText(''); // Reset search on refresh
    event.detail.complete();
  };

  // Handle search
  const handleSearch = (e: CustomEvent) => {
    const query = e.detail.value;
    setSearchText(query || '');
  };

  const suggestions = useMemo(
    () => (searchText.trim() ? getTeaNameSuggestions(knownTeaNames, searchText) : []),
    [knownTeaNames, searchText],
  );

  const filteredSessions = useMemo(
    () => filterSessionsByTeaName(sessionList, knownTeaNames, searchText),
    [knownTeaNames, searchText, sessionList],
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
        <IonToolbar>
          <IonTitle>History</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            value={searchText}
            onIonInput={handleSearch}
            placeholder="Search by tea name"
            debounce={500}
          />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonList>
          {suggestions.length > 0 && (
            <div className="ion-padding-horizontal ion-padding-top">
              <div style={{ display: 'grid', gap: '8px' }}>
                {suggestions.map((teaName) => (
                  <button
                    key={teaName}
                    type="button"
                    onClick={() => setSearchText(teaName)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid rgba(93, 113, 90, 0.16)',
                      background: 'rgba(255, 255, 255, 0.72)',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    {teaName}
                  </button>
                ))}
              </div>
            </div>
          )}
          {filteredSessions.length === 0 ? (
            <div className="ion-padding ion-text-center">
              <IonLabel color="medium">No brewing sessions found.</IonLabel>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <IonItemSliding key={session.sessionId}>
                <IonItem routerLink={`/tabs/history/${session.sessionId}`} detail>
                  <IonLabel>
                    <h2>{session.teaName}</h2>
                    <p>{formatDate(session.startTime)}</p>
                  </IonLabel>
                  <div slot="end" className="ion-text-right">
                    <IonNote color="primary" style={{ display: 'block' }}>
                      {session.infusions?.length || 0} Infusions
                    </IonNote>
                    <IonNote color="medium" style={{ fontSize: '0.8em' }}>
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
