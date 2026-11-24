package com.nocturne.health;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(name = "HealthConnectBridge")
public class HealthConnectBridgePlugin extends Plugin {

    private static final String HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata";

    @PluginMethod
    public void checkStatus(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            ret.put("isAvailable", false);
            ret.put("isInstalled", false);
            ret.put("status", "Not supported on this Android version");
            call.resolve(ret);
            return;
        }

        boolean isInstalled = isPackageInstalled(HEALTH_CONNECT_PACKAGE, context);
        // On Android 14+ (API 34+), Health Connect is part of the system framework
        if (Build.VERSION.SDK_INT >= 34) {
            isInstalled = true;
        }

        ret.put("isAvailable", true);
        ret.put("isInstalled", isInstalled);
        ret.put("status", isInstalled ? "Installed" : "Not Installed");
        call.resolve(ret);
    }

    @PluginMethod
    public void openHealthConnectSettings(PluginCall call) {
        Context context = getContext();
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= 34) {
                // System settings on Android 14+
                intent = new Intent("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS");
                intent.putExtra(Intent.EXTRA_PACKAGE_NAME, context.getPackageName());
            } else {
                intent = new Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS");
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            if (intent.resolveActivity(context.getPackageManager()) != null) {
                context.startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("opened", true);
                call.resolve(ret);
            } else {
                // Fallback to Health Connect Play Store page or application settings
                openPlayStoreOrAppSettings(call);
            }
        } catch (Exception e) {
            openPlayStoreOrAppSettings(call);
        }
    }

    @PluginMethod
    public void openPlayStore(PluginCall call) {
        openPlayStoreOrAppSettings(call);
    }

    private void openPlayStoreOrAppSettings(PluginCall call) {
        Context context = getContext();
        try {
            Intent marketIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + HEALTH_CONNECT_PACKAGE));
            marketIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (marketIntent.resolveActivity(context.getPackageManager()) != null) {
                context.startActivity(marketIntent);
            } else {
                Intent webIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + HEALTH_CONNECT_PACKAGE));
                webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(webIntent);
            }
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Cannot open Play Store: " + e.getMessage());
        }
    }

    private boolean isPackageInstalled(String packageName, Context context) {
        try {
            context.getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
}
