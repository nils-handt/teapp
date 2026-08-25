package com.teapp.app.brewingtimer;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class BrewingTimerPreparedSnapshotTest {
    @Test
    public void runningSnapshotKeepsItsOriginalTimerAnchor() {
        BrewingTimerPreparedSnapshot snapshot = BrewingTimerPreparedSnapshot.from(
            "session-1",
            "infusion",
            2,
            5_000L,
            true,
            100_000L
        );

        BrewingTimerNotificationSpec spec = snapshot.notificationSpec(112_000L);

        assertEquals(95_000L, spec.whenEpochMillis());
        assertTrue(spec.usesChronometer());
    }

    @Test
    public void pausedSnapshotDoesNotAdvanceWhilePrepared() {
        BrewingTimerPreparedSnapshot snapshot = BrewingTimerPreparedSnapshot.from(
            "session-1",
            "pouring",
            3,
            65_000L,
            false,
            100_000L
        );

        BrewingTimerNotificationSpec spec = snapshot.notificationSpec(130_000L);

        assertEquals("01:05", spec.shortCriticalText());
        assertFalse(spec.usesChronometer());
    }

    @Test
    public void clockMovingBackwardsDoesNotReduceRunningElapsedTime() {
        BrewingTimerPreparedSnapshot snapshot = BrewingTimerPreparedSnapshot.from(
            "session-1",
            "rest",
            2,
            8_000L,
            true,
            100_000L
        );

        BrewingTimerNotificationSpec spec = snapshot.notificationSpec(95_000L);

        assertEquals(87_000L, spec.whenEpochMillis());
        assertTrue(spec.usesChronometer());
    }

    @Test(expected = IllegalArgumentException.class)
    public void missingSessionIsRejected() {
        BrewingTimerPreparedSnapshot.from(" ", "rest", 2, 5_000L, true, 100_000L);
    }
}
