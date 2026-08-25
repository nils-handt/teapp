package com.teapp.app.brewingtimer;

import android.content.Context;
import android.content.SharedPreferences;

final class BrewingTimerPreparedSnapshotStore {
    private static final String PREFERENCES_NAME = "brewing_timer_prepared_snapshot";
    private static final String PRESENT_KEY = "present";
    private static final String SESSION_ID_KEY = "session_id";
    private static final String PHASE_KEY = "phase";
    private static final String INFUSION_NUMBER_KEY = "infusion_number";
    private static final String ELAPSED_MILLIS_KEY = "elapsed_millis";
    private static final String RUNNING_KEY = "running";
    private static final String PREPARED_AT_KEY = "prepared_at";

    private BrewingTimerPreparedSnapshotStore() {}

    static boolean save(Context context, BrewingTimerPreparedSnapshot snapshot) {
        return preferences(context).edit()
            .putBoolean(PRESENT_KEY, true)
            .putString(SESSION_ID_KEY, snapshot.sessionId())
            .putString(PHASE_KEY, snapshot.phase())
            .putInt(INFUSION_NUMBER_KEY, snapshot.infusionNumber())
            .putLong(ELAPSED_MILLIS_KEY, snapshot.elapsedMillis())
            .putBoolean(RUNNING_KEY, snapshot.running())
            .putLong(PREPARED_AT_KEY, snapshot.preparedAtEpochMillis())
            .commit();
    }

    static BrewingTimerPreparedSnapshot load(Context context) {
        SharedPreferences preferences = preferences(context);
        if (!preferences.getBoolean(PRESENT_KEY, false)) {
            return null;
        }
        try {
            return BrewingTimerPreparedSnapshot.from(
                preferences.getString(SESSION_ID_KEY, null),
                preferences.getString(PHASE_KEY, null),
                preferences.getInt(INFUSION_NUMBER_KEY, 1),
                preferences.getLong(ELAPSED_MILLIS_KEY, 0L),
                preferences.getBoolean(RUNNING_KEY, false),
                preferences.getLong(PREPARED_AT_KEY, System.currentTimeMillis())
            );
        } catch (IllegalArgumentException exception) {
            clear(context);
            return null;
        }
    }

    static boolean clear(Context context) {
        return preferences(context).edit().clear().commit();
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }
}
