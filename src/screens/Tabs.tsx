import React, { useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonRouterOutlet, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/react';
import { cafe, list, settings } from 'ionicons/icons';
import { useLocation } from 'react-router';

import BrewingScreen from './BrewingScreen';
import HistoryScreen from './HistoryScreen';
import SessionDetailScreen from './SessionDetailScreen';
import SettingsScreen from './SettingsScreen';
import BrewingZen from './brewing/BrewingZen';
import BrewingLab from './brewing/BrewingLab';
import BrewingFlow from './brewing/BrewingFlow';
import BrewingCard from './brewing/BrewingCard';
import BrewingFocus from './brewing/BrewingFocus';
import {
  DEFAULT_BREWING_SCREEN_ID,
  getBrewingScreenPath,
  isBrewingScreenId,
} from '../constants/brewingScreens';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '../stores/useSettingsStore';

const Tabs: React.FC = () => {
  const location = useLocation();
  const { lastUsedBrewingScreen, updateSettings } = useSettingsStore(useShallow((state) => ({
    lastUsedBrewingScreen: state.lastUsedBrewingScreen,
    updateSettings: state.updateSettings,
  })));
  const brewingTabPath = getBrewingScreenPath(lastUsedBrewingScreen ?? DEFAULT_BREWING_SCREEN_ID);

  useEffect(() => {
    const match = location.pathname.match(/^\/tabs\/brewing\/(\d+)$/);
    if (!match) {
      return;
    }

    const screenId = Number(match[1]);
    if (isBrewingScreenId(screenId) && screenId !== lastUsedBrewingScreen) {
      updateSettings({ lastUsedBrewingScreen: screenId });
    }
  }, [lastUsedBrewingScreen, location.pathname, updateSettings]);

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path="/tabs/brewing/1" component={BrewingZen} exact={true} />
        <Route path="/tabs/brewing/2" component={BrewingLab} exact={true} />
        <Route path="/tabs/brewing/3" component={BrewingFlow} exact={true} />
        <Route path="/tabs/brewing/4" component={BrewingCard} exact={true} />
        <Route path="/tabs/brewing/5" component={BrewingFocus} exact={true} />
        <Route path="/tabs/brewing/6" component={BrewingScreen} exact={true} />
        <Route path="/tabs/history/:sessionId" component={SessionDetailScreen} />
        <Route path="/tabs/history" component={HistoryScreen} exact={true} />
        <Route path="/tabs/settings" component={SettingsScreen} exact={true} />
        <Route path="/tabs" render={() => <Redirect to={brewingTabPath} />} exact={true} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="brewing" href={brewingTabPath}>
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
