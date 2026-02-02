import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonAlert } from '@ionic/react';
import { useState, useEffect } from 'react';
import { useStore } from '../stores/useStore';

const BrewingScreen: React.FC = () => {
  const { currentWeight, connectionStatus, weightLoggerEnabled, isRecording, startRecording, stopRecording } = useStore();
  const [showSaveAlert, setShowSaveAlert] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1); // todo this will create a delay if the app is not in focus, use recordingStartTime instead
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleToggleRecording = () => {
    if (isRecording) {
      setShowSaveAlert(true);
    } else {
      startRecording();
    }
  };

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

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '80%'
        }}>
          <h2>Current Weight</h2>
          <div style={{ fontSize: '4rem', fontWeight: 'bold', margin: '20px 0' }}>
            {currentWeight.toFixed(1)} g
          </div>

          <div style={{
            marginTop: '20px',
            padding: '10px 20px',
            borderRadius: '20px',
            backgroundColor: connectionStatus === 'connected' ? '#e6f7e6' : '#fff0f0',
            color: connectionStatus === 'connected' ? 'green' : 'red'
          }}>
            Status: {connectionStatus}
          </div>

          {connectionStatus !== 'connected' && (
            <IonButton routerLink="/tabs/settings" fill="outline" style={{ marginTop: '30px' }}>
              Connect Scale
            </IonButton>
          )}
        </div>

        {weightLoggerEnabled && (
          <div style={{ bottom: '20px', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <IonButton
              color={isRecording ? 'danger' : 'medium'}
              onClick={handleToggleRecording}
            >
              {isRecording ? `Stop Recording (${elapsedTime}s)` : 'Start Recording'}
            </IonButton>
          </div>
        )}
        <IonAlert
          isOpen={showSaveAlert}
          onDidDismiss={() => setShowSaveAlert(false)}
          header={'Save Recording'}
          inputs={[
            {
              name: 'sessionName',
              type: 'text',
              placeholder: 'Session Name'
            },
            {
              name: 'notes',
              type: 'text',
              placeholder: 'Notes (optional)'
            }
          ]}
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
              cssClass: 'secondary',
              handler: () => { }
            },
            {
              text: 'Save',
              handler: (data) => {
                stopRecording(data.sessionName || `Session ${new Date().toLocaleTimeString()}`, data.notes);
              }
            }
          ]}
        />
      </IonContent>
    </IonPage>
  );
};
export default BrewingScreen;