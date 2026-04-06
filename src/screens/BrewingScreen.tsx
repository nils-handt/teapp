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

        <div className="flex h-[80%] flex-col items-center justify-center">
          <h2>Current Weight</h2>
          <div className="my-5 text-[4rem] font-bold">
            {currentWeight.toFixed(1)} g
          </div>

          <div className={`mt-5 rounded-[20px] px-5 py-2.5 ${connectionStatus === 'connected' ? 'bg-[#e6f7e6] text-green-700' : 'bg-[#fff0f0] text-red-600'}`}>
            Status: {connectionStatus}
          </div>

          {connectionStatus !== 'connected' && (
            <IonButton routerLink="/tabs/settings" fill="outline" className="mt-[30px]">
              Connect Scale
            </IonButton>
          )}
        </div>

        {weightLoggerEnabled && (
          <div className="flex w-full justify-center">
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
