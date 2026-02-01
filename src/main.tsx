import 'reflect-metadata';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setupIonicReact } from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite } from '@capacitor-community/sqlite';
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';
import { AppDataSource } from './database/dataSource';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

setupIonicReact();

const container = document.getElementById('root');
const root = createRoot(container!);

const initApp = async () => {
  const platform = Capacitor.getPlatform();

  if (platform === 'web') {
    jeepSqlite(window);

    const existingJeepEl = document.querySelector('jeep-sqlite');
    if (!existingJeepEl) {
      const jeepEl = document.createElement('jeep-sqlite');
      document.body.appendChild(jeepEl);
    }

    await customElements.whenDefined('jeep-sqlite');

    try {
      await CapacitorSQLite.initWebStore();
    } catch (e) {
      console.error('Failed to initialize Web Store', e);
    }
  }

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('Data Source has been initialized!');
    }
  } catch (err) {
    console.error('Error during Data Source initialization', err);
  }

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

initApp();