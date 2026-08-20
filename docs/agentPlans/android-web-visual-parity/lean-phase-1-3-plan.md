# Lean Android/web visual parity — Phases 1–3

## Objective

Keep the production fixes already proven by the Android/web parity work, then reduce the supporting machinery to one current-run comparison command, one maintained discrepancy ledger, and one small agent skill.

The mobile production web build is the visual source of truth. Phase 4 is explicitly out of scope: no CI workflow, committed screenshot baseline, scheduled run, blocking threshold, or baseline-governance machinery belongs in this work.

## Scope decisions

- Retain all validated production changes and focused source tests currently in `src/`.
- Retain deterministic fixture support: fixed seed, fixed time, and mock-scale mode.
- Retain the real production UI journey: restore through Settings, connect the mock scale, and use mock-only brewing controls.
- Compare the same 13 canonical web and Android API 36 states from the current run.
- Keep Android system chrome separate from direct app-content comparison.
- Keep generated screenshots, diffs, and metadata under ignored `tmp/visual-parity/`; never commit them.
- Keep API 24 build compatibility while `minSdk 24` remains supported, but exclude API 24 from the parity command.
- Treat pixel counts as diagnostic evidence, not an automatic definition of significance or acceptance.

## Phase 1 — Lean reproducible capture

Expose exactly one package command:

```bash
npm run visual:parity
```

The command must:

1. Fail closed when required tools or dependencies are missing.
2. Require one running, boot-complete, disposable API 36 emulator and an exact-name `VISUAL_PARITY_DISPOSABLE_AVD` acknowledgment; reject physical, offline, unauthorized, wrong-API, unacknowledged, mismatched, or ambiguous targets.
3. Generate the deterministic visual fixture.
4. Build the production web application with Vite's native config loader.
5. Verify packaged Android web assets match the fresh `dist` output and fail with remediation when they are stale.
6. Build, install, and launch the debug APK.
7. Capture all 13 canonical states from web and Android through the real UI journey.
8. Compare current web app content directly with current Android app content.
9. Save current screenshots, minimal metadata, diffs, and `report.md` under `tmp/visual-parity/current/`.
10. Clean up preview and CDP resources even after failure.

Visual discrepancies do not make the command fail. Environment, build, state-integrity, capture, or report failures do.

## Phase 2 — Diagnose current discrepancies

Add `tests/visual/masterReport.md` as a short, tracked exception ledger. It records only specifically approved state/region discrepancies and their reasons. The generated report links to it but does not automatically suppress or accept pixels based on its prose.

The generated report records:

- revision and dirty-tree status;
- fixture seed and time;
- browser, WebView, emulator, viewport, DPR, route, scroll, and dimensions;
- per-state changed pixels and ratio as diagnostic data;
- links to current web, Android, full-device, and diff images;
- explicit manual-review handling for the keyboard-open modal.

No broad pass/fail pixel threshold is allowed.

## Phase 3 — Preserve and finish actual fixes

Retain the proven shared fixes for Tailwind/Ionic cascade, typography, Statistics, Tutorial, native restore/reload, UUID compatibility, keyboard resize, and deterministic brewing capture timing.

For each remaining significant discrepancy:

1. Inspect the paired screenshots and diff.
2. Identify the shared component, CSS, token, or build root cause.
3. Apply the smallest shared fix and focused source test.
4. Rerun `npm run visual:parity`.
5. Eliminate the discrepancy or add a narrowly written entry to `masterReport.md` only after explicit approval.

Statistics, Tutorial, and overall parity remain incomplete until their residuals are fixed or explicitly accepted.

## Deletion target

- Remove the visual-parity GitHub workflow and revert changes to existing workflows.
- Remove every tracked visual screenshot and baseline metadata file.
- Remove per-state computed-style/geometry diagnostic scripts and tests.
- Remove reference-update, target-repeatability, API 24 capture, threshold-enforcement, and baseline-management code.
- Remove superseded parity plans, handoffs, prompts, ledgers, and visual README files.
- Replace all newly added public visual/build package scripts with the single `visual:parity` command.
- Replace the current skill with a short run/read/inspect/describe workflow.

## Verification

- Run focused tests with `npm run test:sandbox -- ...`.
- Run lint and the production build.
- Complete one real API 36 run containing all 13 web/Android state pairs.
- Verify safe failure messages for missing ADB, wrong API, ambiguous targets, and stale Android assets.
- Confirm no PNG or generated metadata is tracked.
- Confirm no GitHub workflow diff remains.
- Confirm `package.json` exposes only one new visual command.
- Review the final diff against `origin/main` before any optional commit-history cleanup.

## Explicitly excluded Phase 4 work

- GitHub Actions visual workflows.
- Scheduled or pull-request emulator runs.
- Blocking pixel thresholds.
- Committed screenshot/reference history.
- Automatic baseline updates or approval policy.
- Hosted-emulator provisioning or retry hardening.
