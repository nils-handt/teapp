/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path';
import fs from 'fs';
import type { Plugin, ResolvedConfig } from 'vite';

const sqliteWasmName = 'sql-wasm.wasm';
const sqliteWasmSource = path.resolve(__dirname, `node_modules/sql.js/dist/${sqliteWasmName}`);

const copySqliteAssets = (): Plugin => {
  let resolvedConfig: ResolvedConfig | undefined;

  const copySqliteWasm = (destDir: string) => {
    if (!fs.existsSync(sqliteWasmSource)) {
      console.warn(`Could not find ${sqliteWasmName} at ${sqliteWasmSource}`);
      return;
    }

    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(sqliteWasmSource, path.join(destDir, sqliteWasmName));
  };

  return {
    name: 'copy-sqlite-assets',
    configResolved(config) {
      resolvedConfig = config;
    },
    configureServer() {
      copySqliteWasm(path.resolve(__dirname, 'public/assets'));
    },
    buildStart() {
      if (resolvedConfig?.command === 'build' && fs.existsSync(sqliteWasmSource)) {
        this.emitFile({
          type: 'asset',
          fileName: `assets/${sqliteWasmName}`,
          source: fs.readFileSync(sqliteWasmSource),
        });
      }
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copySqliteAssets()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  base: './',
  build: {
    sourcemap: true,
  },
  optimizeDeps: {
    include: ['@ionic/react', '@ionic/react-router', 'ionicons'],
    exclude: ['@capacitor-community/sqlite', 'jeep-sqlite']
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupMocks.ts', './src/setupTests.ts'],
    server: {
      deps: {
        inline: ['@ionic/react', '@ionic/react-router', 'ionicons', '@stencil/core', 'tslib'],
      },
    },
  }
})
