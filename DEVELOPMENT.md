# Developing Teapp

This guide contains the contributor and maintainer information for Teapp. The user-facing overview and brewing instructions live in [README.md](README.md).

## Prerequisites

- Node.js 24.11 or newer
- npm
- Android Studio, an Android SDK, and a compatible JDK for native Android work

## Local setup

Install dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Vite serves the app at `http://localhost:5173` by default. If that port is already in use, Vite automatically uses another available port.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server. |
| `npm run build` | Type-check and create the Capacitor-oriented web build. |
| `npm run build:pwa` | Type-check and create the hosted PWA build. |
| `npm test -- <paths>` | Run all Vitest tests or the specified test files. |
| `npm run lint` | Run ESLint with warnings treated as errors. |
| `npm run generate:sample-data -- [options]` | Create an importable development backup. |

## Android development

The native Android version is not actively maintained. Current development focuses on the hosted web app and its PWA/WebAPK installation.

The Android platform project remains checked into `android/`. To work on it, build the web assets, synchronize them, and open the native project with:

```bash
npm run build
npx cap sync android
npx cap open android
```

The normal build uses relative asset paths for Capacitor. Do not use the PWA build as the source for the native application.

## PWA and GitHub Pages

The hosted build is an installable PWA deployed to [nils-handt.github.io/teapp](https://nils-handt.github.io/teapp/).

```bash
npm run build:pwa
```

PWA mode uses the `/teapp/` base path and generates the manifest and service worker. It precaches the application shell and the SQLite WASM asset. User data is persisted in the browser's local SQLite/IndexedDB store.

The `Deploy Pages` workflow in `.github/workflows/deploy-pages.yml` builds and publishes the PWA after a push to `main`, and it can also be started manually. GitHub Pages must be configured to use **GitHub Actions** as its source.

When testing the web build on a real device, cover installation, online and offline startup, BOOKOO scale connection, foreground/wake-lock behavior, persistence after relaunch, update prompts, and backup download.

## Development sample data

Generate a full backup that can be imported through **Settings → Data Management → Restore Data**:

```bash
npm run generate:sample-data -- --sessions 100 --teas 12 --vessels 4 --seed demo --output ./tmp/sample-data.json
```

Generated sessions are completed, linked to generated tea records, and populated with randomized infusions. Tea metadata comes from the preset arrays in `scripts/generate-sample-dataset.mjs`.

The `--seed` option makes values and IDs repeatable; timestamps are based on the generation time. Omit the seed for a new random dataset. Restore overwrites the current database, so use this only with development data.

## Bluetooth scale integration

Bluetooth protocol implementations live in `src/services/bluetooth/`. `BluetoothScale` provides shared behavior, device-specific classes implement each protocol, and `BleAdapter` wraps `@capacitor-community/bluetooth-le`. RxJS subjects carry weight, timer, and flow events.

The implementations were ported and adapted from the open-source [Beanconqueror](https://github.com/graphefruit/Beanconqueror) project. Thanks to its maintainers for the protocol work.

Only BOOKOO scales are confirmed to work with Teapp. Other device classes in the repository are unverified, even when their protocol implementation is present. Do not describe them as supported until they have passed real-device testing.

To add or validate a scale:

1. Extend `BluetoothScale` with the device-specific BLE protocol.
2. Register the implementation in `src/services/bluetooth/index.ts`.
3. Use the logger in `src/services/bluetooth/utils/Logger.ts` while diagnosing protocol behavior.
4. Add automated coverage where possible and complete a real-device brewing test before marking the scale as verified.

## Project structure

- `src/components/` — reusable UI components
- `src/database/` — TypeORM/SQLite setup and migrations
- `src/entities/` — persisted domain entities
- `src/repositories/` — data access
- `src/screens/` — Ionic application screens
- `src/services/` — brewing, Bluetooth, backup, PWA, and platform services
- `src/stores/` — Zustand application state
- `src/utils/` — shared utilities
- `tests/e2e/` — Playwright scenarios
- `scripts/` — development utilities
- `docs/` — architecture, requirements, planning, and recordings
- `android/` — Capacitor Android project

## Technical overview

Teapp is built with React, Ionic, Capacitor, TypeScript, Vite, Zustand, TypeORM, and SQLite. Native Android uses the Capacitor Bluetooth and keep-awake plugins. The hosted app uses Web Bluetooth, the Screen Wake Lock API, and an IndexedDB-backed SQLite store.

Additional project documents:

- `docs/ARCHITECTURE.md` — architecture background
- `docs/FEATURES.md` — feature requirements and ideas
- `docs/USER_STORIES.md` — user scenarios
- `docs/SHORT_TERM_PLAN.md` — short-term planning
- `docs/LONG_TERM_PLAN.md` — longer-term planning

These documents are design and planning references; verify current behavior in the application and source before relying on them as implementation status.

## Troubleshooting

- **SQLite WASM errors:** confirm `node_modules/sql.js/dist/sql-wasm.wasm` exists. The Vite plugin copies it to `assets/` for local development and emits it during builds.
- **Bluetooth problems in the hosted app:** use a Chromium-based browser, confirm the page has Bluetooth permission, and keep Teapp in the foreground.
- **PWA updates:** Teapp prompts when an update is ready and defers reload while a brewing session is active.
