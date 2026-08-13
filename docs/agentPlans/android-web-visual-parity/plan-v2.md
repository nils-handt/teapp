# Android and web visual parity — execution plan v2

## Why this plan supersedes v1

The first execution established deterministic screenshots and fixed several real build and runtime defects, but it incorrectly treated Android-to-Android repeatability as proof of Android-to-web visual parity.

This plan restores the original objective and makes the production web screenshot the sole visual source of truth. `plan-v1.md` is retained unchanged as the historical plan.

## Objective

Make the app content rendered by the Capacitor Android API 36 WebView visually consistent with the mobile-sized production web app for every canonical screenshot state.

In practical terms, each pair below must show the same application UI after normalizing physical pixels to CSS pixels:

- `tests/visual/baselines/reference/web/<state>.png`
- `tests/visual/baselines/reference/android-api36/<state>.png`

Files under `android-api36-device/` contain Android status bars, navigation bars, keyboards, and other operating-system chrome. They are reviewed separately and are not direct pixel-comparison inputs.

## Definition of visual parity

Parity means that the corresponding web and Android app-content captures have:

- matching layout geometry and responsive breakpoint behavior;
- matching spacing, padding, alignment, borders, radii, shadows, and colors;
- matching font family, weight, size, line height, wrapping, and truncation;
- matching Ionic component mode, CSS variables, parts, and state;
- matching icons and application-owned controls;
- no unexplained per-state visual difference.

Device-pixel ratio and browser rasterization may produce small antialiasing differences. Those differences may be tolerated only after layout and computed-style equality are demonstrated. A broad changed-pixel threshold is not a substitute for diagnosis.

## Current state as of 2026-08-12

### Complete and reusable

- A deterministic sample-data fixture with fixed seed and time.
- Fixture restore through the production Settings UI.
- Mock-scale connection and mock-only controls for deterministic brewing navigation.
- A canonical 13-state journey shared by web and Android.
- Stable web, Android app-content, and Android full-device capture artifacts.
- Metadata for revision, viewport, DPR, user agent, route, and scroll position.
- Android build/sync asset verification.
- Target-specific repeatability checks.
- Historical pre-fix evidence and stable API 36 captures.
- Web and API 36 references recaptured from committed revision `da1054775d77da098f1806630046d5bd8a437194` after the approved Statistics capture/tab and Tutorial heading fixes; all 13 web app-content, Android app-content, and Android full-device screenshots were reviewed, and `baselines/unfixed` remains unchanged.

### Partially complete but not accepted as parity

- Tailwind/Ionic cascade ordering was corrected.
- Roboto was bundled and font readiness was added.
- Native restore connection and reload defects were corrected.
- Android automation timing, tab-transition, keyboard, and system-dialog races were stabilized.

These are valid fixes, but the remaining cross-runtime differences have not been exhaustively measured or explained.

### Incomplete

- A per-state, per-element mismatch ledger.
- Computed-style and geometry evidence for every remaining mismatch.
- Root-cause fixes for all remaining web-to-Android differences.
- A tight, blocking cross-runtime regression check.
- CI that fails when Android drifts from the web source of truth.

### Current misleading checks to avoid

- `visual:compare:android:api36` compares Android with its own Android reference. It proves repeatability, not parity.
- `visual:compare:parity:api36` currently allows 12% changed pixels, excludes the setup modal, and is report-only in CI. It is only a gross-drift signal.
- The current cross-runtime report still accepts unexplained differences including approximately 3.8% for history filters, 5.3% for history, 5.0% for statistics, and 11.2% for the tutorial.

## Phase 1: Preserve and verify the capture foundation

Status: complete. Re-run only when capture code, fixture generation, browser/WebView versions, or canonical states change.

1. Keep the 13 canonical state names in one manifest.
2. Build and sync the exact source revision before Android capture.
3. Restore the deterministic fixture through Settings.
4. Connect the mock scale and navigate brewing using the mock-only controls.
5. Record app-content and full-device screenshots separately.
6. Refuse reference updates from a dirty source revision.

## Phase 2: Diagnose web-to-Android differences

Status: active.

Progress through 2026-08-13: `history-filters` and collapsed `history` have complete measured entries in `mismatch-ledger.md`. Two shared late-Ionic cascade causes were fixed. The remaining pixels in both states were classified as DPR/rasterization only after computed-style, Shadow DOM, typography, wrapping, and local-geometry equality were established. The user-reported Statistics hover/tab regression group and Tutorial heading regression were then diagnosed and fixed without reverting the shared cascade or the preferred time-range selector. A paired visible Statistics declaration audit found no independent computed-style drift and measured accumulated physical-grid offsets, but Statistics remains explicitly in progress rather than being accepted from its 2.226% report. Tutorial retains an unexplained runtime offset, and the later states remain pending.

### 2.1 Establish an apples-to-apples comparison

1. Use the web reference as expected output.
2. Use Android API 36 app-content output as actual output.
3. Normalize Android physical pixels to the web CSS-pixel viewport without changing aspect ratio.
4. Verify that both captures represent the same route, scroll position, fixture state, Ionic mode, and viewport dimensions.
5. Keep full-device screenshots for safe-area, system-bar, and keyboard review only.

