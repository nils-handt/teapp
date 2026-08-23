package com.teapp.app.brewingtimer;

public enum BrewingTimerNotificationSupport {
    PROMOTED_LIVE_UPDATE("promoted-live-update"),
    STANDARD_NOTIFICATION("standard-notification"),
    PERMISSION_REQUIRED("permission-required"),
    DISABLED("disabled"),
    UNSUPPORTED_PLATFORM("unsupported-platform");

    private final String bridgeValue;

    BrewingTimerNotificationSupport(String bridgeValue) {
        this.bridgeValue = bridgeValue;
    }

    public String bridgeValue() {
        return bridgeValue;
    }

    public static BrewingTimerNotificationSupport determine(
        int apiLevel,
        boolean permissionGranted,
        boolean notificationsEnabled,
        boolean promotedNotificationsAllowed
    ) {
        if (apiLevel < 24) {
            return UNSUPPORTED_PLATFORM;
        }
        if (apiLevel >= 33 && !permissionGranted) {
            return PERMISSION_REQUIRED;
        }
        if (!notificationsEnabled) {
            return DISABLED;
        }
        if (apiLevel >= 36 && promotedNotificationsAllowed) {
            return PROMOTED_LIVE_UPDATE;
        }
        return STANDARD_NOTIFICATION;
    }
}
