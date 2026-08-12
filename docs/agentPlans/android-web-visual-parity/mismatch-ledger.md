# Android and web visual parity — canonical mismatch ledger

This is the single tracked mismatch ledger for the active `plan-v2.md`. The production web reference remains the expected output. Measurements are CSS pixels unless stated otherwise.

## Capture context

| Property | Production web | Android API 36 | Classification |
| --- | --- | --- | --- |
| Source revision used by original references | `b01b10e58b445f59e51b60453aa5c608022326d3` | Same | Matching |
| Fixture | seed `visual-parity-v1`, time `2026-08-11T12:00:00.000Z` | Same, restored through Settings | Matching |
| History state | `/tabs/history`, expanded filters, scroll 0 | Same production route/state, scroll 0 | Matching |
| Layout viewport | 411×683, DPR 1 | 411×683, DPR 2.625 | Matching CSS viewport |
| Visual viewport | 411×683 | 411.429×683.429 | DPR/crop quantization; the 1080×1794 app crop is not an integer multiple of DPR |
| Safe area | 0px on all sides | 0px on all sides | Matching |
| Ionic mode | document and components use `md` | document and components use `md` | Matching |
| Font readiness | Roboto 400/500 loaded; 300 unused and unloaded | Same | Matching |

## `history-filters`

Status: material layout and styling drift resolved. The remaining 1.638% changed pixels are classified as DPR/rasterization after computed-style equality and subpixel geometry bounds were established. This does not complete Phase 2 for the other canonical states.

| Element or region | Web measurement | Android measurement before fix | Difference and category | Evidence and winning declaration | Shared fix | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Searchbar host | rect `(25,21) 261×44`; padding 0; `--background:#ffffffad`; radius 16px; shadow none; color `#243126`; placeholder `#68756a` at opacity 0.6 | rect `(24.762,20.762) 261.905×58`; padding 8px; background `#fff`; radius 2px; Material elevation shadow; color `#262626`; placeholder initial | Real Ionic cascade drift; later equal-specificity Material rule added 14px to the row | Teapp `.zen-list-search` lost to later `.sc-ion-searchbar-md-h`. Matched rules identify 8px padding, 2px radius, elevation, and Ionic palette as the winners. | Raise the shared selector to `ion-searchbar.zen-list-search`; no platform fork | Resolved: Android rect `(24.762,20.762) 261.905×44`, padding 0, and all listed variables match web |
| Search input and icon | input `(25,22) 261×42`; 16px Roboto 400, line-height 30px; icon 21×21; pill fill `rgba(255,255,255,.68)` | input inset by 8px and displaced about +6px vertically; icon and placeholder displaced +8px horizontally | Dependent geometry and palette drift from host variables; no wrapping change | Shadow/input rules consume host variables. Text and icon sizes already matched before the fix. | Same searchbar selector fix | Resolved; computed typography, fill, radius, shadow, icon color, and geometry match within physical-pixel rounding |
| Header controls | two 44×44 buttons; 16px radii; borders `rgba(93,113,90,.16)`; active fill `rgba(95,124,97,.12)` | Same size, colors, borders, radii, and icons, but vertically centered in the 58px row | Dependent +7px vertical shift | App declarations already won; computed styles matched | Searchbar height fix | Resolved |
| Filter divider/grid | top 77; width 361; gap 8; padding-top 12; border `1px solid rgba(93,113,90,.16)` | top 90.762; width 361.905; same gap/padding/color; 0.761905px physical-pixel border | Real +13.762px vertical shift plus DPR border quantization | Every grid property except physical used width matched; later positions inherited the search row height | Searchbar height fix | Resolved: Android top 76.762; residual −0.238px is DPR/crop quantization |
| Eight labels and inputs | labels 13.12px Roboto 400, muted `#68756a`, one line; inputs 361×33, 12/36px horizontal and 8px vertical padding, 4px radius, white fill, `#d9dbd2` border | Same computed styles and 60px row pitch, translated +13/14px | Dependent layout drift; no independent typography, wrapping, spacing, color, border, or radius mismatch | After vertical realignment, non-AA differing pixels per input were `0,7,0,1,0,0,0,0` | Searchbar height fix | Resolved: Android inputs start at x 24.762/y 108.762 with 361.905×32.762 physical-grid geometry versus web x 25/y 109 with 361×33 |
| Suggestion buttons/triangle icons | 36×33 cells; `#efefef` fill; `#68756a` CSS triangles | Same styles and colors, translated with inputs | Dependent shift; residual triangle edges are DPR rasterization | Computed styles match; post-fix rect deltas stay within −0.5 to +0.857px | Searchbar height fix | Resolved |
| Header surface | `(16,12) 379×559`; panel `rgba(246,250,242,.95)`; 1px border; 22px radius; `0 12px 28px rgba(69,83,66,.07)` shadow | Same top/width/style but 13px taller | Dependent height drift | Surface content height followed the searchbar | Searchbar height fix | Resolved; post-fix Android height differs by −0.714px from physical-grid rounding |
| History list surface visible below header | x 16; margin 16px; padding 0; warm `rgba(255,252,246,.86)` panel; 22px radius; Zen border/shadow | x 0; margin 0; vertical padding 8px; white background | Independent real Ionic list cascade drift | Teapp `.zen-list-surface` lost margin/padding/background to later `ion-list` and `.list-md` rules | Raise shared selector to `ion-list.zen-list-surface`; no platform fork | Resolved: Android x 16, margin 16px, padding 0, warm panel and decorations match |
| First history row | x 17, app-owned padding/typography/colors; title remains one line | Initially x 0.762 because list inset was lost | Dependent list-surface shift | `ion-item` computed app variables already matched | List selector fix | Resolved; post-fix rect deltas are under 1px; offscreen total-list height accumulates physical-grid rounding across 24 rows |
| Tab bar and icons | y 626, height 57; white background; divider `rgba(0,0,0,.07)`; Roboto 12px labels | Same app geometry and component variables | No material drift; up to 0.667px rect shift | Computed styles match | None | Explained DPR/rasterization |

