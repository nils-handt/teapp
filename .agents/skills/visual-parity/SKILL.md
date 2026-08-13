---
name: visual-parity
description: Capture, compare, and diagnose Teapp UI screenshots across the production web build and Capacitor Android WebViews. Use for visual drift, Tailwind or Ionic styling changes, baseline updates, Android CSS compatibility, screenshot regressions, and visual-parity CI failures.
---

# Visual parity

Use the repository harness as the source of truth. Do not create component-only test routes or update references before explaining the observed change.

## Capture current output

1. Confirm the worktree state and keep unrelated edits untouched.
2. Generate the deterministic fixture with `npm run visual:fixture`.
3. For web, run `npm run build -- --configLoader native`, then `npm run visual:capture:web` and `npm run visual:compare:web`.
4. For Android, run `npm run android:build:debug`, start a disposable API 36 Pixel 2 AVD, then run `ANDROID_SERIAL=<serial> npm run visual:capture:android` and `npm run visual:compare:android:api36`. Capture uninstalls the app and changes emulator-wide display and animation settings, so do not use a personal or data-bearing AVD.
5. After API 36, run `npm run visual:compare:parity:api36` to compare its normalized app-content output directly with the web reference. The command also checks the keyboard-open setup modal through its application-owned panel crop and CSS-pixel-local geometry; review the full-device screenshot separately for the operating-system keyboard region.
6. Read `tests/visual/artifacts/diff/<target>/report.md` and inspect actual, reference, and diff PNGs for every failed state. Copy the artifact directory elsewhere before another capture or comparison if it must be retained; each run replaces its own target output.

The Android journey must restore the fixture through Settings, connect the mock scale, and use the mock-only infusion controls. Do not replace those steps with direct database writes or test-only navigation.

## Diagnose drift

Check causes in this order:

1. Run `npm run visual:verify:android-assets`; stale packaged assets invalidate Android evidence.
2. Compare viewport metrics and scroll position in each `metadata.json`.
3. Compare computed styles and verify Tailwind utilities win the intended cascade.
4. Check font loading with `document.fonts` and the Roboto network/font faces.
5. Only when investigating the separate legacy-support policy, use the API 24 diagnostic capture to check emitted syntax, runtime polyfills, and physical fallbacks for logical CSS properties. API 24 is not a parity acceptance target.
6. Check Ionic CSS variables, parts, platform mode, safe areas, keyboard resize, and Shadow DOM styles.
7. Treat DPR rasterization and OS chrome as comparison noise only after layout and computed styles match.

Raw CDP expressions sent to Chrome 69 must use Chrome-69-compatible JavaScript; do not use optional chaining in those expressions.

## Fix and verify

- Fix shared source styles or build configuration before considering target-specific CSS.
- Keep web and Android on the same generated assets and canonical state manifest.
- Re-run the smallest affected target, then the full web/API36 matrix.
- Run lint, focused tests, the production build, Android asset verification, and the Android debug build when relevant.
- Save diff artifacts needed for review outside the target output before rerunning; do not commit `tests/visual/artifacts/`.

## Update references

Only update a reference after the visual change is understood and approved. Capture from a committed source revision with no unrelated tracked changes:

- Web: `npm run visual:update:web-reference`
- Android: `ANDROID_SERIAL=<serial> npm run visual:update:android-reference`

These commands replace the selected reference target and deliberately refuse to run from a dirty source revision. Review all 13 app-content screenshots, Android device screenshots, and metadata before committing. Never overwrite `tests/visual/baselines/unfixed/`; it is historical evidence.
