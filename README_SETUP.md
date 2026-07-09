# Teapp Setup Instructions

This document provides instructions for setting up the Teapp development environment.

## Installation

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Start Development Server:**
    ```bash
    npm run dev
    ```

3.  **View in Browser:**
    Open your browser and navigate to `http://localhost:5173`.

## Android Setup

1.  **Add Android Platform:**
    ```bash
    npx cap add android
    ```

2.  **Sync Web Assets:**
    ```bash
    npm run build
    npx cap sync
    ```

3.  **Open in Android Studio:**
    ```bash
    npx cap open android
    ```

## GitHub Pages Deployment

1.  **Enable GitHub Pages to use Actions:**
    In your repository settings, open `Settings > Pages` and set the source to `GitHub Actions`.

2.  **Deploy from `main`:**
    Push to `main`, or trigger the `Deploy Pages` workflow manually from the Actions tab.

3.  **Open the published app:**
    The web build is published at [https://nils-handt.github.io/teapp/](https://nils-handt.github.io/teapp/).
    Browser routes use hash URLs such as `https://nils-handt.github.io/teapp/#/tabs/history`.

## PWA / WebAPK Build

Teapp also ships as an installable Progressive Web App from GitHub Pages. On Android Chrome with Google Play services, Chrome may turn the installed PWA into a WebAPK; that packaging/signing step is controlled by Chrome, not by this repository. Browsers that do not mint WebAPKs can still install Teapp as a standalone PWA or shortcut.

*   **Native Android build:** keep using `npm run build` followed by `npx cap sync android`. This build keeps relative asset paths for Capacitor.
*   **Hosted PWA build:** use `npm run build:pwa`. This builds with the `/teapp/` base path, emits the web app manifest and service worker, and precaches the app shell plus `sql-wasm.wasm`.
*   **Deployment:** the GitHub Pages workflow runs `npm run build:pwa` automatically.
*   **Install UX:** Settings shows an `Install Teapp` action when Chrome exposes the install prompt. If the prompt is unavailable or dismissed, use the browser menu installation fallback.
*   **Offline scope:** after first load, the app shell and SQLite WASM asset should be available offline. User data remains in the existing IndexedDB-backed SQLite web store.
*   **Updates:** service-worker updates prompt in-app. Reload is deferred when an active brewing session is present.
*   **Web limitations:** Web Bluetooth remains browser- and foreground-dependent. The web build uses the Screen Wake Lock API while visible; Android native keeps using the Capacitor keep-awake plugin.

Real-device acceptance should include Android Chrome install/WebAPK behavior, standalone online/offline startup, real scale connection, wake lock while visible, persistence after relaunch, update prompt behavior, backup download, and a native Android regression check.

## Project Structure

*   `src/`: Main application source code.
    *   `components/`: Reusable React components.
    *   `models/`: Domain models (TypeScript interfaces).
    *   `repositories/`: Data access layer.
    *   `screens/`: Main screen components.
    *   `services/`: Business logic services.
    *   `stores/`: Zustand state management stores.
    *   `utils/`: Utility functions.
*   `docs/`: Project documentation.

Refer to `docs/SHORT_TERM_PLAN.md` for the development roadmap. Phase 1 establishes the basic app shell, with functionality added in subsequent phases.

## Troubleshooting

*   **Port Conflicts:** If port 5173 is in use, the development server will automatically choose a different port.
*   **SQLite Web Component:** The web build copies `sql-wasm.wasm` into `assets/` automatically for both local development and GitHub Pages deployments.
