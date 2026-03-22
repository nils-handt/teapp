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
  IonCardContent,
  IonSelect,
  IonSelectOption,
  IonAlert
} from '@ionic/react';
import { useHistory } from 'react-router';
import { useStore } from '../stores/useStore';
import { bluetoothScaleService } from '../services/BluetoothScaleService';
import { backupService, isBackupData, type BackupData } from '../services/BackupService';
import { shareFile } from '../utils/fileUtils';
import { BREWING_SCREEN_OPTIONS, isBrewingScreenId } from '../constants/brewingScreens';
import { createLogger, isLogLevel, LOG_LEVELS } from '../services/logging';

const logger = createLogger('SettingsScreen');

type ToggleSettingItemProps = {
  checked: boolean;
  label: string;
  onToggle: (checked: boolean) => void | Promise<void>;
};

const ToggleSettingItem: React.FC<ToggleSettingItemProps> = ({ checked, label, onToggle }) => {
  const handleToggleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <IonItem button detail={false} onClick={() => onToggle(!checked)}>
      <IonLabel>{label}</IonLabel>
      <IonToggle
        slot="end"
        checked={checked}
        onClick={handleToggleClick}
        onIonChange={e => onToggle(e.detail.checked)}
      />
    </IonItem>
  );
};

const SettingsScreen: React.FC = () => {
  const history = useHistory();
  const {
    connectionStatus,
    connectedDevice,
    devMode,
    logLevel,
    logToFileEnabled,
    weightLoggerEnabled,
    playbackSpeed,
    lastUsedBrewingScreen,
    updateSettings
  } = useStore();

  const [isMockMode, setIsMockMode] = useState(bluetoothScaleService.isMockMode);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [restoreData, setRestoreData] = useState<BackupData | null>(null);

  const handleConnectNew = async () => {
    await bluetoothScaleService.connectNewDevice();
  };

  const toggleMockMode = async (enabled: boolean) => {
    await bluetoothScaleService.setMockMode(enabled);
    setIsMockMode(enabled);
  };

  const handleSpeedChange = (speed: number) => {
    bluetoothScaleService.mock.setPlaybackSpeed(speed);
    updateSettings({ playbackSpeed: speed });
  };

  const handleBrewingScreenChange = (value: number) => {
    if (isBrewingScreenId(value)) {
      updateSettings({ lastUsedBrewingScreen: value });
    }
  };

  const handleLogLevelChange = (value: string) => {
    if (isLogLevel(value)) {
      updateSettings({ logLevel: value });
    }
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
        } else {
          setToastMessage('Invalid recording file format: Missing data array or timestamps or weights.');
        }
      } catch {
        setToastMessage('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleBackup = async () => {
    try {
      const data = await backupService.exportData();
      const fileName = `teapp_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      await shareFile(fileName, data);
      setToastMessage('Backup created successfully');
    } catch (error) {
      logger.error('Backup failed', error);
      setToastMessage('Backup failed');
    }
  };

  const handleRestoreFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json: unknown = JSON.parse(e.target?.result as string);
        if (!isBackupData(json)) {
          setToastMessage('Invalid backup file format');
          return;
        }

        setRestoreData(json);
      } catch {
        setToastMessage('Failed to parse backup file');
      }
    };
    reader.readAsText(file);
  };

  const executeRestore = async () => {
    if (!restoreData) return;
    try {
      await backupService.importData(restoreData);
      setToastMessage('Data restored successfully. App will reload.');
      // Force reload to reset store and re-initialize DB connection
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      logger.error('Restore failed', error);
      setToastMessage('Restore failed');
    } finally {
      setRestoreData(null);
      // Reset file input
      const input = document.getElementById('restore-file-input') as HTMLInputElement;
      if (input) input.value = '';
    }
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
            <IonLabel>Brewing</IonLabel>
          </IonListHeader>
          <IonItem>
            <IonLabel>Brewing Tab Screen</IonLabel>
            <IonSelect
              value={lastUsedBrewingScreen}
              onIonChange={e => handleBrewingScreenChange(Number(e.detail.value))}
              interface="popover"
            >
              {BREWING_SCREEN_OPTIONS.map((screen) => (
                <IonSelectOption key={screen.id} value={screen.id}>
                  {screen.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </IonList>

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
          <ToggleSettingItem
            label="Dev Mode"
            checked={devMode}
            onToggle={(checked) => updateSettings({ devMode: checked })}
          />

          {devMode && (
            <>
              <ToggleSettingItem
                label="Use Mock Scale"
                checked={isMockMode}
                onToggle={toggleMockMode}
              />

              <IonItem>
                <IonLabel>Log Level</IonLabel>
                <IonSelect
                  value={logLevel}
                  onIonChange={e => handleLogLevelChange(e.detail.value)}
                  interface="popover"
                >
                  {LOG_LEVELS.map((levelOption) => (
                    <IonSelectOption key={levelOption} value={levelOption}>
                      {levelOption}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>

              <ToggleSettingItem
                label="Save Logs To File"
                checked={logToFileEnabled}
                onToggle={(checked) => updateSettings({ logToFileEnabled: checked })}
              />

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
                    <div style={{ marginTop: '15px' }}>
                      <IonLabel>Playback Speed</IonLabel>
                      <IonSelect
                        value={playbackSpeed}
                        placeholder="Select Speed"
                        onIonChange={e => handleSpeedChange(e.detail.value)}
                        interface="popover"
                      >
                        <IonSelectOption value={1}>1x (Real-time)</IonSelectOption>
                        <IonSelectOption value={10}>10x</IonSelectOption>
                        <IonSelectOption value={50}>50x</IonSelectOption>
                        <IonSelectOption value={100}>100x</IonSelectOption>
                      </IonSelect>
                    </div>
                  </IonCardContent>
                </IonCard>
              )}

              <ToggleSettingItem
                label="Enable Weight Logger"
                checked={weightLoggerEnabled}
                onToggle={(checked) => updateSettings({ weightLoggerEnabled: checked })}
              />

              {weightLoggerEnabled && (
                <IonItem button onClick={() => history.push('/recordings')}>
                  <IonLabel>Manage Recordings</IonLabel>
                </IonItem>
              )}
            </>
          )}

          <IonListHeader>
            <IonLabel>Data Management</IonLabel>
          </IonListHeader>
          <IonItem button onClick={() => handleBackup()}>
            <IonLabel>Backup Data</IonLabel>
          </IonItem>
          <IonItem button onClick={() => {
            // Programmatically click the hidden file input
            document.getElementById('restore-file-input')?.click();
          }}>
            <IonLabel>Restore Data</IonLabel>
            <input
              type="file"
              accept=".json"
              id="restore-file-input"
              style={{ display: 'none' }}
              onChange={handleRestoreFileUpload}
            />
          </IonItem>
        </IonList>

        <IonAlert
          isOpen={restoreData !== null}
          onDidDismiss={() => setRestoreData(null)}
          header={'Confirm Restore'}
          message={'Restoring data will overwrite all existing data. This action cannot be undone. Are you sure you want to proceed?'}
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
              handler: () => {
                setRestoreData(null);
                // Reset file input
                const input = document.getElementById('restore-file-input') as HTMLInputElement;
                if (input) input.value = '';
              }
            },
            {
              text: 'Restore',
              role: 'destructive',
              handler: executeRestore
            }
          ]}
        />

        <IonToast
          isOpen={toastMessage !== null}
          onDidDismiss={() => setToastMessage(null)}
          message={toastMessage ?? ''}
          duration={2000}
        />
      </IonContent>
    </IonPage>
  );
};

export default SettingsScreen;
