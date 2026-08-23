# Android Live Update notifications for a brewing timer

Research date: 2026-08-23

Scope: Android 16 Live Updates / progress-centric notifications, timer behavior, compatibility, foreground/background behavior, and the current Capacitor API surface. Sources are first-party Android, AOSP, and Capacitor documentation. Teapp's verified timer model is elapsed count-up milliseconds in both `INFUSION` and `REST`, with `timerStartTime = Date.now() - elapsed`; it does not have a phase-end countdown.

## Bottom line

The requested Android 16 status-bar timer is feasible, but not through browser JavaScript or Teapp's existing web UI alone. Android renders the status-bar chip only for a native Android notification that the system promotes as a Live Update. Capacitor can expose that native implementation to JavaScript through an app-local plugin, but its current Local Notifications JavaScript API does not expose the Live Update, chronometer, or `ProgressStyle` fields needed here. [Capacitor describes plugins as the bridge from JavaScript to native APIs](https://capacitorjs.com/docs/plugins/creating-plugins), and its [custom Android code guide](https://capacitorjs.com/docs/android/custom-code) recommends an app-local Java/Kotlin plugin when an existing plugin does not provide a native feature.

The feature should be treated as progressive enhancement. A normal ongoing notification remains the fallback whenever the OS is older, the user has denied notification access or Live Update promotion, an OEM applies additional eligibility rules, or the system simply declines promotion.

## Live Update eligibility and promotion

Android's [Live Update guide](https://developer.android.com/develop/ui/views/notifications/live-update) says a qualifying notification must:

- use Standard, `BigTextStyle`, `CallStyle`, `ProgressStyle`, or `MetricStyle`;
- declare `android.permission.POST_PROMOTED_NOTIFICATIONS`;
- request promoted-ongoing treatment with `EXTRA_REQUEST_PROMOTED_ONGOING` or `NotificationCompat.Builder.setRequestPromotedOngoing(true)`;
- be ongoing and have a content title;
- not use custom `RemoteViews`, not be a group summary, and not call `setColorized(true)`;
- use a channel whose importance is above `IMPORTANCE_MIN`.

