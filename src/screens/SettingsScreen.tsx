import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

const SettingsScreen: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Settings</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div>Settings Screen - Configuration options will be implemented in Phase 10</div>
      </IonContent>
    </IonPage>
  );
};

export default SettingsScreen;