package com.nocturne.health;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PedometerStepTrackerPlugin.class);
        registerPlugin(NativeBiometricPlugin.class);
        registerPlugin(HealthConnectBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

