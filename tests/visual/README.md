# Visual parity capture

The visual-parity harness drives the real application UI with a restore-compatible seeded backup. It enables and connects the mock scale, then uses the mock-only brewing controls to reach deterministic setup, infusion, rest, and summary states.

Generate the fixture, capture the production web build, and compare it with the reviewed reference:

```bash
npm run visual:fixture
npm run build -- --configLoader native
npm run visual:capture:web
npm run visual:compare:web
```

The web command requires Playwright's Chromium browser (`npx playwright install chromium` on a new machine).

Build synchronized Android assets, then capture and compare a running emulator (capture uninstalls any existing copy, installs the APK, and launches it):

```bash
npm run android:build:debug
ANDROID_SERIAL=emulator-5554 npm run visual:capture:android
npm run visual:compare:android:api36
```

Use a disposable API 36 Pixel 2 AVD that matches the CI profile. Discover local names with `emulator -list-avds`, start one on an explicit port, and pass its `emulator-<port>` serial. Do not run the capture against a personal/data-bearing emulator: it uninstalls `com.teapp.app` and changes emulator-wide font scale, rotation, and animation settings. The API 24 compare command remains available for legacy-support diagnosis, but API 24 is not a visual-parity acceptance target while the minimum Android/WebView policy is being reconsidered.

Android capture attaches a page-level Chrome DevTools Protocol client to the debuggable Capacitor WebView through an `adb` port forward. A full Playwright browser connection is intentionally not used because Android WebViews do not expose browser-context management. The harness saves full-device screenshots and crops the reported WebView bounds into matching app-content screenshots, allowing operating-system chrome to be evaluated separately. The web reference uses the current API 36 WebView's 411 x 683 CSS-pixel content viewport.

The Android command requires `adb`. It exits nonzero when the app cannot reach a requested state, but still saves a failure screenshot and metadata. Restore must reload successfully inside the app; the harness deliberately does not force-stop or restart the Activity.

Normal captures write to ignored `tests/visual/artifacts/actual/`; diffs and reports go to `tests/visual/artifacts/diff/`. Each command replaces its own target output, so copy artifacts elsewhere before rerunning if they must be retained. Reviewed references live under `tests/visual/baselines/reference/`. Update them only with the explicit `visual:update:web-reference` and `visual:update:android-reference` commands; these replacement operations refuse dirty source revisions. The pre-fix evidence under `tests/visual/baselines/unfixed/` is immutable.

## Root-cause record

| Area | Measured cause | Fix and regression guard |
| --- | --- | --- |
| Packaged Android UI | Gradle could package ignored, previously generated Capacitor assets | `android:sync`/`android:build:debug` plus a byte-for-byte asset verification step in local and CI builds |
| Tailwind cascade | Named Tailwind layers lost to unlayered Ionic author CSS | Emit theme and utilities unlayered after Ionic while keeping Tailwind preflight omitted |
| Legacy startup | Vite 8 output and runtime APIs exceeded the API 24 emulator's Chrome 69 WebView | Legacy-plugin ESM syntax lowering, modern polyfills, and a UUID fallback; retained pending the minimum-support decision |
| Legacy spacing | Tailwind 4 logical properties such as `padding-inline` are unsupported by Chrome 69 | PostCSS physical LTR fallbacks; legacy behavior is diagnostic rather than an API 36 acceptance gate |
| Typography | Linux Chromium fell back to DejaVu while Android used Roboto | Bundle Roboto 300/400/500 Latin and wait for `document.fonts.ready` |
| Native restore | TypeORM and Capacitor kept a stale named connection; nested BrowserRouter reload broke relative asset URLs | Validate first, destroy/remove both connection layers, recover after failure, and replace native location with the origin root |
| Screenshot alignment | Browser clicks scrolled content while raw Android DOM clicks did not | Reset visible Ionic content to the top before each canonical capture |
| Android automation | Capacitor WebViews do not expose a complete browser CDP context | Use the page-level raw CDP driver and crop the WebView from the full-device PNG |

## CI policy

Pull requests that touch UI inputs run the production web capture. Android API 36 runs weekly and on manual dispatch, and gets a normalized direct comparison with the web reference via `npm run visual:compare:parity:api36`; this resizes the device-pixel capture to the web dimensions and uses a deliberately broad 12% guard against gross layout drift. The focused setup modal is excluded from the cross-runtime calculation because Android shows the operating-system keyboard; its target-specific app and full-device screenshots remain required. Pixel differences are initially report-only in CI: actual, reference, diff, and metadata artifacts are uploaded for review. Local compare commands still exit nonzero on drift. Build, capture, state-manifest, and stale-asset failures remain blocking. Tighten changed-pixel thresholds only after repeated runs establish stable target-specific noise.

Every reference must contain the 13 names in `scripts/visual/state-manifest.mjs`. Timers are captured at controlled checkpoints; Android system chrome is stored separately and excluded from app-content diffs.