Meeting those characteristics is necessary, not sufficient. [`Notification.hasPromotableCharacteristics()`](https://developer.android.com/reference/android/app/Notification#hasPromotableCharacteristics()) does not account for user preferences, while [`NotificationManager.canPostPromotedNotifications()`](https://developer.android.com/reference/android/app/NotificationManager#canPostPromotedNotifications()) reports whether properly formed notifications may be promoted for the app. The system assigns `FLAG_PROMOTED_ONGOING`; applications cannot set it directly. OEMs may enforce additional criteria, and users can demote or dismiss a Live Update.

Android says Live Updates are for activities that are ongoing, user-initiated, time-sensitive, and have a distinct start and end. A brewing/rest timer appears to satisfy those criteria as an inference: the user starts it, the phase eventually ends, and the elapsed phase time is useful at a glance. The notification must be removed or converted when the activity ends. Android also says not to repost a Live Update that the user dismissed; a `deleteIntent` can record that choice. See the [usage and dismissal guidance](https://developer.android.com/develop/ui/views/notifications/live-update).

`ProgressStyle` is optional for promotion. A standard notification with a chronometer can provide the status-bar timer and is the cleanest fit for Teapp's open-ended count-up phases. `ProgressStyle` is useful only if Teapp later introduces a meaningful target/max against which to visualize progress; it should not invent a percentage for the current elapsed timer.

## Status-bar chip and timer behavior

The [Live Update status-chip documentation](https://developer.android.com/develop/ui/views/notifications/live-update#status-chips) defines these behaviors:

- A chip always contains an icon and may contain text.
- Maximum width is 96 dp. Text shorter than seven characters is shown in full, so `04:55` is an appropriate compact representation.
- `setWhen(...)` supplies the chronometer's zero/reference time. A future `when` can produce a countdown; a future time at least two minutes away is shown in a compact form such as `5min`.
- A countdown combines `setWhen(endEpochMillis)`, `setUsesChronometer(true)`, and `setChronometerCountDown(true)`, and is shown while positive. This is what the supplied screenshot resembles, but it is not Teapp's timer model.
- `setShortCriticalText()` is available for very short absolute time or state text.

[`Notification.Builder.setUsesChronometer`](https://developer.android.com/reference/android/app/Notification.Builder#setUsesChronometer(boolean)) states that Android updates the minutes and seconds automatically and may show the chronometer in a promoted notification's status-bar chip. This avoids per-second JavaScript or native notification reposts. `setChronometerCountDown` was added in API 24; `setUsesChronometer` itself was added in API 16.

For a running Teapp `INFUSION` or `REST` phase, the native notification should reconstruct the original phase start as `System.currentTimeMillis() - elapsedMs`, pass that past timestamp to `setWhen(...)`, call `setUsesChronometer(true)`, and keep `setChronometerCountDown(false)`. Android then displays the same elapsed count-up as the app. When the vessel is lifted and the timer is paused, disable/hide the chronometer timestamp and replace it with a short static elapsed value through `setShortCriticalText(...)` (and matching card text). Reposting the same notification ID with `setOnlyAlertOnce(true)` lets phase/running-state changes update content without repeatedly alerting the user. This matches Teapp's [elapsed timer](../../src/services/brewing/BrewingSessionService.ts#L1162) and [vessel-lift pause](../../src/services/brewing/BrewingSessionService.ts#L983).

## Phase-dependent appearance

[`Notification.ProgressStyle`](https://developer.android.com/reference/android/app/Notification.ProgressStyle) and its [`Segment`](https://developer.android.com/reference/android/app/Notification.ProgressStyle.Segment) and `Point` APIs allow explicit colors. Those colors are reliable for an expanded progress bar when there is a real progress model, but Teapp's current count-up timer has no max and does not need `ProgressStyle` merely to become a Live Update.

The status-bar chip is less contractually controllable:

- `Notification.Builder.setColor()` supplies an accent color, but Android's public Live Update documentation does not promise that a particular chip surface will use it.
- Live Update eligibility expressly forbids `setColorized(true)`, so a phase color must not be implemented by colorizing the whole notification.
- An AOSP SystemUI revision builds notification-chip colors from the promoted notification's computed background and primary text colors, which suggests that `setColor()` can influence the chip on AOSP builds. That is implementation evidence, not a cross-OEM API guarantee. See [`NotifChipsViewModel.kt`](https://android.googlesource.com/platform/frameworks/base/+/5e4e4a9abd183ec61c0e24961213932e339d0a56/packages/SystemUI/src/com/android/systemui/statusbar/chips/notification/ui/viewmodel/NotifChipsViewModel.kt).

Therefore, a phase color in the status-bar chip should be described and tested as best-effort across Pixel and target OEM devices. Phase text and/or an icon change should remain the non-color cue. If a future target-duration feature justifies `ProgressStyle`, its expanded bar can use explicit phase colors independently of chip behavior.

## Foreground versus background visibility

There is no public Live Update builder property that means "show only while my app is not foreground." The public documentation describes promotion and chip presentation, but does not guarantee automatic suppression while the posting app is visible.

An observed AOSP SystemUI revision even contains a TODO to avoid showing a promoted notification chip when the posting app is foreground, so this should not be relied on as current cross-device behavior. See the same [`NotifChipsViewModel.kt`](https://android.googlesource.com/platform/frameworks/base/+/5e4e4a9abd183ec61c0e24961213932e339d0a56/packages/SystemUI/src/com/android/systemui/statusbar/chips/notification/ui/viewmodel/NotifChipsViewModel.kt).

Capacitor's [`App.appStateChange`](https://capacitorjs.com/docs/apis/app#addlistenerappstatechange-) reports Android `onResume`/`onStop` transitions and could drive cancel/repost calls. For stronger lifecycle ownership, an app-local native plugin can also observe the activity lifecycle directly. The practical behavior is to cancel the timer notification when the app becomes active and post it when the app stops, reconstructing the same phase start from Teapp's elapsed milliseconds so the WebView and system chronometer agree.

The posted notification and system chronometer can outlive the WebView process. Android says cached processes can be killed at any time and, beginning with Android 13, may receive limited or no execution time until they become active again. See [Processes and app lifecycle](https://developer.android.com/guide/components/activities/process-lifecycle). That is why the displayed timer must use Android's chronometer rather than a JavaScript `setInterval`. Teapp has no time-scheduled phase boundary to wake for, so this display does not by itself require an exact alarm or foreground service.

## Permissions and user control

- Android 13/API 33 and later require the runtime `POST_NOTIFICATIONS` permission for non-exempt notifications. It applies to foreground-service notifications as well. If the user denies it, an ordinary timer notification cannot appear in the drawer. See [Notification runtime permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission).
- `POST_PROMOTED_NOTIFICATIONS` is additional to, not a replacement for, `POST_NOTIFICATIONS`. Its current [API reference](https://developer.android.com/reference/android/Manifest.permission#POST_PROMOTED_NOTIFICATIONS) classifies it as `normal|appops`; the Live Update guide calls it a non-runtime manifest permission.
- The user can disable promoted notifications for an app. `canPostPromotedNotifications()` should be checked before presenting promotion-specific UI. [`Settings.ACTION_APP_NOTIFICATION_PROMOTION_SETTINGS`](https://developer.android.com/reference/android/provider/Settings#ACTION_APP_NOTIFICATION_PROMOTION_SETTINGS) can open the relevant settings page, but Android warns that a matching activity might not exist and callers must guard that intent.
- From Android 8/API 26, every notification must use a channel. The channel must not be `IMPORTANCE_MIN` for Live Update eligibility. A dedicated low-importance, silent brewing-timer channel fits a glanceable ongoing timer without generating a heads-up alert. See [Create and manage notification channels](https://developer.android.com/develop/ui/compose/notifications/channels).

Permission denial or user demotion must not affect the in-app brewing timer. It only disables the external system presentation.

## Android-version gating and fallback

Base Android 16/API 36 added the presentation and inspection pieces:

- [`Notification.ProgressStyle`](https://developer.android.com/reference/android/app/Notification.ProgressStyle);
- [`Notification.Builder.setShortCriticalText`](https://developer.android.com/reference/android/app/Notification.Builder#setShortCriticalText(java.lang.String));
- [`Notification.FLAG_PROMOTED_ONGOING`](https://developer.android.com/reference/android/app/Notification#FLAG_PROMOTED_ONGOING);
- [`Notification.hasPromotableCharacteristics()`](https://developer.android.com/reference/android/app/Notification#hasPromotableCharacteristics());
- [`NotificationManager.canPostPromotedNotifications()`](https://developer.android.com/reference/android/app/NotificationManager#canPostPromotedNotifications()).

The current platform references label the app opt-in contract as Android 16 minor SDK 36.1: [`POST_PROMOTED_NOTIFICATIONS`](https://developer.android.com/reference/android/Manifest.permission#POST_PROMOTED_NOTIFICATIONS), `Notification.EXTRA_REQUEST_PROMOTED_ONGOING`, and [`Notification.Builder.setRequestPromotedOngoing`](https://developer.android.com/reference/android/app/Notification.Builder#setRequestPromotedOngoing(boolean)). Therefore, the app must not promise an app-requested status-bar chip merely because `SDK_INT == 36`; it should use the compatibility builder, inspect capability, and verify the actual OS/minor-SDK build.

AndroidX [`NotificationCompat.ProgressStyle`](https://developer.android.com/reference/androidx/core/app/NotificationCompat.ProgressStyle) was added in `androidx.core:core` 1.17.0 and explicitly falls back to the default notification style below API 36. The [AndroidX Core 1.17 release notes](https://developer.android.com/jetpack/androidx/releases/core#1.17.0) also identify `ProgressStyle` and `setRequestPromotedOngoing()` as the compatibility entry points.

A single `NotificationCompat.Builder` can degrade safely:

- API 36.1+ with promotion allowed: promoted Live Update, potentially including the status-bar chip and `ProgressStyle`.
- Base API 36: `ProgressStyle` is available, but the app-requested chip must not be guaranteed; retain the ordinary ongoing-notification presentation.
- API 24-35: ordinary ongoing notification with a system-updated elapsed chronometer; no Live Update chip.
- API 16-23: ordinary ongoing notification with the same elapsed chronometer; Teapp does not need the API 24 countdown mode.
- Below the app's minimum supported Android version: irrelevant by definition.

Using the same stable notification ID, title/body, content intent, ongoing flag, and non-minimum channel across these branches prevents the new feature from creating a second competing notification on older Android versions.

Android 17/API 37 adds a separate, more purpose-built expanded timer template: [`Notification.MetricStyle`](https://developer.android.com/reference/android/app/Notification.MetricStyle) can show changing metrics, and [`Notification.Metric.TimeDifference`](https://developer.android.com/reference/android/app/Notification.Metric.TimeDifference) represents a live-updated timer, stopwatch, or countdown with chronometer or adaptive formatting. Its stopwatch form directly matches Teapp's elapsed timer. AndroidX exposes these through `NotificationCompat` 1.19.0. This is a newer API 37 enhancement, not a replacement for the Android 16/older fallback described above.

## Current Teapp Android baseline

Teapp already uses `minSdkVersion` 24, `compileSdkVersion`/`targetSdkVersion` 36, and AndroidX Core 1.17.0 in [android/variables.gradle](../../android/variables.gradle). The elapsed chronometer therefore works across every supported Android version, while the Android 16 compatibility APIs are already available to native code.

The project does not currently depend on `@capacitor/app` or `@capacitor/local-notifications` in [package.json](../../package.json). Its [manifest](../../android/app/src/main/AndroidManifest.xml) declares only `INTERNET`, and [MainActivity](../../android/app/src/main/java/com/teapp/app/MainActivity.java) has no custom plugin registration. Notification permissions, channel setup, lifecycle ownership, and the Java/Kotlin bridge would all be new native integration work.

## Current Capacitor API surface

The Capacitor v8 [Local Notifications schema](https://capacitorjs.com/docs/apis/local-notifications#localnotificationschema) exposes normal notification content, icon color, grouping, channel ID, `ongoing`, and `autoCancel`. It does not expose:

- `NotificationCompat.ProgressStyle`;
- `setRequestPromotedOngoing`;
- `setWhen`, `setUsesChronometer`, or `setChronometerCountDown`;
- `setShortCriticalText`;
- `canPostPromotedNotifications` or the promoted-notification settings intent.

Its `silent` property suppresses foreground presentation only on iOS; the schema has no Android property that automatically hides a notification while the posting app is active. See the [schema's platform-specific fields](https://capacitorjs.com/docs/apis/local-notifications#localnotificationschema).

Consequently, calling the stock Capacitor Local Notifications plugin from JavaScript cannot create the requested Android Live Update. The smallest native seam is an app-local Capacitor plugin whose JavaScript API passes phase, elapsed milliseconds (or reconstructed start timestamp), running/paused state, and color/state to Kotlin/Java, where Android's notification APIs build, update, and cancel one notification. No exact-alarm permission or timer foreground service is warranted for the current count-up display.
