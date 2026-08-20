---
name: visual-parity
description: Run Teapp's current web-to-Android screenshot comparison and describe significant unexplained visual discrepancies. Use for visual drift, Android CSS compatibility, and visual-parity checks.
---

# Visual parity

The production web build is the visual source of truth. Use the repository's single command and its current-run artifacts; do not create test-only routes, inject database state, or use checked-in screenshot baselines.

## Run and review

1. Set `VISUAL_PARITY_DISPOSABLE_AVD` to the exact name of the dedicated disposable API 36 AVD, then run `npm run visual:parity`.
2. If it fails, stop and report the exact environment, build, asset-sync, emulator, navigation, capture, or comparison error. Do not work around its fail-closed checks.
3. Read `tmp/visual-parity/current/report.md` and `tests/visual/masterReport.md`.
4. For every material or unexplained result, inspect the paired web, Android app-content, and diff images. Use a full-device Android image only when system chrome or the keyboard matters.
5. Ignore a discrepancy only when the same state and region are narrowly documented in `masterReport.md`. Pixel counts are diagnostic evidence, not an automatic definition of significance or acceptance.
6. Describe each significant unexplained discrepancy with:
   - the state and affected region;
   - what production web shows;
   - what Android shows;
   - the direction and approximate magnitude of the difference;
   - whether it appears app-owned or system-owned;
   - the likely shared component, style, token, or build owner; and
   - why the discrepancy is not covered by an accepted entry.

Do not change source code, generated artifacts, or `masterReport.md` unless the user separately asks for a fix or approval update. Any later fix should be the smallest shared production change and must be verified by rerunning `npm run visual:parity` through the real Settings-restore and mock-scale journey.
