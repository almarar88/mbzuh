package com.alcode.techpulse;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TechPulsePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
