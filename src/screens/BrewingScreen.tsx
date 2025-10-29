import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

const BrewingScreen: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Brewing</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Brewing</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div>Brewing Screen - Weight display and session tracking will be implemented in Phase 3</div>
      </IonContent>
    </IonPage>
  );
};

export default BrewingScreen;