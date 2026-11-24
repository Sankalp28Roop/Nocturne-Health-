package com.nocturne.health;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(
    name = "PedometerStepTracker",
    permissions = {
        @Permission(
            alias = "activity",
            strings = { Manifest.permission.ACTIVITY_RECOGNITION }
        )
    }
)
public class PedometerStepTrackerPlugin extends Plugin implements SensorEventListener {

    private static final String PREF_NAME = "nocturne_step_sensor_prefs";
    private static final String PREF_KEY_LAST_BOOT_STEPS = "last_boot_sensor_steps";
    private static final String PREF_KEY_BASE_DATE = "step_base_date";
    private static final String PREF_KEY_DAILY_OFFSET = "daily_step_offset";
    private static final String PREF_KEY_ACCUMULATED_TODAY = "steps_accumulated_today";

    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    private Sensor stepDetectorSensor;

    private int liveStepsToday = 0;
    private int heartPointsToday = 0;

    @Override
    public void load() {
        super.load();
        Context context = getContext();
        sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);

        if (sensorManager != null) {
            stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
        }

        registerSensor();
    }

    private void registerSensor() {
        if (sensorManager == null) return;

        if (stepCounterSensor != null) {
            sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_UI);
        } else if (stepDetectorSensor != null) {
            sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_UI);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        String todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
        SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);

        String savedDate = prefs.getString(PREF_KEY_BASE_DATE, "");
        int offset = prefs.getInt(PREF_KEY_DAILY_OFFSET, 0);

        if (!todayDate.equals(savedDate)) {
            // New day rollover
            offset = (int) event.values[0];
            prefs.edit()
                .putString(PREF_KEY_BASE_DATE, todayDate)
                .putInt(PREF_KEY_DAILY_OFFSET, offset)
                .putInt(PREF_KEY_ACCUMULATED_TODAY, 0)
                .apply();
        }

        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            int totalSinceBoot = (int) event.values[0];
            if (offset == 0 || offset > totalSinceBoot) {
                offset = totalSinceBoot;
                prefs.edit().putInt(PREF_KEY_DAILY_OFFSET, offset).apply();
            }
            liveStepsToday = Math.max(0, totalSinceBoot - offset);
        } else if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            liveStepsToday += (int) event.values[0];
        }

        // Heart Points calculation (approx 100 brisk steps or active movement = 1 Heart Point)
        heartPointsToday = Math.round(liveStepsToday / 100f);

        prefs.edit().putInt(PREF_KEY_ACCUMULATED_TODAY, liveStepsToday).apply();

        // Notify Web View live
        JSObject ret = new JSObject();
        ret.put("steps", liveStepsToday);
        ret.put("heartPoints", heartPointsToday);
        notifyListeners("stepUpdate", ret);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    @PluginMethod
    public void getTodaySteps(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
        String savedDate = prefs.getString(PREF_KEY_BASE_DATE, "");

        int steps = 0;
        if (todayDate.equals(savedDate)) {
            steps = prefs.getInt(PREF_KEY_ACCUMULATED_TODAY, liveStepsToday);
        } else {
            steps = liveStepsToday;
        }

        int heartPoints = Math.round(steps / 100f);
        float distanceKm = (steps * 0.762f) / 1000f; // Average stride ~0.762m
        int calories = Math.round(steps * 0.04f); // Average ~0.04 kcal per step
        int moveMinutes = Math.round(steps / 100f); // 100 steps per active move min

        JSObject ret = new JSObject();
        ret.put("steps", steps);
        ret.put("heartPoints", heartPoints);
        ret.put("distanceKm", Math.round(distanceKm * 100.0) / 100.0);
        ret.put("calories", calories);
        ret.put("moveMinutes", moveMinutes);
        ret.put("date", todayDate);

        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissionForAlias("activity", call, "activityPermCallback");
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }
}
