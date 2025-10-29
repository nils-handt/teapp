import { IonApp, IonRouterOutlet } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Switch, Route, Redirect } from 'react-router-dom';
import Tabs from './screens/Tabs';

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <IonRouterOutlet>
        <Switch>
          <Route path="/tabs" component={Tabs} />
          <Route path="/" render={() => <Redirect to="/tabs/brewing" />} exact={true} />
        </Switch>
      </IonRouterOutlet>
    </IonReactRouter>
  </IonApp>
);

export default App;