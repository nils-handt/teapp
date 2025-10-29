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
*   **SQLite Web Component:** The `jeep-sqlite` web component may require specific browser configurations to work correctly.
