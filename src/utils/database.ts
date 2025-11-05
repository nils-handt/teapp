import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader';

const db = new SQLiteConnection(CapacitorSQLite);
let connection: SQLiteDBConnection | null = null;
let initializing: Promise<SQLiteDBConnection> | null = null;

export function initializeDatabase(): Promise<SQLiteDBConnection> {
  if (connection) return Promise.resolve(connection);
  if (initializing) return initializing;

  initializing = new Promise(async (resolve, reject) => {
    try {
      const platform = Capacitor.getPlatform();
      if (platform === 'web') {
        jeepSqlite(window);
        if (!document.querySelector('jeep-sqlite')) {
          const jeepSqliteEl = document.createElement('jeep-sqlite');
          document.body.appendChild(jeepSqliteEl);
          await customElements.whenDefined('jeep-sqlite');
        }
        await db.initWebStore();
      }

      const conn = await db.createConnection('teapp.db', false, 'no-encryption', 1, false);
      await conn.open();
      connection = conn;
      initializing = null;
      resolve(connection);
    } catch (err) {
      initializing = null;
      console.error('Failed to initialize database', err);
      reject(err);
    }
  });

  return initializing;
}

export function getConnection(): SQLiteDBConnection {
  if (!connection) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return connection;
}

export function isDatabaseReady(): boolean {
  return !!connection;
}
