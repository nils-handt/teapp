# Android background brewing timer Live Update

## Objective

Show Teapp's current infusion or rest timer outside the app, including an Android promoted Live Update status-bar chip where the OS supports it, without showing a duplicate system timer while Teapp is foregrounded and without changing web or older-Android brewing behavior.

This is a notification projection of the existing brewing state. It is not a second timer and it does not move scale handling or brewing decisions into Android.

## Validated constraints

- A WebView cannot create the Android system status-bar chip. Teapp needs native Android notification code, reached through a small Capacitor interface. JavaScript can remain the owner of brewing state.
- An external Capacitor package would still contain native code. The currently available third-party package is too young and does not expose the Android count-up timer behavior Teapp needs, so the plan uses a focused in-repository Capacitor adapter.
- `NotificationCompat` 1.17 exposes the promoted-ongoing, short-critical-text, eligibility, and progress-style compatibility interfaces. Teapp already compiles against Android 36 and uses AndroidX 1.17 version variables, but should add an explicit `androidx.core:core:1.17.0` app dependency for this implementation.
- A promoted Live Update must be ongoing, titled, use a standard supported style, request promotion, declare `POST_PROMOTED_NOTIFICATIONS`, avoid custom `RemoteViews`, grouping, and `setColorized(true)`, and use a channel above minimum importance.
- The exact promoted-ongoing behavior is a 36.1 platform capability. Android 36 introduced related notification presentation interfaces; Android 36.0 and older must receive an ordinary notification fallback rather than being treated as chip-capable.
- A status chip's content and appearance are ultimately selected by System UI and may differ by OEM. Teapp can request phase color through normal notification color and change its monochrome icon/title, but cannot guarantee a gray versus colored chip background. Color cannot be the only phase signal.
- Android can render a count-up chronometer from an absolute start time. Teapp should send an anchor once per phase/lifecycle change, not send the current milliseconds on every 100 ms JavaScript tick.
- A foreground service would require a notification while Teapp itself is foregrounded. That conflicts with the requested foreground suppression, so it is excluded from the first implementation.

Primary platform references:

