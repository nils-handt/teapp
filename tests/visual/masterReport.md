# Visual parity accepted discrepancies

This ledger records narrowly accepted differences between the current production web build and Android API 36. The generated report at `tmp/visual-parity/current/report.md` is current-run evidence; its pixel counts do not automatically accept or reject a result.

An entry applies only to the named state and region. New states, layout changes, wrapping changes, missing content, color changes, or larger geometry differences still require review.

| State | Region | Accepted discrepancy | Reason |
| --- | --- | --- | --- |
| `history-filters` | Text, icons, one-pixel borders, and panel edges | Runtime rasterization differences and physical-grid position or size deltas of approximately one CSS pixel or less | Paired inspection found equal computed typography, colors, spacing, radii, shadows, Ionic variables, and content after the shared searchbar and list-surface fixes. The remaining edges follow Android DPR and crop quantization. |
| `history` | Repeated list-row separators and subsequent row positions | Across the first six visible rows, no more than 0.25 CSS px of local height loss per row and no more than 2 CSS px of accumulated top-position drift, caused by the declared 1px Ionic separator snapping to Android's physical-pixel grid | The measured rows retained the same content, wrapping, local geometry, and computed declarations. This entry does not accept missing rows, changed text, different wrapping, a larger cadence, or an independent local offset. |
| `history` | Text, detail chevrons, and tab glyphs | Foreground antialiasing and glyph rasterization differences without content, wrapping, font, color, or icon-geometry drift | Roboto readiness, Ionic mode, computed declarations, line breaks, and icon properties matched in the paired review; the residual was localized to foreground pixels. |
| `statistics` | Text and icons in the header, period selector, summary, breakdown card, and tab bar | Foreground antialiasing and glyph or icon rasterization differences without content, wrapping, font-family, font-size, font-weight, color, or icon-geometry drift | The paired declaration audit covered 59 visible nodes per runtime and found matching Roboto readiness, Ionic mode, content, line breaks, and final computed visual properties. Broad panel and card fills do not form material mismatch regions. |
| `statistics` | Period selector, summary metric cards, and first visible breakdown ranking bar | No more than 2.1 CSS px of accumulated top-position drift and no more than 1.2 CSS px of local used-height loss in the repeated bordered regions | The declared 1px borders snap to 0.761905 CSS px on Android's 2.625-DPR physical grid, while the fractional visual viewport distributes subpixel width and position differences. This entry does not accept changed spacing declarations, an independent local offset, different wrapping, missing content, or larger drift. |
| `tutorial` | Panel, active page content, adjacent-page preview, indicators, and navigation controls | Foreground antialiasing or glyph rasterization differences and no more than 1.2 CSS px of top-position difference at the panel, viewport, active title, or footer anchors | The paired audit covered 58 nodes per runtime with matching fonts, content, line breaks, colors, and final computed styles after the shared heading and deterministic page-body fixes. This entry does not accept the former three-line heading, changed panel height, different wrapping, clipped content, or larger anchor movement. |

## Phase 3 completion

Statistics and Tutorial were explicitly approved on 2026-08-20 within the bounds above after a current 13-state run and paired artifact review. All material Phase 3 discrepancies are now fixed or narrowly accepted.

Any state, region, or difference outside this table remains unapproved. These entries do not create a broad pixel threshold or accept future layout, content, wrapping, color, or geometry regressions.
