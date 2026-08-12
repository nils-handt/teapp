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
| `history-filters` | 1.638% after shared fix; diagnosed |
| `history` | 4.755% after shared fix; diagnosed |
| `statistics` | 2.243% after shared fix; next active state |
| `tutorial` | approximately 11.2% |

The History-state residuals are now measured and classified. The remaining states are still unexplained until their own ledger work is complete.

## Next active task

Continue Phase 2 with `statistics`. The `history-filters` material drift and the collapsed `history` residuals are resolved or explained in `mismatch-ledger.md`; overall parity remains incomplete.

1. Preserve the two completed History-state ledger entries and shared specificity fixes.
2. Build the `statistics` rows in the canonical `mismatch-ledger.md`.
3. Explain its remaining 2.243% direct changed pixels using geometry, computed styles, Ionic internals, fonts, charts, and winning declarations.
4. Fix and recapture the smallest affected state before expanding the next causal group.
5. Do not update the web reference or loosen thresholds to make the difference disappear.

After `statistics`, proceed in the order defined in `plan-v2.md`.

## Latest Phase 2 findings (2026-08-12)

- Both runtimes use Ionic `md`, a 411×683 layout viewport, zero safe areas, and loaded Roboto 400/500 faces for `history-filters`.
- Android injected Material component rules after the application stylesheet. Equal-specificity `.zen-list-search` and `.zen-list-surface` declarations therefore lost only in that runtime.
- Shared selectors were raised to `ion-searchbar.zen-list-search` and `ion-list.zen-list-surface`; no Android-only design fork was introduced.
- The focused `history-filters` direct diff improved from 3.797% to 1.638%, with selected computed styles equal and remaining rect deltas bounded by Android DPR/crop quantization.
- Full direct ratios also improved: `history` 5.285% → 4.755%, Settings 3.910% → 1.923%, and Statistics 5.009% → 2.243%.
- The unchanged web capture remained 0.000% different from the web reference in all 13 states.
- A complete API 36 journey succeeded after limiting native keyboard assertions to the one canonical keyboard-open modal. The first two full attempts exposed that later, uncaptured setup edits did not need OS-keyboard readiness.
- Focused collapsed-`history` capture now records header controls, content Shadow DOM, the list and six visible Ionic item internals, typography ranges, chevrons, all tab hosts/parts/icons/labels, viewport, safe area, fonts, Ionic mode, variables, and matched declarations in both runtimes.
- Collapsed `history` retains 4.755% direct changed pixels, but every counted pixel is in foreground text or icons. The broad surfaces and decorations match.
- All six visible titles have identical two-line word wrapping and equal computed typography. Their rows are locally 85.375px web versus 85.155px Android because the equal 1px inner separator quantizes to 0.761905px at DPR 2.625; the resulting −0.220px cadence accumulates down the list.
- No additional shared production CSS change is justified for collapsed `history`: the remaining differences are measured DPR/browser glyph rasterization and physical-grid border quantization, not a cascade or token mismatch.
- The tracked web, API 36 app-content, and full-device references were regenerated from committed revision `ff36509`. Web PNGs remained byte-identical; the API 36 app-content changes are the four approved shared-fix states plus the keyboard-modal crop. Historical `baselines/unfixed` files were not changed.
- `visual:compare:android:api36` now matches `history`, `history-filters`, Settings, and Statistics at 0.000% against the updated API 36 reference. This remains repeatability evidence only; the direct ratios and Phase 2 classifications still use web as the source of truth.
- The refreshed keyboard-modal app-content crop is 1080×1101 versus the prior 1080×985 because the OS keyboard dynamically resizes the WebView. An immediate repeat capture produced 1080×985 again (`innerHeight` 375 versus 419), leaving the Android repeatability report with a dimension mismatch only for this state. Its full-device screenshot was reviewed with the numeric keyboard visible; the explicit cross-runtime modal comparison strategy remains unfinished.

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
