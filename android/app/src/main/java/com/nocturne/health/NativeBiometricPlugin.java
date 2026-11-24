package com.nocturne.health;

import android.app.Activity;
import android.content.Context;
import android.content.DialogInterface;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

@CapacitorPlugin(name = "NativeBiometric")
public class NativeBiometricPlugin extends Plugin {

    private CancellationSignal cancellationSignal;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            ret.put("isAvailable", false);
            ret.put("reason", "Android version must be 10 (API 29) or higher");
            call.resolve(ret);
            return;
        }

        try {
            BiometricManager biometricManager = (BiometricManager) getContext().getSystemService(Context.BIOMETRIC_SERVICE);
            if (biometricManager == null) {
                ret.put("isAvailable", false);
                ret.put("reason", "BiometricManager service unavailable");
                call.resolve(ret);
                return;
            }

            int canAuth = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK);
            if (canAuth == BiometricManager.BIOMETRIC_SUCCESS) {
                ret.put("isAvailable", true);
                ret.put("biometryType", "fingerprint");
                call.resolve(ret);
            } else if (canAuth == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
                ret.put("isAvailable", false);
                ret.put("reason", "No fingerprints or biometrics enrolled on device");
                call.resolve(ret);
            } else if (canAuth == BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE) {
                ret.put("isAvailable", false);
                ret.put("reason", "No biometric hardware present on this device");
                call.resolve(ret);
            } else {
                ret.put("isAvailable", false);
                ret.put("reason", "Biometric hardware currently unavailable or locked out");
                call.resolve(ret);
            }
        } catch (Exception e) {
            ret.put("isAvailable", false);
            ret.put("reason", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void verifyIdentity(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            call.reject("Biometric authentication requires Android 9.0+");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity context is null");
            return;
        }

        String title = call.getString("reason", "Verify your fingerprint to access Nocturne");
        String subtitle = call.getString("subtitle", "Nocturne App Lock");
        String cancelTitle = call.getString("cancelTitle", "Cancel");

        activity.runOnUiThread(() -> {
            try {
                if (cancellationSignal != null) {
                    cancellationSignal.cancel();
                    cancellationSignal = null;
                }
                cancellationSignal = new CancellationSignal();

                Executor executor = activity.getMainExecutor();

                BiometricPrompt.Builder promptBuilder = new BiometricPrompt.Builder(getContext())
                        .setTitle(title)
                        .setSubtitle(subtitle)
                        .setNegativeButton(cancelTitle, executor, new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface dialogInterface, int i) {
                                JSObject ret = new JSObject();
                                ret.put("authenticated", false);
                                ret.put("canceled", true);
                                ret.put("reason", "User canceled");
                                call.resolve(ret);
                            }
                        });

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    promptBuilder.setConfirmationRequired(false);
                }

                BiometricPrompt prompt = promptBuilder.build();

                prompt.authenticate(cancellationSignal, executor, new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        JSObject ret = new JSObject();
                        ret.put("authenticated", false);
                        ret.put("canceled", errorCode == BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED || errorCode == BiometricPrompt.BIOMETRIC_ERROR_CANCELED);
                        ret.put("reason", errString != null ? errString.toString() : "Authentication error " + errorCode);
                        call.resolve(ret);
                    }

                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        JSObject ret = new JSObject();
                        ret.put("authenticated", true);
                        call.resolve(ret);
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                        // Individual attempt failed (e.g. wrong finger), prompt remains visible until cancel or success
                    }
                });

            } catch (Exception e) {
                call.reject("Failed to trigger BiometricPrompt: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void cancelAuthentication(PluginCall call) {
        if (cancellationSignal != null) {
            cancellationSignal.cancel();
            cancellationSignal = null;
        }
        call.resolve();
    }
}
