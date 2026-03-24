import { IonAlert, IonApp, IonRouterOutlet } from '@ionic/react';
import { IonReactHashRouter, IonReactRouter } from '@ionic/react-router';
import { Capacitor } from '@capacitor/core';
import { Route, Redirect } from 'react-router-dom';
import Tabs from './screens/Tabs';
import RecordingsScreen from './screens/RecordingsScreen';
import { useEffect, useState } from 'react';
import { bluetoothScaleService } from './services/BluetoothScaleService';
import { useBrewingSync } from './hooks/useBrewingSync';
import { getBrewingScreenPath } from './constants/brewingScreens';
import { createLogger } from './services/logging';
import { brewingStore } from './stores/useBrewingStore';
import { settingsStore, useSettingsStore } from './stores/useSettingsStore';
import FirstRunTutorial from './components/FirstRunTutorial';
import { useShallow } from 'zustand/react/shallow';
import { bleAdapter } from './services/bluetooth/adapters/BleAdapter';

const logger = createLogger('App');

const App: React.FC = () => {
  const Router = Capacitor.getPlatform() === 'web' ? IonReactHashRouter : IonReactRouter;
  const [showBrowserCompatibilityWarning, setShowBrowserCompatibilityWarning] = useState(false);
  const {
    hasSeenTutorial,
    isTutorialOpen,
    lastUsedBrewingScreen,
    markTutorialSeen,
    openTutorial,
    settingsLoaded,
  } = useSettingsStore(useShallow((state) => ({
    hasSeenTutorial: state.hasSeenTutorial,
    isTutorialOpen: state.isTutorialOpen,
    lastUsedBrewingScreen: state.lastUsedBrewingScreen,
    markTutorialSeen: state.markTutorialSeen,
    openTutorial: state.openTutorial,
    settingsLoaded: state.settingsLoaded,
  })));

  useEffect(() => {
    logger.info('Starting application bootstrap tasks');

    if (Capacitor.getPlatform() === 'web') {
      const webBluetoothSupport = bleAdapter.getRequiredWebBluetoothSupport();
      if (!webBluetoothSupport.supported) {
        logger.warn('Browser is missing required Web Bluetooth capabilities. Some Bluetooth functionality may be limited.', {
          missing: webBluetoothSupport.missing,
        });
        setShowBrowserCompatibilityWarning(true);
      }
    }

    void bluetoothScaleService.initialize();
    void settingsStore.getState().loadSettings();
    void brewingStore.getState().restoreActiveSession();
  }, []);

  useEffect(() => {
    if (settingsLoaded && !hasSeenTutorial && !isTutorialOpen) {
      openTutorial();
    }
  }, [hasSeenTutorial, isTutorialOpen, openTutorial, settingsLoaded]);

  useBrewingSync(); // Activate global state sync

  return (
    <IonApp>
      <Router>
        <IonRouterOutlet>
          <Route path="/tabs" component={Tabs} />
          <Route path="/recordings" component={RecordingsScreen} />

          {/* Phase 13 Design Routes */}
          <Route path="/" render={() => <Redirect to={getBrewingScreenPath(lastUsedBrewingScreen)} />} exact={true} />
        </IonRouterOutlet>
        <IonAlert
          isOpen={showBrowserCompatibilityWarning}
          onDidDismiss={() => setShowBrowserCompatibilityWarning(false)}
          header="Browser compatibility warning"
          message="Bluetooth functionality may be limited in this browser because required Bluetooth features are missing. Chromium-based browsers generally work well."
          buttons={['OK']}
        />
        <FirstRunTutorial isOpen={isTutorialOpen} onDismiss={markTutorialSeen} />
      </Router>
    </IonApp>
  );
};

export default App;
