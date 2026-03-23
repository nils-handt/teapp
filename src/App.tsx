import { IonApp, IonRouterOutlet } from '@ionic/react';
import { IonReactHashRouter, IonReactRouter } from '@ionic/react-router';
import { Capacitor } from '@capacitor/core';
import { Route, Redirect } from 'react-router-dom';
import Tabs from './screens/Tabs';
import RecordingsScreen from './screens/RecordingsScreen';
import { useEffect } from 'react';
import { bluetoothScaleService } from './services/BluetoothScaleService';
import { useBrewingSync } from './hooks/useBrewingSync';
import { getBrewingScreenPath } from './constants/brewingScreens';
import { createLogger } from './services/logging';
import { brewingStore } from './stores/useBrewingStore';
import { settingsStore, useSettingsStore } from './stores/useSettingsStore';

const logger = createLogger('App');

const App: React.FC = () => {
  const Router = Capacitor.getPlatform() === 'web' ? IonReactHashRouter : IonReactRouter;
  const lastUsedBrewingScreen = useSettingsStore((state) => state.lastUsedBrewingScreen);

  useEffect(() => {
    logger.info('Starting application bootstrap tasks');
    void bluetoothScaleService.initialize();
    void settingsStore.getState().loadSettings();
    void brewingStore.getState().restoreActiveSession();
  }, []);

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
      </Router>
    </IonApp>
  );
};

export default App;
