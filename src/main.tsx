import 'reflect-metadata';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setupIonicReact } from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite } from '@capacitor-community/sqlite';
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';
import { AppDataSource } from './database/dataSource';
import { createLogger } from './services/logging';

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

const logger = createLogger('AppStartup');

const container = document.getElementById('root');
const root = createRoot(container!);

const initApp = async () => {
  const platform = Capacitor.getPlatform();

  logger.info('Initializing application', { platform });

  if (platform === 'web') {
    logger.info('Initializing SQLite web store');
    jeepSqlite(window);

    const existingJeepEl = document.querySelector('jeep-sqlite');
    const jeepEl = existingJeepEl ?? document.createElement('jeep-sqlite');
    jeepEl.setAttribute('wasmPath', './assets');

    if (!existingJeepEl) {
      document.body.appendChild(jeepEl);
    }

    await customElements.whenDefined('jeep-sqlite');

    try {
      await CapacitorSQLite.initWebStore();
      logger.info('SQLite web store initialized');
    } catch (e) {
      logger.error('Failed to initialize web store', e);
    }
  }

  try {
    if (!AppDataSource.isInitialized) {
      logger.info('Initializing application data source');
      await AppDataSource.initialize();
      logger.info('Application data source initialized');
    }
  } catch (err) {
    logger.error('Error during application data source initialization', err);
  }

  logger.info('Rendering application');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

initApp();
