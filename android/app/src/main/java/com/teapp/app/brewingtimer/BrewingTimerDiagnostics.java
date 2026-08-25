package com.teapp.app.brewingtimer;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class BrewingTimerDiagnostics {
    private static final String PREFERENCES_NAME = "brewing_timer_diagnostics";
    private static final String RECORDS_KEY = "records";
    private static final int MAX_RECORDS = 64;

    private BrewingTimerDiagnostics() {}

    static synchronized void record(Context context, String event, JSObject details) {
        SharedPreferences preferences = preferences(context);
        JSONArray existing = readRecords(preferences);
        JSONArray records = new JSONArray();
        int firstRecord = Math.max(0, existing.length() - MAX_RECORDS + 1);

        for (int index = firstRecord; index < existing.length(); index++) {
            try {
                records.put(existing.get(index));
            } catch (JSONException ignored) {}
        }

        JSONObject record = new JSONObject();
        try {
            record.put("timestamp", timestamp());
            record.put("event", event);
            record.put("details", details);
            records.put(record);
        } catch (JSONException ignored) {}

        preferences.edit().putString(RECORDS_KEY, records.toString()).apply();
    }

    static synchronized JSObject drain(Context context) {
        SharedPreferences preferences = preferences(context);
        JSONArray records = readRecords(preferences);
        preferences.edit().remove(RECORDS_KEY).apply();

        JSObject result = new JSObject();
        try {
            result.put("records", new JSArray(records.toString()));
        } catch (JSONException exception) {
            result.put("records", new JSArray());
        }
        return result;
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    private static String timestamp() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }

    private static JSONArray readRecords(SharedPreferences preferences) {
        try {
            return new JSONArray(preferences.getString(RECORDS_KEY, "[]"));
        } catch (JSONException exception) {
            return new JSONArray();
        }
    }
}