- [Create Live Update notifications](https://developer.android.com/develop/ui/views/notifications/live-update)
- [NotificationCompat.Builder](https://developer.android.com/reference/androidx/core/app/NotificationCompat.Builder)
- [NotificationManagerCompat](https://developer.android.com/reference/androidx/core/app/NotificationManagerCompat)
- [NotificationCompat.ProgressStyle](https://developer.android.com/reference/androidx/core/app/NotificationCompat.ProgressStyle)
- [Notification runtime permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission)

## Behavior matrix

| Teapp state | Foreground | Background |
| --- | --- | --- |
| Idle, setup, ready, ended, or no active session | No notification | No notification |
| Infusion timer running | No notification | Accent-colored `Infusing` notification with a count-up chronometer |
| Vessel lifted / timer paused | No notification | `Pouring` notification with the static elapsed time and an active-phase icon |
| Rest timer running | No notification | Muted `Rest` notification with a count-up chronometer |
| Notification permission denied or notifications disabled | No notification | No-op; brewing remains unaffected |

Use one stable notification ID. Phase changes update that notification in place; session end, foreground entry, logout/reset, and invalid state cancel it.

## Android compatibility matrix

| Android version | Result |
| --- | --- |
| API 24-25 | Silent conventional ongoing notification; no channel and no chip |
| API 26-32 | Silent conventional ongoing notification on a dedicated low-importance channel |
| API 33-35 | Same fallback, only after `POST_NOTIFICATIONS` is granted |
| API 36.0 | Conventional ongoing notification; do not assume promoted-chip support |
| API 36.1+ with promotion enabled | Request promoted ongoing treatment and show the system status chip when System UI accepts it |
| API 36.1+ with promotion disabled/demoted or OEM rejection | Conventional ongoing notification fallback |

Use AndroidX compatibility interfaces so class loading on API 24-35 never directly touches 36.1-only platform methods. Promotion is best effort: `canPostPromotedNotifications()` reports eligibility, but a user or OEM may still control presentation.

## Module and seam

Create one deep notification module with this TypeScript-facing interface:

```ts
type BrewingTimerNotificationSnapshot = {
  sessionId: string;
  phase: 'infusion' | 'pouring' | 'rest';
  infusionNumber: number;
  elapsedMs: number;
  running: boolean;
};

type BrewingTimerNotificationSupport =
  | 'promoted-live-update'
  | 'standard-notification'
  | 'permission-required'
  | 'disabled'
  | 'unsupported-platform';

interface BrewingTimerNotification {
  getSupport(): Promise<BrewingTimerNotificationSupport>;
  requestPermission(): Promise<BrewingTimerNotificationSupport>;
  show(snapshot: BrewingTimerNotificationSnapshot): Promise<void>;
  cancel(): Promise<void>;
}
```

The caller knows brewing semantics only. The Android adapter hides channel creation, permissions, OS/minor-version checks, notification construction, promotion rules, `PendingIntent`, icons, colors, formatting, and cancellation. A web adapter is a no-op.

Do not expose builder flags, Android API levels, notification IDs, or colors through the interface.

## Implementation plan

### 1. Define a stable brewing timer snapshot

- Add a pure selector that maps `BrewingPhase`, active session, current infusion, and `timerValue` to either the snapshot above or `null`.
- Treat infusion and rest as running, vessel-lifted as paused, and all other phases as absent.
- Derive the native chronometer anchor at the time `show` runs as `now - elapsedMs`; never mirror the existing 100 ms tick stream across the Capacitor bridge.
- Unit-test every phase, missing-session behavior, infusion numbering, elapsed-time clamping, and paused/running mapping.

### 2. Add the native Android adapter

- Add a custom Capacitor plugin under `android/app/src/main/java/com/teapp/app/` and register it in `MainActivity`.
- Add `POST_NOTIFICATIONS` and non-runtime `POST_PROMOTED_NOTIFICATIONS` manifest declarations.
- Add a dedicated silent `brewing_timer` channel at low importance, not minimum importance.
- Add proper monochrome notification drawables. Use distinct active and rest glyphs if they remain legible at status-bar size.
- Build one standard-style `NotificationCompat` notification with:
  - stable ID and content `PendingIntent` back to Teapp;
  - `setOngoing(true)`, `setOnlyAlertOnce(true)`, and silent behavior;
  - title/subtitle that state `Infusing`, `Pouring`, or `Rest` plus infusion number;
  - normal notification color set to Teapp accent for infusion/pouring and muted gray-green for rest;
  - `setRequestPromotedOngoing(true)` while preserving an ordinary notification fallback;
  - `setWhen(now - elapsedMs)`, count-up chronometer, and no per-second native update while running;
  - static short critical text for the paused pouring state.
- Do not use a custom view, `setColorized(true)`, notification grouping, sound, vibration, or a determinate progress bar. Brewing and rest have no fixed endpoint, so a determinate `ProgressStyle` would misrepresent the domain.
- Return support/permission state rather than throwing into the brewing path. Log failures and leave brewing operational.

### 3. Coordinate lifecycle and phase changes in TypeScript

- Add the official Capacitor App plugin and listen to `appStateChange`.
- While active, always cancel the system timer.
- When becoming inactive, take one current snapshot and show it if present.
- While inactive, update only when the snapshot's phase, running state, phase anchor, session, or infusion number changes. Do not update for ordinary timer ticks.
- Cancel immediately on session end/reset and reconcile once at startup to remove any stale notification.
- Keep the lifecycle controller mounted at application scope next to `useBrewingSync`, not inside the brewing screen, so navigation cannot orphan it.
- Serialize show/update/cancel operations or use a generation token so a slow background `show` cannot win after a newer foreground `cancel`.

### 4. Permission and settings UX

- Add a setting such as `Show brewing timer outside Teapp`, enabled by the user.
- Request `POST_NOTIFICATIONS` in context when the user enables it or starts the first eligible brew, never during app bootstrap.
- If denied, show one concise explanation and leave the setting off; do not repeatedly prompt.
- Report when notifications are disabled globally and, on capable devices, when promoted notifications are unavailable. A normal fallback notification remains valid, so a promotion-settings link is optional rather than blocking.
- Never request an exact-alarm permission; the system chronometer does not need one.

### 5. Bound stale-notification risk

- This first version deliberately has no foreground service. Android renders the clock independently, but phase transitions still depend on the existing WebView process and Bluetooth path remaining alive.
- Add a conservative notification timeout (recommended initial cap: six hours) and always cancel/reconcile on foreground entry and application startup. This prevents an indefinitely stale chip if Android kills Teapp while it is backgrounded.
- Document that guaranteed phase tracking after process death is out of scope. If that later becomes a requirement, first persist an authoritative phase/timer anchor and then assess a native foreground brewing module. That project would need to revisit the foreground-visibility preference because foreground services require a visible notification.

### 6. Verification

- TypeScript unit tests for snapshot mapping, lifecycle transitions, update de-duplication, operation ordering, permission denial, and the web no-op adapter.
- Native unit tests around notification specification selection for API 24, 26, 33, 36.0, and 36.1-capable states; verify the built notification has promotable characteristics where supported.
- Android instrumentation checks that foreground entry removes the notification and that background entry creates exactly one notification.
- Manual device/emulator matrix:
  - API 24: no crash and conventional fallback;
  - API 33 or 35: granted and denied notification permission paths;
  - API 36.0: fallback without assuming a chip;
  - API 36.1+ or Android 17: promoted chip, normal fallback after demotion, notification tap, screen lock, and shade expansion.
- Exercise real Teapp transitions: infusion -> vessel lifted -> infusion resumed -> rest -> next infusion -> end session. Confirm count-up continuity, paused time, phase text/icon/color, and no duplicate foreground timer.
- Verify an Android production build with the repository's native Vite config loader, Capacitor sync, and Gradle/JDK 21 path.

## Acceptance criteria

- On a promotion-capable device, leaving Teapp during infusion/rest produces one timer chip whose time follows Teapp's current phase timer.
- Returning to Teapp removes the chip/notification promptly.
- Infusion and rest remain distinguishable by text/icon and requested accent; color is treated as best effort.
- Pausing for pouring freezes the displayed elapsed time and resuming continues from the same value.
- Ending/resetting a session removes the notification.
- API 24-36.0 devices never call unsupported platform interfaces and either show the conventional fallback or no-op when permission is unavailable.
- Notification denial, demotion, OEM refusal, and bridge errors never interrupt brewing.

## Explicitly out of scope

- A native Bluetooth or brewing-state rewrite.
- Guaranteed brewing execution after process death.
- A foreground service in the first version.
- Exact reproduction of Gemini's expanded card or guaranteed chip background color; System UI owns those surfaces.
- Android 17 `MetricStyle` until Teapp intentionally adopts an Android 17 compile target and verifies the added value.
