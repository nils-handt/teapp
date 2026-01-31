import React, { useState } from 'react';
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
  IonToggle,
  IonToast,
  IonCard,
  IonCardContent
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
    updateSettings
  } = useStore();

  const [isMockMode, setIsMockMode] = useState(bluetoothScaleService.isMockMode);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const handleConnectNew = async () => {
    await bluetoothScaleService.connectNewDevice();
  };

  const toggleMockMode = async (enabled: boolean) => {
    await bluetoothScaleService.setMockMode(enabled);
    setIsMockMode(enabled);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        // Basic validation: check for data array and timestamp in first element
        if (json && Array.isArray(json.data) && json.data.length > 0 && typeof json.data[0].timestamp === 'number' && typeof json.data[0].weight === 'number') {
          bluetoothScaleService.mock.loadRecording(json.data);
          setToastMessage(`Loaded recording with ${json.data.length} samples.`);
          setShowToast(true);
        } else {
          setToastMessage('Invalid recording file format: Missing data array or timestamps or weights.');
          setShowToast(true);
        }
      } catch (err) {
        setToastMessage('Failed to parse JSON file.');
        setShowToast(true);
      }
    };
    reader.readAsText(file);
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
              {isMockMode && <p style={{ color: 'orange' }}>Mock Mode Active</p>}
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
                {isMockMode ? 'Connect Mock Scale' : 'Connect New Scale'}
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
                <IonLabel>Use Mock Scale</IonLabel>
                <IonToggle
                  slot="end"
                  checked={isMockMode}
                  onIonChange={e => toggleMockMode(e.detail.checked)}
                />
              </IonItem>

              {isMockMode && (
                <IonCard>
                  <IonCardContent>
                    <IonLabel><h2>Mock Scale Controls</h2></IonLabel>
                    <div style={{ marginTop: '10px' }}>
                      <p>Load Recording (.json)</p>
                      <input type="file" accept=".json" onChange={handleFileUpload} />
                    </div>
                    <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                      <IonButton size="small" onClick={() => bluetoothScaleService.mock.startReplay()}>Play</IonButton>
                      <IonButton size="small" color="warning" onClick={() => bluetoothScaleService.mock.pauseReplay()}>Pause</IonButton>
                      <IonButton size="small" color="medium" onClick={() => bluetoothScaleService.mock.stopReplay()}>Stop</IonButton>
                    </div>
                  </IonCardContent>
                </IonCard>
              )}

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

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
        />
      </IonContent>
    </IonPage>
  );
};

export default SettingsScreen;