package com.teapp.app.brewingtimer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.teapp.app.MainActivity;
import com.teapp.app.R;

final class BrewingTimerNotificationFactory {
    static final String CHANNEL_ID = "brewing_timer";
    static final int NOTIFICATION_ID = 4_201;
    private static final int ACTIVE_COLOR = 0xFF566B5B;
    private static final int REST_COLOR = 0xFF9AA399;

    private BrewingTimerNotificationFactory() {}

    static Notification build(Context context, BrewingTimerNotificationSpec spec) {
        boolean rest = spec.appearance() == BrewingTimerNotificationSpec.Appearance.REST;
        String contentText = spec.contentText();
        if (spec.shortCriticalText() != null) {
            contentText = contentText + " · " + spec.shortCriticalText();
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(rest ? R.drawable.ic_notification_brewing_rest : R.drawable.ic_notification_brewing_active)
            .setContentTitle(spec.title())
            .setContentText(contentText)
            .setContentIntent(contentIntent(context))
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

    static void createChannel(Context context) {
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
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private static PendingIntent contentIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
