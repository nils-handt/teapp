package com.teapp.app.brewingtimer;

import android.Manifest;
import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "BrewingTimerNotification",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public final class BrewingTimerNotificationPlugin extends Plugin {
    private static final String TAG = "BrewingTimerNotif";

    @Override
    public void load() {
        BrewingTimerNotificationFactory.createChannel(getContext());
        recordLifecycle("plugin-loaded");
    }

    @PluginMethod
    public void getSupport(PluginCall call) {
        resolveSupport(call);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || permissionGranted()) {
            resolveSupport(call);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        resolveSupport(call);
    }

    @PluginMethod
    public void prepare(PluginCall call) {
        JSObject snapshotObject = call.getObject("snapshot");
        if (snapshotObject == null) {
            boolean cleared = BrewingTimerPreparedSnapshotStore.clear(getContext());
            BrewingTimerForegroundService.stop(getContext());
            NotificationManagerCompat.from(getContext()).cancel(BrewingTimerNotificationFactory.NOTIFICATION_ID);
            record("foreground-service-preparation-cleared", new JSObject().put("persisted", cleared));
            call.resolve();
            return;
        }

        try {
            BrewingTimerPreparedSnapshot snapshot = preparedSnapshot(snapshotObject, System.currentTimeMillis());
            boolean persisted = BrewingTimerPreparedSnapshotStore.save(getContext(), snapshot);
            JSObject details = new JSObject();
            details.put("sessionId", snapshot.sessionId());
            details.put("phase", snapshot.phase());
            details.put("infusionNumber", snapshot.infusionNumber());
            details.put("running", snapshot.running());
            details.put("persisted", persisted);
            record("foreground-service-prepared", details);
        } catch (IllegalArgumentException exception) {
            Log.w(TAG, "Ignoring an incomplete brewing timer preparation", exception);
            recordFailure("foreground-service-preparation-rejected", exception);
        }
        call.resolve();
    }

    @PluginMethod
    public void show(PluginCall call) {
        BrewingTimerNotificationSupport support = currentSupport();
        if (
            support == BrewingTimerNotificationSupport.PERMISSION_REQUIRED ||
            support == BrewingTimerNotificationSupport.DISABLED ||
            support == BrewingTimerNotificationSupport.UNSUPPORTED_PLATFORM
        ) {
            call.resolve();
            return;
        }

        try {
            BrewingTimerPreparedSnapshot snapshot = preparedSnapshot(call.getData(), System.currentTimeMillis());
            BrewingTimerPreparedSnapshotStore.save(getContext(), snapshot);
            BrewingTimerNotificationSpec spec = snapshot.notificationSpec(System.currentTimeMillis());
            BrewingTimerNotificationFactory.createChannel(getContext());
            android.app.Notification notification = BrewingTimerNotificationFactory.build(getContext(), spec);
            recordNotification("notification-built", notification, support, false);
            boolean serviceStartRequested = BrewingTimerForegroundService.start(getContext());
            if (!serviceStartRequested) {
                NotificationManagerCompat.from(getContext()).notify(
                    BrewingTimerNotificationFactory.NOTIFICATION_ID,
                    notification
                );
                record("notification-service-fallback-posted", new JSObject());
            }
            recordActiveNotification("notification-posted", support);
            new Handler(Looper.getMainLooper()).postDelayed(
                () -> recordActiveNotification("notification-promotion-observed", currentSupport()),
                750L
            );
        } catch (IllegalArgumentException | SecurityException exception) {
            Log.w(TAG, "Unable to show brewing timer notification", exception);
            recordFailure("notification-show-failed", exception);
        } catch (RuntimeException exception) {
            Log.e(TAG, "Unexpected brewing timer notification failure", exception);
            recordFailure("notification-show-failed", exception);
        }
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        try {
            recordActiveNotification("notification-before-cancel", currentSupport());
            BrewingTimerForegroundService.stop(getContext());
            NotificationManagerCompat.from(getContext()).cancel(BrewingTimerNotificationFactory.NOTIFICATION_ID);
            record("notification-cancelled", new JSObject());
        } catch (RuntimeException exception) {
            Log.w(TAG, "Unable to cancel brewing timer notification", exception);
            recordFailure("notification-cancel-failed", exception);
        }
        call.resolve();
    }

    @PluginMethod
    public void drainDiagnostics(PluginCall call) {
        call.resolve(BrewingTimerDiagnostics.drain(getContext()));
    }

    @Override
    protected void handleOnResume() {
        BrewingTimerForegroundService.stop(getContext());
        NotificationManagerCompat.from(getContext()).cancel(BrewingTimerNotificationFactory.NOTIFICATION_ID);
        recordLifecycle("activity-resumed");
    }

    @Override
    protected void handleOnPause() {
        recordLifecycle("activity-paused");
    }

    @Override
    protected void handleOnStop() {
        recordLifecycle("activity-stopped");
        BrewingTimerPreparedSnapshot snapshot = BrewingTimerPreparedSnapshotStore.load(getContext());
        BrewingTimerNotificationSupport support = currentSupport();
        if (
            snapshot != null &&
            support != BrewingTimerNotificationSupport.PERMISSION_REQUIRED &&
            support != BrewingTimerNotificationSupport.DISABLED &&
            support != BrewingTimerNotificationSupport.UNSUPPORTED_PLATFORM
        ) {
            boolean requested = BrewingTimerForegroundService.start(getContext());
            record("foreground-service-background-start-requested", new JSObject().put("requested", requested));
        } else {
            JSObject details = new JSObject();
            details.put("preparedSnapshot", snapshot != null);
            details.put("support", support.bridgeValue());
            record("foreground-service-background-start-skipped", details);
        }
    }

    private BrewingTimerPreparedSnapshot preparedSnapshot(JSObject data, long nowEpochMillis) {
        String sessionId = data.getString("sessionId");
        String phase = data.getString("phase");
        Integer infusionNumber = data.getInteger("infusionNumber");
        double elapsedMillis = data.optDouble("elapsedMs", Double.NaN);
        Boolean running = data.getBool("running");
        if (
            sessionId == null ||
            sessionId.trim().isEmpty() ||
            phase == null ||
            infusionNumber == null ||
            !Double.isFinite(elapsedMillis) ||
            running == null
        ) {
            throw new IllegalArgumentException("Incomplete brewing timer snapshot");
        }
        return BrewingTimerPreparedSnapshot.from(
            sessionId,
            phase,
            infusionNumber,
            (long) elapsedMillis,
            running,
            nowEpochMillis
        );
    }

    private void resolveSupport(PluginCall call) {
        BrewingTimerNotificationSupport support = currentSupport();
        JSObject details = commonDetails();
        details.put("support", support.bridgeValue());
        record("support-evaluated", details);
        JSObject result = new JSObject();
        result.put("support", support.bridgeValue());
        call.resolve(result);
    }

    private BrewingTimerNotificationSupport currentSupport() {
        NotificationManagerCompat manager = NotificationManagerCompat.from(getContext());
        boolean promotedAllowed = Build.VERSION.SDK_INT >= 36 && manager.canPostPromotedNotifications();
        return BrewingTimerNotificationSupport.determine(
            Build.VERSION.SDK_INT,
            permissionGranted(),
            manager.areNotificationsEnabled(),
            promotedAllowed
        );
    }

    private boolean permissionGranted() {
        return (
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED ||
            getPermissionState("notifications") == PermissionState.GRANTED
        );
    }

    private void recordActiveNotification(String event, BrewingTimerNotificationSupport support) {
        for (StatusBarNotification active : NotificationManagerCompat.from(getContext()).getActiveNotifications()) {
            if (active.getId() == BrewingTimerNotificationFactory.NOTIFICATION_ID) {
                recordNotification(event, active.getNotification(), support, true);
                return;
            }
        }

        JSObject details = commonDetails();
        details.put("support", support.bridgeValue());
        details.put("activeNotificationFound", false);
        record(event, details);
    }

    private void recordNotification(
        String event,
        android.app.Notification notification,
        BrewingTimerNotificationSupport support,
        boolean activeNotificationFound
    ) {
        JSObject details = commonDetails();
        details.put("support", support.bridgeValue());
        details.put("activeNotificationFound", activeNotificationFound);
        details.put("flags", notification.flags);
        details.put("ongoing", (notification.flags & android.app.Notification.FLAG_ONGOING_EVENT) != 0);
        details.put("promoted", Build.VERSION.SDK_INT >= 36 &&
            (notification.flags & android.app.Notification.FLAG_PROMOTED_ONGOING) != 0);
        details.put("requestPromotedOngoing", notification.extras.getBoolean("android.requestPromotedOngoing", false));
        details.put("usesChronometer", notification.extras.getBoolean("android.showChronometer", false));
        details.put("colorized", notification.extras.getBoolean("android.colorized", false));
        details.put("groupSummary", (notification.flags & android.app.Notification.FLAG_GROUP_SUMMARY) != 0);
        details.put("customContentView", notification.contentView != null ||
            notification.bigContentView != null || notification.headsUpContentView != null);
        details.put("category", notification.category == null ? "" : notification.category);
        details.put("template", notification.extras.getString(android.app.Notification.EXTRA_TEMPLATE, ""));
        details.put("hasPromotableCharacteristics", Build.VERSION.SDK_INT >= 36 &&
            notification.hasPromotableCharacteristics());
        record(event, details);
    }

    private JSObject commonDetails() {
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(getContext());
        JSObject details = new JSObject();
        details.put("sdkInt", Build.VERSION.SDK_INT);
        details.put("release", Build.VERSION.RELEASE);
        details.put("incremental", Build.VERSION.INCREMENTAL);
        details.put("manufacturer", Build.MANUFACTURER);
        details.put("model", Build.MODEL);
        details.put("buildFingerprint", Build.FINGERPRINT);
        details.put("notificationsEnabled", notificationManager.areNotificationsEnabled());
        details.put("notificationPermissionGranted", permissionGranted());
        details.put("canPostPromotedNotifications", Build.VERSION.SDK_INT >= 36 &&
            notificationManager.canPostPromotedNotifications());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel channel = manager == null
                ? null
                : manager.getNotificationChannel(BrewingTimerNotificationFactory.CHANNEL_ID);
            details.put("channelImportance", channel == null ? -1 : channel.getImportance());
        }
        return details;
    }

    private void recordLifecycle(String event) {
        JSObject details = commonDetails();
        ActivityManager.RunningAppProcessInfo processInfo = new ActivityManager.RunningAppProcessInfo();
        ActivityManager.getMyMemoryState(processInfo);
        details.put("processImportance", processInfo.importance);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            UsageStatsManager usageStats = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
            details.put("appStandbyBucket", usageStats == null ? -1 : usageStats.getAppStandbyBucket());
        }

        PowerManager powerManager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        details.put("ignoringBatteryOptimizations", powerManager != null &&
            powerManager.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        record(event, details);
    }

    private void recordFailure(String event, RuntimeException exception) {
        JSObject details = commonDetails();
        details.put("errorType", exception.getClass().getSimpleName());
        details.put("message", exception.getMessage() == null ? "" : exception.getMessage());
        record(event, details);
    }

    private void record(String event, JSObject details) {
        BrewingTimerDiagnostics.record(getContext(), event, details);
    }
}