### Pixel evidence

The original normalized direct comparison changed 10,659 of 280,713 pixels (3.797%). The focused post-fix comparison changes 4,599 pixels (1.638%). Exact RGBA inequality is deliberately not used to infer layout parity because antialiasing and the DPR resample affect many equal-style pixels.

The post-fix web capture remains pixel-identical to the unchanged web reference. Selected web/Android computed properties match for display, positioning, box sizing, spacing, flex/grid behavior, typography, wrapping, colors, backgrounds, borders, radii, shadows, opacity, overflow, transforms, filters, appearance, and relevant Ionic variables. Remaining element-rect deltas are normally −0.238 to +0.905px and follow the Android physical-pixel grid.

## Cause table

| Cause | Code change | Corrected states observed in full journey | Before → after direct changed pixels | Status |
| --- | --- | --- | --- | --- |
| Late Ionic Material searchbar declarations beat equal-specificity app declarations | `ion-searchbar.zen-list-search` | `history-filters`; the same shared header also benefits Statistics when expanded/used | `history-filters` 3.797% → 1.638% | Fixed and measured |
| Late `ion-list`/`.list-md` declarations beat equal-specificity app surface declarations | `ion-list.zen-list-surface` | `history`, `history-filters`, `settings-mock-scale`, `statistics` | `history` 5.285% → 4.755%; Settings 3.910% → 1.923%; Statistics 5.009% → 2.243% | Fixed; remaining mismatches in those other states require their own ledger rows |

## Validation notes

- `visual:compare:web`: all 13 states at 0.000% against the unchanged web reference.
- Focused API 36 capture through the production journey to `history-filters`: 1.638% direct changed pixels.
- Full API 36 journey: all 13 canonical states captured after the causal group.
- `visual:compare:android:api36` reports expected drift in four corrected states because its Android reference is pre-fix; it is repeatability evidence only and must not be used to reject the web-backed fix.
- `visual:compare:parity:api36` still uses the broad report-only policy and is not acceptance evidence.
