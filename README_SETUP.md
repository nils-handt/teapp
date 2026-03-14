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
