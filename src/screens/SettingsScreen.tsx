import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonListHeader,
  IonToggle
} from '@ionic/react';
import { useHistory } from 'react-router';
import { useStore } from '../stores/useStore';
import { bluetoothScaleService } from '../services/BluetoothScaleService';

const SettingsScreen: React.FC = () => {
  const history = useHistory();
  const {
    connectionStatus,
    connectedDevice,
    devMode,
    weightLoggerEnabled,
    updateSettings // Assuming updateSettings is available in useStore
  } = useStore();

  const handleConnectNew = async () => {
    await bluetoothScaleService.connectNewDevice();
  };

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

        <IonList>
          <IonListHeader>
            <IonLabel>Bluetooth Scale</IonLabel>
          </IonListHeader>

          <IonItem>
            <IonLabel>
              <h2>Status</h2>
              <p>{connectionStatus}</p>
            </IonLabel>
            {connectionStatus === 'connected' && (
              <IonButton slot="end" color="danger" onClick={() => bluetoothScaleService.disconnect()}>
                Disconnect
              </IonButton>
            )}
          </IonItem>

          {connectionStatus === 'connected' && connectedDevice && (
            <IonItem>
              <IonLabel>
                <h2>Connected Device</h2>
                <p>{connectedDevice.name}</p>
                <p>{connectedDevice.id}</p>
              </IonLabel>
            </IonItem>
          )}

          {connectionStatus !== 'connected' && (
            <IonItem lines="none">
              <IonButton expand="block" onClick={handleConnectNew} disabled={connectionStatus === 'connecting'}>
                Connect New Scale
              </IonButton>
            </IonItem>
          )}

        </IonList>

        <IonList>
          <IonListHeader>
            <IonLabel>Development</IonLabel>
          </IonListHeader>
          <IonItem>
            <IonLabel>Dev Mode</IonLabel>
            <IonToggle
              slot="end"
              checked={devMode}
              onIonChange={e => updateSettings({ devMode: e.detail.checked })}
            />
          </IonItem>

          {devMode && (
            <>
              <IonItem>
                <IonLabel>Enable Weight Logger</IonLabel>
                <IonToggle
                  slot="end"
                  checked={weightLoggerEnabled}
                  onIonChange={e => updateSettings({ weightLoggerEnabled: e.detail.checked })}
                />
              </IonItem>

              {weightLoggerEnabled && (
                <IonItem button onClick={() => history.push('/recordings')}>
                  <IonLabel>Manage Recordings</IonLabel>
                </IonItem>
              )}
            </>
          )}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default SettingsScreen;