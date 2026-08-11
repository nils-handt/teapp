# Unfixed visual baseline

This directory records the application before any parity fixes.

| Target | Result | Evidence |
| --- | --- | --- |
| Production web | Complete | 13 canonical app states at the API 36 WebView's 411 x 683 CSS-pixel viewport |
| Android API 36 | Complete | The same 13 states, plus uncropped full-device screenshots |
| Android API 24 | Startup failure | The production bundle fails in Chrome 69 with `Unexpected token =`, before Ionic mounts |

Each target directory contains cropped app-content PNGs and `metadata.json`. Android `-device` directories preserve the corresponding full screen including operating-system chrome. The Android API 24 capture intentionally exits nonzero and records `startup-failure.png`; this is baseline evidence for the root-cause PR, not a harness omission.

Native restore also exposed a separate current-runtime issue: reloading from `/tabs/settings` makes Capacitor resolve the relative production assets below `/tabs/assets`. The capture journey performs the real import, then restarts the Activity at the native origin root before continuing. The application reload behavior itself remains unfixed in this baseline.
