# Visual parity accepted discrepancies

This ledger records narrowly accepted differences between the current production web build and Android API 36. The generated report at `tmp/visual-parity/current/report.md` is current-run evidence; its pixel counts do not automatically accept or reject a result.

An entry applies only to the named state and region. New states, layout changes, wrapping changes, missing content, color changes, or larger geometry differences still require review.

| State | Region | Accepted discrepancy | Reason |
| --- | --- | --- | --- |
| `history-filters` | Text, icons, one-pixel borders, and panel edges | Runtime rasterization differences and physical-grid position or size deltas of approximately one CSS pixel or less | Paired inspection found equal computed typography, colors, spacing, radii, shadows, Ionic variables, and content after the shared searchbar and list-surface fixes. The remaining edges follow Android DPR and crop quantization. |
| `history` | Repeated list-row separators and subsequent row positions | Across the first six visible rows, no more than 0.25 CSS px of local height loss per row and no more than 2 CSS px of accumulated top-position drift, caused by the declared 1px Ionic separator snapping to Android's physical-pixel grid | The measured rows retained the same content, wrapping, local geometry, and computed declarations. This entry does not accept missing rows, changed text, different wrapping, a larger cadence, or an independent local offset. |
| `history` | Text, detail chevrons, and tab glyphs | Foreground antialiasing and glyph rasterization differences without content, wrapping, font, color, or icon-geometry drift | Roboto readiness, Ionic mode, computed declarations, line breaks, and icon properties matched in the paired review; the residual was localized to foreground pixels. |

## Still open

- `statistics`: no residual discrepancy is accepted.
- `tutorial`: no residual discrepancy is accepted.
- Any state or region not listed in the table remains unapproved.
