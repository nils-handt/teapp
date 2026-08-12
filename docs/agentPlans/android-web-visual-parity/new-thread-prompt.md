# New-thread prompt

Copy the text below verbatim into the new same-project thread.

---

Continue the Android/web visual-parity work for Teapp in `/home/codex/src/teapp`.

Use the existing branch `agent/android-web-visual-parity` and continue draft PR #1. Do not create a replacement PR. If the new thread opens a separate worktree, base the continuation on `origin/agent/android-web-visual-parity` and ensure completed work is integrated back into that same PR branch.

Before taking implementation actions, read completely:

1. the applicable `AGENTS.md` instructions;
2. `.agents/skills/visual-parity/SKILL.md`;
3. `docs/agentPlans/android-web-visual-parity/plan-v2.md`;
4. `docs/agentPlans/android-web-visual-parity/handoff.md`.

`docs/agentPlans/android-web-visual-parity/plan-v1.md` is archived historical context. Do not use it as the active plan.

The corrected objective is direct visual parity: the Android API 36 app-content screenshot for every canonical state must look like the corresponding production web screenshot. The web capture is the sole visual source of truth.

Critical correction from the prior thread:

- Android-to-Android repeatability does not prove Android-to-web parity.
- `visual:compare:android:api36` is only a target repeatability check.
- The current cross-runtime comparison allows 12% changed pixels, excludes the keyboard modal, and is report-only. Passing it does not prove parity.
- Phase 1 is complete. Phase 2 is incomplete, Phase 3 is partial, and Phase 4 is only scaffolded.

Start with Phase 2 and the `history-filters` state. Compare:

- `tests/visual/baselines/reference/web/history-filters.png`
- `tests/visual/baselines/reference/android-api36/history-filters.png`

The `android-api36-device` screenshot contains operating-system chrome and is for separate manual review, not the direct app-content comparison.

For `history-filters`, produce the mismatch ledger required by `plan-v2.md`. Measure and record element bounding boxes, typography, text wrapping, spacing, colors, borders, radii, shadows, icons, Ionic mode/variables/parts, font loading, viewport/safe-area values, and the winning CSS declarations. Classify each difference and distinguish real styling/layout drift from DPR rasterization only after computed styles match.

Then propose and implement evidence-backed shared fixes. Re-run the smallest affected capture first, followed by the full web/API 36 journey when a causal group is complete. Do not update the web reference, create an Android-specific design fork, loosen thresholds, or mark a state complete merely to make a diff pass.

Use the production UI, deterministic fixture, Settings restore, mock-scale connection, and mock-only brewing controls. Keep API 36 as the blocking target; API 24 is diagnostic and outside the active parity work.

Use subagents where appropriate for bounded independent diagnosis. Keep one canonical mismatch ledger and update the tracked plan/handoff with material findings and status changes. Communicate progress regularly, preserve unrelated changes, validate in proportion to risk, commit and push completed work to the existing PR branch, and do not declare parity complete until every acceptance criterion in `plan-v2.md` is satisfied.

First report the verified current branch/worktree state and a concise Phase 2 execution plan. Then begin the `history-filters` diagnosis without asking for confirmation unless a genuinely product-changing choice is required.
