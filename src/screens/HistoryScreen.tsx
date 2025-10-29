import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

const HistoryScreen: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>History</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">History</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div>History Screen - Session list will be implemented in Phase 15</div>
      </IonContent>
    </IonPage>
  );
};

export default HistoryScreen;