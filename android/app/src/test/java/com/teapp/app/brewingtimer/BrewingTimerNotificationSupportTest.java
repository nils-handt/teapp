package com.teapp.app.brewingtimer;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class BrewingTimerNotificationSupportTest {
    @Test
    public void api24UsesStandardNotification() {
        assertEquals(
            BrewingTimerNotificationSupport.STANDARD_NOTIFICATION,
            BrewingTimerNotificationSupport.determine(24, true, true, false)
        );
    }

    @Test
    public void api26UsesStandardNotification() {
        assertEquals(
            BrewingTimerNotificationSupport.STANDARD_NOTIFICATION,
            BrewingTimerNotificationSupport.determine(26, true, true, false)
        );
    }

    @Test
    public void api33RequiresNotificationPermission() {
        assertEquals(
            BrewingTimerNotificationSupport.PERMISSION_REQUIRED,
            BrewingTimerNotificationSupport.determine(33, false, true, false)
        );
    }

    @Test
    public void globallyDisabledNotificationsAreReported() {
        assertEquals(
            BrewingTimerNotificationSupport.DISABLED,
            BrewingTimerNotificationSupport.determine(35, true, false, false)
        );
    }

    @Test
    public void promotionCapableApi36ReportsLiveUpdateSupport() {
        assertEquals(
            BrewingTimerNotificationSupport.PROMOTED_LIVE_UPDATE,
            BrewingTimerNotificationSupport.determine(36, true, true, true)
        );
    }

    @Test
    public void baseApi36WithoutPromotionCapabilityUsesStandardNotification() {
        assertEquals(
            BrewingTimerNotificationSupport.STANDARD_NOTIFICATION,
            BrewingTimerNotificationSupport.determine(36, true, true, false)
        );
    }

    @Test
    public void versionsBelowTheAppMinimumAreUnsupported() {
        assertEquals(
            BrewingTimerNotificationSupport.UNSUPPORTED_PLATFORM,
            BrewingTimerNotificationSupport.determine(23, true, true, false)
        );
    }

    @Test
    public void missingRuntimePermissionTakesPrecedenceOverDisabledStatus() {
        assertEquals(
            BrewingTimerNotificationSupport.PERMISSION_REQUIRED,
            BrewingTimerNotificationSupport.determine(33, false, false, false)
        );
    }
}