### 2.2 Create a mismatch ledger

For every canonical state, record:

| State | Element or region | Web measurement | Android measurement | Difference | Root-cause category | Evidence | Proposed fix | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Measure at least:

- bounding boxes and relative positions;
- computed font properties and text wrapping;
- computed margin, padding, gap, width, and height;
- background, border, radius, shadow, and opacity;
- Ionic mode, classes, CSS variables, and relevant Shadow DOM parts;
- loaded font faces and font readiness;
- safe-area and viewport values;
- the winning CSS declaration for every differing property.

### 2.3 Diagnose in a fixed order

1. Stale or unlike packaged assets.
2. Unlike viewport, scale, scroll, or responsive breakpoint.
3. Font loading, metrics, line wrapping, and rasterization.
4. Tailwind/Ionic cascade and design-token values.
5. Ionic platform mode, CSS variables, parts, and Shadow DOM.
6. Safe areas, edge-to-edge layout, keyboard resize, and system chrome.
7. Browser/WebView CSS support or rendering differences.
8. Genuine antialiasing noise, only after the preceding causes are excluded.

### 2.4 Work state by state

Start with `history-filters`, because it exposes page shell, search controls, Ionic inputs, typography, spacing, and tab-bar behavior in one state. `history-filters` and `history` are now diagnosed. Proceed through:

1. statistics;
2. tutorial;
3. settings with mock scale;
4. session detail;
5. brewing idle;
6. brewing setup;
7. brewing ready;
8. brewing infusion;
9. brewing rest;
10. brewing ended;
11. brewing setup modal and keyboard behavior.

Do not mark a state complete because its changed-pixel ratio is below a broad threshold. Mark it complete only when every material difference is fixed or explicitly explained.

## Phase 3: Fix root causes

Status: partial. The two shared History-surface cascade fixes, the Statistics capture/tab fixes, and the shared Tutorial heading correction are complete. Remaining state-wide diagnosis and resulting fixes are pending.

For each validated cause:

1. Prefer a shared CSS, component, token, or build fix.
2. Use Android-specific CSS only when the platform genuinely requires different safe-area or system integration behavior.
3. Keep production web output unchanged unless the web rendering is itself incorrect.
4. Rebuild and recapture the smallest affected state.
5. Compare Android directly with web.
6. Re-run all 13 states after completing a causal group.
7. Add focused tests for deterministic logic or build behavior where appropriate.
8. Do not update the web source-of-truth reference merely to make a mismatch disappear.

Maintain a cause table linking each code change to the states and measured properties it corrects.

## Phase 4: Prevent future drift

Status: infrastructure exists, enforcement is incomplete.

1. Make the normalized web-to-Android comparison the primary parity check.
2. Calibrate a tight tolerance only after all known differences are classified.
3. Fail CI on unexplained layout, typography, color, spacing, or component differences.
4. Keep target-specific repeatability checks as secondary diagnostics.
5. Run web capture for UI-affecting pull requests.
6. Run API 36 capture for relevant pull requests or a required pre-merge workflow, not only as an optional report.
7. Upload web expected, Android actual, normalized diff, metadata, and full-device screenshots.
8. Require explicit review for intentional web reference changes.
9. Permit masks or exclusions only for identified operating-system-owned or genuinely nondeterministic regions.
10. Treat the keyboard-open setup modal explicitly: compare application-owned modal content and review the Android keyboard/system region separately rather than silently excluding the entire state.
11. Update the repo-local visual-parity skill so it cannot describe target repeatability as cross-runtime parity.

## Acceptance criteria

The work is complete only when:

- all 13 canonical web and API 36 app-content states have been compared directly;
- every material mismatch has a recorded cause and resolution;
- layout and computed styles match within an explicitly documented CSS-pixel tolerance;
- remaining changed pixels are limited to explained rasterization noise or approved system-owned regions;
- the keyboard/modal state has an explicit comparison strategy;
- the Android artifact is verified to contain the tested web assets;
- the direct web-to-Android comparison is blocking for the selected CI workflow;
- an intentional web design change produces a reviewable Android parity diff;
- no separate Android reference can silently legitimize drift from the web source of truth.

## Android support policy

API 36 is the blocking visual-parity target. API 24 remains diagnostic and must not delay completion of API 36 parity.

Keep the current `minSdk` and compatibility transforms in this work unless a separate, explicit product decision selects a new minimum Android version and validates its pinned WebView with the same 13-state journey.

## Delivery sequence from the current branch

1. Commit this corrected plan and an execution handoff.
2. Correct the draft PR description so it states that Phase 1 and infrastructure are complete while parity fixes remain in progress.
3. Begin Phase 2 with the `history-filters` mismatch ledger.
4. Continue Phase 2 with `history`; fix and validate one causal group at a time.
5. Tighten and enable the blocking parity workflow only after the visual differences are understood.
6. Recapture and review final Android output against the unchanged web source of truth.
