---
name: visual-parity
description: Run Teapp's current web-to-Android screenshot comparison and describe significant unexplained visual discrepancies. Use for visual drift, Android CSS compatibility, and visual-parity checks.
---

# Visual parity

The production web build is the visual source of truth. Use the repository's single command and its current-run artifacts; do not create test-only routes, inject database state, or use checked-in screenshot baselines.

## Run and review

1. Prepare fresh Android assets:
   - Run `npm run build -- --configLoader native`.
   - Run `npx cap sync android` only after that build succeeds.
   - Stop and report the exact build or sync error if either command fails.
2. Resolve the dedicated disposable target:
   - Inspect `adb devices -l`. Reuse the only attached target only when it is an online, boot-complete API 36 emulator.
   - When no target is attached, inspect `emulator -list-avds`. If `Teapp_API_36_1` exists, start it in a long-lived foreground execution cell with `emulator -avd Teapp_API_36_1 -no-window -noaudio -no-boot-anim -no-snapshot -gpu swiftshader_indirect`, then wait until `sys.boot_completed` is `1`.
   - Record its serial and reported AVD name. Reject physical devices, arbitrary personal AVDs, wrong APIs, offline targets, and ambiguous target sets.
3. Prepare Playwright Chromium without altering the host:
   - Resolve Chromium with `node -e "import('playwright').then(({chromium}) => process.stdout.write(chromium.executablePath()))"` and inspect it with `ldd`.
   - If libraries are missing and `tmp/playwright-deps/root/usr/lib/x86_64-linux-gnu` exists, prepend that absolute directory to `LD_LIBRARY_PATH` for the parity command. If required libraries remain unavailable, stop and report them.
4. Run `npm run visual:parity` with `ANDROID_SERIAL` set to the resolved serial and `VISUAL_PARITY_DISPOSABLE_AVD` set to the exact reported AVD name. Preserve the prepared `LD_LIBRARY_PATH` when needed.
5. After the parity command exits, stop the emulator with `adb -s <serial> emu kill` only when this run started it. Leave a pre-existing target running.
6. If the command failed, stop and report the exact environment, build, asset-sync, emulator, navigation, capture, or comparison error. Keep its fail-closed checks intact.
7. Read `tmp/visual-parity/current/report.md` and `tests/visual/masterReport.md`.
8. For every material or unexplained result, inspect the paired web, Android app-content, and diff images. Use a full-device Android image only when system chrome or the keyboard matters.
9. Ignore a discrepancy only when the same state and region are narrowly documented in `masterReport.md`. Pixel counts are diagnostic evidence, not an automatic definition of significance or acceptance.
10. Describe each significant unexplained discrepancy with:
   - the state and affected region;
   - what production web shows;
   - what Android shows;
   - the direction and approximate magnitude of the difference;
   - whether it appears app-owned or system-owned;
   - the likely shared component, style, token, or build owner; and
   - why the discrepancy is not covered by an accepted entry.

Apart from the required build, Capacitor sync, and ignored current-run output, do not change source code or `masterReport.md` unless the user separately asks for a fix or approval update. Any later fix should be the smallest shared production change and must be verified by rerunning `npm run visual:parity` through the real Settings-restore and mock-scale journey.
