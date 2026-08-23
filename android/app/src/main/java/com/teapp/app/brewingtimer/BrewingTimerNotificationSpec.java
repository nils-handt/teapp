package com.teapp.app.brewingtimer;

import java.util.Locale;

public final class BrewingTimerNotificationSpec {
    public static final long TIMEOUT_AFTER_MILLIS = 6L * 60L * 60L * 1_000L;

    public enum Appearance {
        ACTIVE,
        REST
    }

    private final long whenEpochMillis;
    private final String title;
    private final String shortCriticalText;
    private final String contentText;
    private final boolean usesChronometer;
    private final Appearance appearance;

    private BrewingTimerNotificationSpec(
        long whenEpochMillis,
        String title,
        String shortCriticalText,
        String contentText,
        boolean usesChronometer,
        Appearance appearance
    ) {
        this.whenEpochMillis = whenEpochMillis;
        this.title = title;
        this.shortCriticalText = shortCriticalText;
        this.contentText = contentText;
        this.usesChronometer = usesChronometer;
        this.appearance = appearance;
    }

    public static BrewingTimerNotificationSpec from(
        String phase,
        int infusionNumber,
        long elapsedMillis,
        boolean running,
        long nowEpochMillis
    ) {
        if (!"infusion".equals(phase) && !"pouring".equals(phase) && !"rest".equals(phase)) {
            throw new IllegalArgumentException("Unknown brewing timer phase");
        }
        long clampedElapsedMillis = Math.max(0L, elapsedMillis);
        String title = "infusion".equals(phase)
            ? "Infusing"
            : "rest".equals(phase) ? "Rest" : "pouring".equals(phase) ? "Pouring" : null;
        String shortCriticalText = "pouring".equals(phase) ? formatElapsed(clampedElapsedMillis) : null;
        String contentText = "Infusion " + Math.max(1, infusionNumber);
        boolean usesChronometer = running && !"pouring".equals(phase);
        Appearance appearance = "rest".equals(phase) ? Appearance.REST : Appearance.ACTIVE;
        return new BrewingTimerNotificationSpec(
            nowEpochMillis - clampedElapsedMillis,
            title,
            shortCriticalText,
            contentText,
            usesChronometer,
            appearance
        );
    }

    public long whenEpochMillis() {
        return whenEpochMillis;
    }

    public String title() {
        return title;
    }

    public String shortCriticalText() {
        return shortCriticalText;
    }

    public String contentText() {
        return contentText;
    }

    public boolean usesChronometer() {
        return usesChronometer;
    }

    public Appearance appearance() {
        return appearance;
    }

    private static String formatElapsed(long elapsedMillis) {
        long totalSeconds = elapsedMillis / 1_000L;
        long hours = totalSeconds / 3_600L;
        long minutes = (totalSeconds / 60L) % 60L;
        long seconds = totalSeconds % 60L;
        if (hours > 0L) {
            return String.format(Locale.ROOT, "%d:%02d:%02d", hours, minutes, seconds);
        }
        return String.format(Locale.ROOT, "%02d:%02d", minutes, seconds);
    }
}
