/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path';
import fs from 'fs';

// Custom plugin to copy wa-sqlite assets
// todo not sure if this is smart, maybe there is a better way
const copySqliteAssets = () => ({
  name: 'copy-sqlite-assets',
  configureServer(_server) {
    const src = path.resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm');
    const destDir = path.resolve(__dirname, 'public/assets');
    const dest = path.join(destDir, 'sql-wasm.wasm');

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log('Copied sql-wasm.wasm to public/assets');
    } else {
      console.warn('Could not find sql-wasm.wasm at ' + src);
    }
  }
});

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