# Android and web visual parity

## Objective

Make the Capacitor Android app visually consistent with the production web app, then prevent unexplained drift with deterministic screenshots and reviewed visual diffs.

The mobile-sized production web build is the visual source of truth. Android system chrome is recorded separately and excluded from app-content comparisons.

## Phase 1: Capture a reproducible baseline

1. Generate restore-compatible fixture data with the existing `generate:sample-data` command.
   - Use a fixed seed for values and IDs.
   - Add a fixed `--now` option so displayed history dates are repeatable.
   - Persist mock-scale mode in the visual fixture.
2. Exercise the production UI rather than introducing test-only component routes.
   - Restore the generated backup through Settings.
   - Connect the mock scale.
   - Use the mock-scale-only Start Infusion and End Infusion controls to progress through the brewing screen.
3. Capture the same canonical states from the same commit:
   - first-run tutorial;
   - connected mock-scale settings;
   - populated history and expanded filters;
   - statistics;
   - session detail;
   - brewing idle, setup, ready, infusion, rest, and ended summary.
4. Capture the blocking parity targets in portrait orientation:
   - production web build at the Android WebView content viewport;
   - Android API 36.
5. Preserve API 24 evidence as diagnostic input, but do not let legacy-WebView compatibility block API 36 parity work.
5. Record build commit, target, viewport, device-pixel ratio, browser/WebView version, and screenshot dimensions with the artifacts.

## Phase 2: Diagnose differences

For each mismatch, capture DOM structure and computed styles from Chromium and the Android WebView. Classify it as:

- stale or incorrect bundled assets;
- Ionic mode, Shadow DOM, or component CSS-variable behavior;
- viewport, safe-area, edge-to-edge, or keyboard-resize behavior;
- fonts or text rendering;
- unsupported or differently implemented CSS;
- unlike viewport sizes or responsive breakpoints;
- a regression introduced by the Tailwind migration.

Produce a cause table containing the state, affected element, measured difference, root cause, and proposed fix. If needed, reproduce the screenshot immediately before and after the Tailwind migration commit.

## Phase 3: Fix root causes

- Prefer shared fixes over Android-only overrides.
- Make CSS custom properties the design-token source of truth.
- Style Ionic components through supported CSS variables and parts.
- Lock Ionic mode or typography only when the measurements prove a runtime difference.
- Centralize safe-area, page-shell, tab-bar, and keyboard behavior.
- Bundle a font if typography needs to be pixel-consistent.
- Add one Android build-and-sync command with asset verification to prevent stale APK contents.
- Re-run web and API 36 after every causal group is fixed.
- Only after API 36 is accepted, make an explicit Android support-policy decision:
  - keep the API 24 compatibility transforms and add a separate legacy cleanup track; or
  - raise `minSdk` to approximately API 30, remove unnecessary legacy machinery, and document the user impact.

### Support-policy decision for this PR

- Keep `minSdk 24` and the already-tested compatibility transforms for now.
- Do not use API 24 as a parity acceptance or scheduled-CI target; retain its harness command for diagnostics.
- Do not assume `minSdk 30` establishes a modern browser baseline: Android System WebView updates independently of Android, and a pinned API 30 emulator/WebView must pass the 13-state journey before compatibility code can be removed.
- Revisit the minimum version as a separate product/distribution change with an API 30 image, measured WebView user agent, user-impact review, and explicit decision to drop Android 7-10.

## Phase 4: Prevent drift

- Keep a dedicated visual test configuration and canonical state manifest in `tests/visual/`.
- Run fast web checks for UI-affecting pull requests.
- Run a current Android API 36 emulator for relevant pull requests and before releases.
- Treat API 24 as non-blocking until the minimum supported Android/WebView policy is decided; if `minSdk` is raised, replace it with the selected minimum-level smoke target.
- Start report-only, calibrate thresholds over repeated stable runs, then block unexplained differences.
- Upload expected, actual, diff, and metadata artifacts on failure.
- Require explicit review for baseline changes and mask only genuine nondeterminism or operating-system chrome.
- Pin browser, WebView, and emulator versions where practical.
- After the deterministic scripts are established, add a repo-local Codex skill that runs the capture, summarizes diffs, identifies likely source files, applies approved fixes, and repeats verification. The skill orchestrates the harness; CI remains the guardrail.

## Delivery sequence

1. Deterministic fixtures, shared capture harness, and unfixed baseline.
2. Root-cause fixes and regression baselines.
3. CI workflow, artifact reporting, documentation, and Codex skill.

## Acceptance criteria

- Every canonical state has no unexplained layout, color, spacing, typography, or Ionic-component difference.
- Captures are stable across repeated runs with identical inputs.
- The Android artifact is proven to contain the web assets from the tested commit.
- Future visual changes create a reviewable diff and cannot silently update only one runtime.
- API 36 parity is complete before any additional legacy compatibility work.
- The final PR either documents API 24 as non-blocking follow-up work or raises `minSdk` with the compatibility code simplified accordingly.
