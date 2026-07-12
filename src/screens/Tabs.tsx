import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonRouterOutlet, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/react';
import { cafe, list, settings } from 'ionicons/icons';

import HistoryScreen from './HistoryScreen';
import SessionDetailScreen from './SessionDetailScreen';
import SettingsScreen from './SettingsScreen';
import BrewingZen from './brewing/BrewingZen';
import HistoryStatisticsScreen from './HistoryStatisticsScreen';

const Tabs: React.FC = () => {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path="/tabs/brewing/1" component={BrewingZen} exact={true} />
        <Route path="/tabs/history/statistics" component={HistoryStatisticsScreen} exact={true} />
        <Route path="/tabs/history/:sessionId" component={SessionDetailScreen} exact={true} />
        <Route path="/tabs/history" component={HistoryScreen} exact={true} />
        <Route path="/tabs/settings" component={SettingsScreen} exact={true} />
        <Route path="/tabs" render={() => <Redirect to="/tabs/brewing/1" />} exact={true} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="brewing" href="/tabs/brewing/1">
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
};

export default Tabs;
