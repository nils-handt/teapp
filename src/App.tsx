import { IonApp, IonRouterOutlet } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Switch, Route, Redirect } from 'react-router-dom';
import Tabs from './screens/Tabs';
import RecordingsScreen from './screens/RecordingsScreen';

import { useEffect } from 'react';
import { bluetoothScaleService } from './services/BluetoothScaleService';

const App: React.FC = () => {
  useEffect(() => {
    bluetoothScaleService.initialize();
  }, []);

  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          <Switch>
            <Route path="/tabs" component={Tabs} />
            <Route path="/recordings" component={RecordingsScreen} />
            <Route path="/" render={() => <Redirect to="/tabs/brewing" />} exact={true} />
          </Switch>
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;