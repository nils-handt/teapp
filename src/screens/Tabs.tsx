import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonRouterOutlet, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/react';
import { cafe, list, settings } from 'ionicons/icons';

import BrewingScreen from './BrewingScreen';
import HistoryScreen from './HistoryScreen';
import SettingsScreen from './SettingsScreen';

const Tabs: React.FC = () => (
  <IonTabs>
    <IonRouterOutlet>
      <Route path="/tabs/brewing" component={BrewingScreen} exact={true} />
      <Route path="/tabs/history" component={HistoryScreen} exact={true} />
      <Route path="/tabs/settings" component={SettingsScreen} exact={true} />
      <Route path="/tabs" render={() => <Redirect to="/tabs/brewing" />} exact={true} />
    </IonRouterOutlet>

    <IonTabBar slot="bottom">
      <IonTabButton tab="brewing" href="/tabs/brewing">
        <IonIcon icon={cafe} />
        <IonLabel>Brewing</IonLabel>
      </IonTabButton>
      <IonTabButton tab="history" href="/tabs/history">
        <IonIcon icon={list} />
        <IonLabel>History</IonLabel>
      </IonTabButton>
      <IonTabButton tab="settings" href="/tabs/settings">
        <IonIcon icon={settings} />
        <IonLabel>Settings</IonLabel>
      </IonTabButton>
    </IonTabBar>
  </IonTabs>
);

export default Tabs;
