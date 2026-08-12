# Android and web visual parity — execution handoff

## Repository context

- Repository: `nils-handt/teapp`
- Checkout: `/home/codex/src/teapp`
- Existing branch: `agent/android-web-visual-parity`
- Existing draft PR: [#1](https://github.com/nils-handt/teapp/pull/1)
- Base branch: `main`
- Active plan: `docs/agentPlans/android-web-visual-parity/plan-v2.md`
- Archived plan: `docs/agentPlans/android-web-visual-parity/plan-v1.md`
- Required workflow: `.agents/skills/visual-parity/SKILL.md`

Continue the existing branch and PR. Do not create a replacement PR or discard the capture foundation.

## Correct objective

The production web capture is the sole visual source of truth. The Android API 36 application content must look like the corresponding web application content for all 13 canonical states.

Compare:

- expected: `tests/visual/baselines/reference/web/<state>.png`
- Android: `tests/visual/baselines/reference/android-api36/<state>.png`

Do not use `android-api36-device/` as the automated expected/actual pair. Those files contain Android-owned status bars, navigation bars, keyboards, and other system chrome and are reviewed separately.

## Honest phase status

| Phase | Status | Notes |
| --- | --- | --- |
| 1. Reproducible capture | Complete | Deterministic fixture, shared 13-state journey, mock scale, metadata, web/API 36 app captures, and Android device captures are stable. |
| 2. Diagnose differences | Incomplete | Several causes were identified, but there is no exhaustive per-state mismatch ledger or computed-style proof for remaining differences. |
| 3. Fix root causes | Partial | Some valid fixes landed, but the remaining web-to-Android differences have not been explained or eliminated. |
| 4. Prevent drift | Scaffolded | Capture, reports, CI, and a skill exist, but the direct parity check is broad and report-only rather than a tight blocking guard. |

## What has been implemented and should be preserved

- Deterministic `visual:fixture` generation with fixed seed and time.
- Fixture restore through Settings.
- Mock-scale connection and mock-only infusion controls.
- Canonical state manifest and shared UI journey.
- Raw page-level CDP Android driver and full-device/app-content screenshots.
- Android asset synchronization and byte verification.
- Stable source metadata, viewport, DPR, route, and scroll measurements.
- Historical `unfixed` screenshots and reviewed stable capture references.
- Tailwind/Ionic cascade correction.
- Bundled Roboto and font-readiness barriers.
- Native restore database lifecycle and root-location reload fixes.
- Capture stabilization for Ionic pages, tab transitions, software keyboard, and transient system dialogs.

Key commits include:

- `e13592e` — baseline capture harness
- `1888570` — initial shared root fixes
- `e5323f5` — regression workflow and skill
- `85e6eb3` — stable web and API 36 references
- `9ed9449` — archived and corrected execution plans

## Critical interpretation correction

Do not repeat the earlier conclusion that Android parity is complete.

- `npm run visual:compare:android:api36` compares Android against an Android reference. It proves only that Android capture is repeatable.
- `npm run visual:compare:web` compares web against a web reference. It proves only that web capture is repeatable.
- `npm run visual:compare:parity:api36` is the relevant cross-runtime comparison, but it currently permits 12% changed pixels, excludes `brewing-setup-modal.png`, and is report-only in CI.
- Passing the current cross-runtime command is not acceptance evidence.

The latest recorded cross-runtime ratios include:

| State | Changed pixels |
| --- | ---: |
| `history-filters` | approximately 3.8% |
| `history` | approximately 5.3% |
| `statistics` | approximately 5.0% |
| `tutorial` | approximately 11.2% |

These differences remain unexplained until measured and classified.

## Next active task

Begin Phase 2 with `history-filters`.

1. Verify the web and API 36 captures use the same fixture, route, viewport, scroll position, and Ionic mode.
2. Normalize Android physical pixels to the web CSS-pixel viewport without changing aspect ratio.
3. Build a per-element mismatch ledger using the table in `plan-v2.md`.
4. Measure bounding boxes, typography, spacing, colors, borders, radii, shadows, icons, Ionic variables/parts, and winning CSS declarations.
5. Separate real geometry/style differences from DPR rasterization only after computed styles match.
6. Propose root-cause fixes backed by the measurements.
7. Fix and recapture the smallest affected state before expanding to other states.
8. Do not update the web reference or loosen thresholds to make the difference disappear.

After `history-filters`, proceed in the order defined in `plan-v2.md`.

## Required constraints

- Use `.agents/skills/visual-parity/SKILL.md`.
- Preserve unrelated user changes.
- Use the production application UI; do not introduce direct database injection or test-only navigation.
- Use the mock scale to progress brewing states.
- Keep API 36 as the blocking target; API 24 is diagnostic and out of the active parity path.
- Prefer shared fixes over Android-only overrides.
- Do not update references until a change is understood and approved.
- Treat Android system chrome separately from app-content parity.
- Do not claim a state is complete solely from a broad image-diff percentage.
- Use subagents for bounded independent diagnosis where helpful, while keeping the mismatch ledger canonical in the main thread.

## Validation history and known issue

Previously completed validation:

- `npm run lint` passed.
- Focused tests passed: 4 files and 18 tests.
- The full sandbox run collected 287 passing tests across 41 files.
- `npm run android:build:debug` passed, including production build, Capacitor sync, 45-file asset verification, and Gradle debug APK assembly.
- Web and API 36 target-specific repeat captures were stable.

Known unrelated test-run issue:

- `npm run test:sandbox` also collects `tests/e2e/scale-reconnect.spec.ts` as Vitest and fails at line 188 because it contains Playwright `test.describe()`. Do not misreport that collection issue as a parity regression.

## Definition of done

Use the acceptance criteria in `plan-v2.md`. In particular:

- all 13 states are compared directly between web and API 36 app content;
- every material mismatch has a measured cause and resolution;
- remaining differences are limited to explained rasterization or approved system-owned regions;
- the keyboard/modal state has an explicit comparison strategy;
- the direct web-to-Android check is tight and blocking;
- a separate Android reference cannot silently legitimize drift from web.
