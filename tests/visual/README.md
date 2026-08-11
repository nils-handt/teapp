# Visual parity capture

The visual-parity harness drives the real application UI with a restore-compatible seeded backup. It enables and connects the mock scale, then uses the mock-only brewing controls to reach deterministic setup, infusion, rest, and summary states.

Generate the fixture and capture the production web build:

```bash
npm run visual:fixture
npm run build -- --configLoader native
npm run visual:capture:web
```

The web command requires Playwright's Chromium browser (`npx playwright install chromium` on a new machine).

Capture a built debug APK from a running emulator (the command uninstalls any existing copy, installs the APK, and launches it):

```bash
ANDROID_SERIAL=emulator-5554 npm run visual:capture:android
```

Android capture attaches a page-level Chrome DevTools Protocol client to the debuggable Capacitor WebView through an `adb` port forward. A full Playwright browser connection is intentionally not used because Android WebViews do not expose browser-context management. The harness saves full-device screenshots and crops the reported WebView bounds into matching app-content screenshots, allowing operating-system chrome to be evaluated separately. The web reference uses the current API 36 WebView's 411 x 683 CSS-pixel content viewport.

The Android command requires `adb` and ImageMagick's `magick` command. It exits nonzero when the app cannot reach a requested state, but still saves a failure screenshot and metadata. After the real restore import, the harness restarts the Activity so Capacitor reopens the imported native SQLite database from its origin root.

The first baseline intentionally records the pre-fix state under `tests/visual/baselines/unfixed/`. Do not update it while fixing parity issues; capture the corrected baseline separately so the before/after evidence remains reviewable.
