import { IonApp, IonRouterOutlet } from '@ionic/react';
import { IonReactHashRouter, IonReactRouter } from '@ionic/react-router';
import { Capacitor } from '@capacitor/core';
import { Route, Redirect } from 'react-router-dom';
import Tabs from './screens/Tabs';
import RecordingsScreen from './screens/RecordingsScreen';
import { useEffect } from 'react';
import { useStore } from './stores/useStore';
import { bluetoothScaleService } from './services/BluetoothScaleService';
import { useBrewingSync } from './hooks/useBrewingSync';

const App: React.FC = () => {
  const Router = Capacitor.getPlatform() === 'web' ? IonReactHashRouter : IonReactRouter;

  useEffect(() => {
    bluetoothScaleService.initialize();
    useStore.getState().loadSettings();
  }, []);

  useBrewingSync(); // Activate global state sync

  return (
    <IonApp>
      <Router>
        <IonRouterOutlet>
          <Route path="/tabs" component={Tabs} />
          <Route path="/recordings" component={RecordingsScreen} />

          {/* Phase 13 Design Routes */}
          <Route path="/" render={() => <Redirect to="/tabs/brewing/1" />} exact={true} />
        </IonRouterOutlet>
      </Router>
    </IonApp>
  );
};

export default App;
