package com.teapp.app.brewingtimer;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
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
            NotificationManagerCompat.from(getContext()).notify(NOTIFICATION_ID, buildNotification(spec));
        } catch (IllegalArgumentException | SecurityException exception) {
            Log.w(TAG, "Unable to show brewing timer notification", exception);
        } catch (RuntimeException exception) {
            Log.e(TAG, "Unexpected brewing timer notification failure", exception);
        }
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        try {
            NotificationManagerCompat.from(getContext()).cancel(NOTIFICATION_ID);
        } catch (RuntimeException exception) {
            Log.w(TAG, "Unable to cancel brewing timer notification", exception);
        }
        call.resolve();
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
        JSObject result = new JSObject();
        result.put("support", currentSupport().bridgeValue());
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
}
