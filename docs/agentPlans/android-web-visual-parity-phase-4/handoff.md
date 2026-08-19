# Android and web visual parity — Phase 4 handoff

## Repository context

- Repository: `nils-handt/teapp`
- Checkout: `/home/codex/src/teapp`
- Phase 4 branch: `agent/android-web-visual-parity-phase-4`
- Stacked base: `agent/android-web-visual-parity`
- Base work: draft PR #1, which is now scoped to Phases 1–3
- Phase 4 plan: `docs/agentPlans/android-web-visual-parity-phase-4/plan.md`
- Phase 1–3 handoff: `docs/agentPlans/android-web-visual-parity/handoff.md`
- Required workflow: `.agents/skills/visual-parity/SKILL.md`

This branch is deliberately stacked on the Phase 1–3 branch. Do not retarget it to `main` until draft PR #1 is merged or otherwise update the base without first verifying that GitHub still shows only the Phase 4 diff.

## Current status

Phase 4 is a draft and the current Android CI issue is unresolved until a new run proves otherwise.

The branch preserves the initial implementation that was removed from draft PR #1:

- API 36 runs on relevant pull requests as well as schedule/manual dispatch.
- The non-modal direct comparison changes from a 12% report-only signal to an initial blocking 5% gross-drift cap.
- `compare-modal-parity.mjs` checks the application-owned keyboard-modal panel at 5%, local geometry at 1.5 CSS px, and required-node visibility.
- Job summaries include the modal report.
- The emulator workflow includes KVM access, the API 36.1 Google APIs image, explicit disk/RAM/boot settings, and an unlock-readiness shim.
- APK installation uses bounded package-service stabilization and diagnostic retries.

These changes are working hypotheses for the hosted runner. Preserve the evidence, but remove or simplify a workaround if the reproduced failure does not require it.

## Why this is separate from draft PR #1

Draft PR #1 still has two explicit Phase 1–3 acceptance boundaries: Statistics at 2.226% and Tutorial at 4.713%. The initial 5% cap passes both, so it is useful only as a gross-drift probe and cannot establish parity completion. Keeping CI enforcement separate lets the visual ledger finish without conflating a passing threshold with accepted parity.

The Phase 1–3 branch therefore retains:

- all paired fail-closed state diagnostics;
- the History, Statistics, Tutorial, timer, and keyboard-modal root-cause fixes;
- the clean-source web/API 36/app-device reference refresh;
- the canonical mismatch ledger and current state ratios.

## Current CI investigation boundary

Treat the first run on this stacked PR as fresh evidence. Inspect the complete Android job log before editing. Determine the first failing boundary among:

1. runner KVM and emulator creation;
2. boot completion and keyguard dismissal;
3. Android package-service availability;
4. APK installation;
5. WebView/CDP readiness;
6. the real 13-state production UI journey;
7. target-repeatability or cross-runtime comparison.

Do not claim the prior series of workflow/package-service commits fixed CI until the new job succeeds twice consecutively without an intervening source or workflow change.

## Required constraints

- Use `.agents/skills/visual-parity/SKILL.md`.
- Keep web as the sole application-content visual source of truth.
- Use the production UI, deterministic fixture, Settings restore, mock-scale connection, and mock-only brewing controls.
- Keep API 36 as the primary target; API 24 remains diagnostic.
- Never update `tests/visual/baselines/unfixed`.
- Refresh references only from clean committed source and review all 13 app-content screenshots plus API 36 full-device screenshots.
- Keep OS keyboard and system chrome out of the web pixel diff while retaining full-device review evidence.
- Do not loosen thresholds to make CI pass.
- Do not claim Statistics, Tutorial, or overall parity complete from the initial 5% cap.

## Validation already associated with the preserved implementation

Before the split, local validation recorded:

- focused Tutorial, modal, and diagnostic tests passing;
- ESLint passing;
- production web and Android API 36 debug builds passing;
- all 13 web and API 36 target-specific repeatability states at 0.000% against the refreshed references;
- direct non-modal ratios below the initial 5% cap;
- modal panel crop at 2.413% with zero geometry/visibility failures at 1.5 CSS px.

This evidence validates source behavior, not hosted-runner reliability. Re-run the Phase 4-focused tests after rebasing or changing the helper/workflow, and use GitHub Actions runs as the authority for the CI issue.

## Next actions

1. Wait for draft PR #1 to finish the remaining Statistics and Tutorial acceptance work, or keep this PR explicitly stacked while that work continues.
2. Inspect the new Phase 4 PR's Android job and record the exact first failure in this handoff.
3. Apply the smallest evidence-backed CI fix and remove unrelated workaround code.
4. Run focused tests, lint, native build/asset verification, and the complete visual journey as required by the changed boundary.
5. Require two consecutive unchanged successful Android jobs.
6. Replace the initial 5% gross cap with final state-specific thresholds from the accepted Phase 1–3 ledger.
7. Update this handoff with the final workflow runs, artifact links, source revision, and threshold rationale.
