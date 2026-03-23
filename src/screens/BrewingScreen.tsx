import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton } from '@ionic/react';
import { useEffect, useState } from 'react';
import DesignSwitcher from '../components/DesignSwitcher';
import { useBrewingControl } from '../hooks/useBrewingControl';
import { useShallow } from 'zustand/react/shallow';
import { useRecordingStore } from '../stores/useRecordingStore';
import { useScaleStore } from '../stores/useScaleStore';
import { useSettingsStore } from '../stores/useSettingsStore';

const BrewingScreen: React.FC = () => {
  const { currentWeight, connectionStatus } = useScaleStore(useShallow((state) => ({
    currentWeight: state.currentWeight,
    connectionStatus: state.connectionStatus,
  })));
  const weightLoggerEnabled = useSettingsStore((state) => state.weightLoggerEnabled);
  const isRecording = useRecordingStore((state) => state.isRecording);
  const { startBrewingSession, handleEndSession, recordingAlert } = useBrewingControl();
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
      handleEndSession();
    } else {
      startBrewingSession();
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Brewing</IonTitle>
          <DesignSwitcher />
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
              {isRecording ? `Stop Session & Recording (${elapsedTime}s)` : 'Start Session & Recording'}
            </IonButton>
          </div>
        )}
        {recordingAlert}
      </IonContent>
    </IonPage>
  );
};
export default BrewingScreen;
