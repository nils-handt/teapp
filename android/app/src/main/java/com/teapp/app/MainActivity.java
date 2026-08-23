package com.teapp.app;

import com.getcapacitor.BridgeActivity;
import com.teapp.app.brewingtimer.BrewingTimerNotificationPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(BrewingTimerNotificationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
