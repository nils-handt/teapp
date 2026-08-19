# Android and web visual parity — Phase 4 plan

## Scope and dependency

This plan covers only Phase 4: preventing future Android/WebView drift after the visual causes and acceptance boundaries from Phases 1–3 are complete.

- Branch: `agent/android-web-visual-parity-phase-4`
- Base branch: `agent/android-web-visual-parity`
- Dependency: draft PR #1 must finish Phases 1–3 before this stacked change is ready to merge.
- Source of truth: the production web app-content capture.
- Primary Android target: API 36 app content. Full-device screenshots remain separate evidence for Android-owned chrome and the keyboard.

The Phase 1–3 plan, ledger, and evidence remain in `docs/agentPlans/android-web-visual-parity/`. This branch must not declare Statistics, Tutorial, or overall parity complete on the strength of a broad image-diff threshold.

## Work moved from draft PR #1

The following prevention and CI work is intentionally isolated here:

- running the Android visual job for relevant pull requests;
- making the normalized web-to-API-36 comparison blocking;
- the initial 5% non-modal gross-drift cap;
- the keyboard-open modal application-panel comparator, including crop, visibility, and local-geometry checks;
- API 36 GitHub-hosted emulator acceleration, image, storage, memory, boot, unlock, APK-install, and package-service stabilization;
- CI summary and artifact behavior for the parity and modal reports;
- visual-parity skill wording that describes the enforced modal strategy.

The current implementation is retained as a draft starting point. It is not accepted until the Android GitHub Actions job completes reliably and the thresholds are justified by the final Phase 1–3 ledger.

## Phase 4.1 — Freeze the comparison contract

1. Import the final per-state classifications from the Phase 1–3 mismatch ledger.
2. Keep web app-content screenshots as expected output and normalized API 36 app-content screenshots as actual output.
3. Replace the initial broad 5% cap with the tightest justified state-specific boundaries after Statistics, Tutorial, and all other open residuals are settled.
4. Keep target-specific web-to-web and Android-to-Android comparisons as repeatability diagnostics, never parity evidence.
5. Keep the keyboard-open setup modal explicit:
   - compare the application-owned panel crop;
   - assert panel/title/body/input/actions visibility;
   - compare local CSS-pixel geometry;
   - review the Android-owned keyboard and system region only through the full-device screenshot.
6. Do not add masks or exclusions without a ledger entry proving that the region is system-owned or genuinely nondeterministic.

## Phase 4.2 — Make the Android CI runtime reliable

1. Reproduce the current GitHub Actions Android failure from the new stacked PR and retain the complete job log.
2. Classify the failure before changing the workflow: emulator provisioning, boot/unlock readiness, package-manager availability, APK installation, WebView/CDP readiness, capture journey, or comparison.
3. Keep Java 21, the production native build, Capacitor sync, and Android asset verification in the CI path.
4. Validate the selected API 36 image and hardware-acceleration settings on GitHub-hosted runners.
5. Require bounded readiness checks for boot, unlock, package services, and APK installation; fail with the last relevant `adb`/service diagnostics rather than waiting indefinitely.
6. Remove any workaround that is not required by the reproduced failure.
7. Prove reliability with at least two consecutive unchanged successful Android workflow runs before calling the CI issue fixed.

## Phase 4.3 — Enforce and report drift

1. Run the web job for UI-affecting pull requests.
2. Run the API 36 job for the same relevant pull requests, schedules, and manual dispatches.
3. Fail the selected check on unexplained cross-runtime drift while retaining target-repeatability reports as secondary evidence.
4. Add web expected, Android actual, normalized diff, metadata, and modal report summaries to the job output.
5. Upload app-content and full-device evidence even when capture or comparison fails, when artifacts exist.
6. Make missing required app-content artifacts an error; document any intentionally optional failure artifact.

## Phase 4.4 — Govern reference changes

1. Keep `tests/visual/baselines/unfixed` immutable.
2. Refresh `tests/visual/baselines/reference` only from a clean committed source revision using the visual-parity skill workflow.
3. Require review of all 13 web app-content, API 36 app-content, and API 36 full-device screenshots for an intentional UI change.
4. Record source revision and review status in the tracked handoff and ledger.
5. Ensure a separate Android reference cannot silently legitimize drift from web.

## Validation matrix

- focused comparator and Android install-helper tests;
- full sandbox test suite, accounting for any separately documented Playwright collection issue;
- ESLint and production native build;
- Android asset verification and API 36 debug APK assembly;
- complete 13-state web and API 36 journeys;
- target-specific repeatability comparisons;
- direct web-to-API-36 comparison with final per-state policy;
- focused keyboard-open modal crop/geometry/visibility comparison;
- review of all API 36 full-device screenshots;
- at least two consecutive unchanged successful GitHub Actions Android runs.

## Acceptance criteria

Phase 4 is complete only when:

- Phases 1–3 have an accepted ledger with no unexplained material mismatch;
- the direct API 36 comparison is a reliable blocking check for relevant pull requests;
- every enforced tolerance is derived from an accepted state-specific boundary rather than the initial gross cap;
- the modal application region is enforced while Android-owned keyboard pixels remain separately reviewable;
- required reports and screenshots are available on success and failure paths;
- intentional reference changes are clean-source, revision-tracked, and explicitly reviewed;
- the Android job has completed successfully twice in succession without a source or workflow change;
- no documentation claims Statistics, Tutorial, or overall parity complete before the Phase 1–3 evidence supports it.
