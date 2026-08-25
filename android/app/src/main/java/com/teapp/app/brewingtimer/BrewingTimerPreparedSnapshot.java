package com.teapp.app.brewingtimer;

final class BrewingTimerPreparedSnapshot {
    private final String sessionId;
    private final String phase;
    private final int infusionNumber;
    private final long elapsedMillis;
    private final boolean running;
    private final long preparedAtEpochMillis;

    private BrewingTimerPreparedSnapshot(
        String sessionId,
        String phase,
        int infusionNumber,
        long elapsedMillis,
        boolean running,
        long preparedAtEpochMillis
    ) {
        this.sessionId = sessionId;
        this.phase = phase;
        this.infusionNumber = infusionNumber;
        this.elapsedMillis = elapsedMillis;
        this.running = running;
        this.preparedAtEpochMillis = preparedAtEpochMillis;
    }

    static BrewingTimerPreparedSnapshot from(
        String sessionId,
        String phase,
        int infusionNumber,
        long elapsedMillis,
        boolean running,
        long preparedAtEpochMillis
    ) {
        if (sessionId == null || sessionId.trim().isEmpty()) {
            throw new IllegalArgumentException("Brewing timer session ID is required");
        }
        BrewingTimerNotificationSpec.from(phase, infusionNumber, elapsedMillis, running, preparedAtEpochMillis);
        return new BrewingTimerPreparedSnapshot(
            sessionId,
            phase,
            Math.max(1, infusionNumber),
            Math.max(0L, elapsedMillis),
            running,
            preparedAtEpochMillis
        );
    }

    BrewingTimerNotificationSpec notificationSpec(long nowEpochMillis) {
        long currentElapsedMillis = elapsedMillis;
        if (running) {
            currentElapsedMillis += Math.max(0L, nowEpochMillis - preparedAtEpochMillis);
        }
        return BrewingTimerNotificationSpec.from(
            phase,
            infusionNumber,
            currentElapsedMillis,
            running,
            nowEpochMillis
        );
    }

    String sessionId() {
        return sessionId;
    }

    String phase() {
        return phase;
    }

    int infusionNumber() {
        return infusionNumber;
    }

    long elapsedMillis() {
        return elapsedMillis;
    }

    boolean running() {
        return running;
    }

    long preparedAtEpochMillis() {
        return preparedAtEpochMillis;
    }
}
