package com.teapp.app.brewingtimer;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;

public final class BrewingTimerForegroundService extends Service {
    private static final String TAG = "BrewingTimerService";
    private static final String ACTION_START = "com.teapp.app.brewingtimer.START";
    private final Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private final Runnable timeout = () -> {
        record("foreground-service-timeout", new JSObject());
        stopForegroundAndSelf();
    };

    static boolean start(Context context) {
        Intent intent = new Intent(context, BrewingTimerForegroundService.class).setAction(ACTION_START);
        try {
            ContextCompat.startForegroundService(context, intent);
            return true;
        } catch (RuntimeException exception) {
            JSObject details = failureDetails(exception);
            BrewingTimerDiagnostics.record(context, "foreground-service-start-request-failed", details);
            Log.w(TAG, "Unable to start brewing timer foreground service", exception);
            return false;
        }
    }

    static void stop(Context context) {
        try {
            context.stopService(new Intent(context, BrewingTimerForegroundService.class));
        } catch (RuntimeException exception) {
            BrewingTimerDiagnostics.record(context, "foreground-service-stop-request-failed", failureDetails(exception));
            Log.w(TAG, "Unable to stop brewing timer foreground service", exception);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        BrewingTimerPreparedSnapshot snapshot = BrewingTimerPreparedSnapshotStore.load(this);
        if (snapshot == null) {
            record("foreground-service-missing-snapshot", new JSObject().put("startId", startId));
            stopForegroundAndSelf();
            return START_NOT_STICKY;
        }

        try {
            BrewingTimerNotificationFactory.createChannel(this);
            BrewingTimerNotificationSpec spec = snapshot.notificationSpec(System.currentTimeMillis());
            Notification notification = BrewingTimerNotificationFactory.build(this, spec);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    BrewingTimerNotificationFactory.NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
                );
            } else {
                startForeground(BrewingTimerNotificationFactory.NOTIFICATION_ID, notification);
            }

            JSObject details = new JSObject();
            details.put("sessionId", snapshot.sessionId());
            details.put("phase", snapshot.phase());
            details.put("infusionNumber", snapshot.infusionNumber());
            details.put("running", snapshot.running());
            details.put("sdkInt", Build.VERSION.SDK_INT);
            details.put("foregroundServiceType", "connectedDevice");
            details.put("notificationId", BrewingTimerNotificationFactory.NOTIFICATION_ID);
            details.put("notificationFlags", notification.flags);
            details.put("requestPromotedOngoing", notification.extras.getBoolean("android.requestPromotedOngoing", false));
            details.put("hasPromotableCharacteristics", Build.VERSION.SDK_INT >= 36 &&
                notification.hasPromotableCharacteristics());
            record("foreground-service-started", details);

            timeoutHandler.removeCallbacks(timeout);
            timeoutHandler.postDelayed(timeout, BrewingTimerNotificationSpec.TIMEOUT_AFTER_MILLIS);
        } catch (RuntimeException exception) {
            Log.e(TAG, "Unable to enter the foreground for the brewing timer", exception);
            record("foreground-service-start-failed", failureDetails(exception));
            stopForegroundAndSelf();
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        timeoutHandler.removeCallbacks(timeout);
        record("foreground-service-destroyed", new JSObject());
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void stopForegroundAndSelf() {
        timeoutHandler.removeCallbacks(timeout);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    private void record(String event, JSObject details) {
        BrewingTimerDiagnostics.record(this, event, details);
    }

    private static JSObject failureDetails(RuntimeException exception) {
        JSObject details = new JSObject();
        details.put("errorType", exception.getClass().getSimpleName());
        details.put("message", exception.getMessage() == null ? "" : exception.getMessage());
        details.put("sdkInt", Build.VERSION.SDK_INT);
        return details;
    }
}
