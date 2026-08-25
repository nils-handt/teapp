package com.teapp.app.brewingtimer;

import android.Manifest;
import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import androidx.core.app.NotificationCompat;
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
import com.teapp.app.MainActivity;
import com.teapp.app.R;

@CapacitorPlugin(
    name = "BrewingTimerNotification",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public final class BrewingTimerNotificationPlugin extends Plugin {
    private static final String TAG = "BrewingTimerNotif";
    private static final String CHANNEL_ID = "brewing_timer";
    private static final int NOTIFICATION_ID = 4_201;
    private static final int ACTIVE_COLOR = 0xFF566B5B;
    private static final int REST_COLOR = 0xFF9AA399;

    @Override
    public void load() {
        createNotificationChannel();
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
            String sessionId = call.getString("sessionId");
            String phase = call.getString("phase");
            Integer infusionNumber = call.getInt("infusionNumber");
            Double elapsedMillis = call.getDouble("elapsedMs");
            Boolean running = call.getBoolean("running");
            if (
                sessionId == null ||
                sessionId.trim().isEmpty() ||
                phase == null ||
                infusionNumber == null ||
                elapsedMillis == null ||
                !Double.isFinite(elapsedMillis) ||
                running == null
            ) {
                Log.w(TAG, "Ignoring an incomplete brewing timer snapshot");
                record("notification-rejected", new JSObject().put("reason", "incomplete-snapshot"));
                call.resolve();
                return;
            }

            BrewingTimerNotificationSpec spec = BrewingTimerNotificationSpec.from(
                phase,
                infusionNumber,
                elapsedMillis.longValue(),
                running,
                System.currentTimeMillis()
            );
            createNotificationChannel();
            android.app.Notification notification = buildNotification(spec);
            recordNotification("notification-built", notification, support, false);
            NotificationManagerCompat.from(getContext()).notify(NOTIFICATION_ID, notification);
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
            NotificationManagerCompat.from(getContext()).cancel(NOTIFICATION_ID);
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
        recordLifecycle("activity-resumed");
    }

    @Override
    protected void handleOnPause() {
        recordLifecycle("activity-paused");
    }

    @Override
    protected void handleOnStop() {
        recordLifecycle("activity-stopped");
    }

    private android.app.Notification buildNotification(BrewingTimerNotificationSpec spec) {
        boolean rest = spec.appearance() == BrewingTimerNotificationSpec.Appearance.REST;
        String contentText = spec.contentText();
        if (spec.shortCriticalText() != null) {
            contentText = contentText + " · " + spec.shortCriticalText();
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
            .setSmallIcon(rest ? R.drawable.ic_notification_brewing_rest : R.drawable.ic_notification_brewing_active)
            .setContentTitle(spec.title())
            .setContentText(contentText)
            .setContentIntent(contentIntent())
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setDefaults(0)
            .setSound(null)
            .setVibrate(null)
            .setAutoCancel(false)
            .setColor(rest ? REST_COLOR : ACTIVE_COLOR)
            .setRequestPromotedOngoing(true)
            .setTimeoutAfter(BrewingTimerNotificationSpec.TIMEOUT_AFTER_MILLIS)
            .setWhen(spec.whenEpochMillis())
            .setShowWhen(spec.usesChronometer())
            .setUsesChronometer(spec.usesChronometer())
            .setChronometerCountDown(false);

        if (spec.shortCriticalText() != null) {
            builder.setShortCriticalText(spec.shortCriticalText());
        }
        return builder.build();
    }

    private PendingIntent contentIntent() {
        Intent intent = new Intent(getContext(), MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            getContext(),
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Brewing timer",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Shows the current infusion or rest timer");
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.enableLights(false);
        channel.setShowBadge(false);
        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
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
            if (active.getId() == NOTIFICATION_ID) {
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
            NotificationChannel channel = manager == null ? null : manager.getNotificationChannel(CHANNEL_ID);
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
