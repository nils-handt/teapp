package com.teapp.app.brewingtimer;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class BrewingTimerNotificationSpecTest {
    @Test
    public void runningInfusionUsesElapsedCountUpAnchor() {
        BrewingTimerNotificationSpec spec = BrewingTimerNotificationSpec.from(
            "infusion",
            2,
            5_000L,
            true,
            100_000L
        );

        assertEquals(95_000L, spec.whenEpochMillis());
    }

    @Test
    public void negativeElapsedTimeIsClampedToZero() {
        BrewingTimerNotificationSpec spec = BrewingTimerNotificationSpec.from(
            "rest",
            1,
            -5_000L,
            true,
            100_000L
        );

        assertEquals(100_000L, spec.whenEpochMillis());
    }

    @Test
    public void infusionPhaseUsesActivePresentation() {
        BrewingTimerNotificationSpec spec = BrewingTimerNotificationSpec.from(
            "infusion",
            2,
            5_000L,
            true,
            100_000L
        );

        assertEquals("Infusing", spec.title());
    }

    @Test
    public void restPhaseUsesRestPresentation() {
        BrewingTimerNotificationSpec spec = BrewingTimerNotificationSpec.from("rest", 2, 5_000L, true, 100_000L);

        assertEquals("Rest", spec.title());
    }

    @Test
    public void pouringPhaseUsesPausedPresentation() {
        BrewingTimerNotificationSpec spec = BrewingTimerNotificationSpec.from("pouring", 2, 5_000L, false, 100_000L);

        assertEquals("Pouring", spec.title());
    }

    @Test
    public void pouringShowsStaticElapsedTime() {
        BrewingTimerNotificationSpec spec = BrewingTimerNotificationSpec.from("pouring", 2, 295_000L, false, 100_000L);

        assertEquals("04:55", spec.shortCriticalText());
    }

    @Test
    public void notificationIdentifiesTheCurrentInfusion() {
        BrewingTimerNotificationSpec spec = BrewingTimerNotificationSpec.from("rest", 3, 5_000L, true, 100_000L);

        assertEquals("Infusion 3", spec.contentText());
    }

    @Test
    public void pouringDoesNotRunAChronometer() {
        BrewingTimerNotificationSpec spec = BrewingTimerNotificationSpec.from("pouring", 2, 295_000L, false, 100_000L);

        assertFalse(spec.usesChronometer());
    }

    @Test
    public void restRunsAChronometer() {
        BrewingTimerNotificationSpec spec = BrewingTimerNotificationSpec.from("rest", 2, 5_000L, true, 100_000L);

        assertTrue(spec.usesChronometer());
    }

    @Test
    public void restUsesTheMutedPhaseAppearance() {
        BrewingTimerNotificationSpec spec = BrewingTimerNotificationSpec.from("rest", 2, 5_000L, true, 100_000L);

        assertEquals(BrewingTimerNotificationSpec.Appearance.REST, spec.appearance());
    }

    @Test(expected = IllegalArgumentException.class)
    public void unknownPhaseCannotCreateANotification() {
        BrewingTimerNotificationSpec.from("idle", 2, 5_000L, false, 100_000L);
    }

    @Test
    public void notificationExpiresAfterSixHours() {
        assertEquals(21_600_000L, BrewingTimerNotificationSpec.TIMEOUT_AFTER_MILLIS);
    }
}
