import { registerPlugin, Capacitor } from '@capacitor/core';

export interface BiometricAvailability {
  isAvailable: boolean;
  biometryType?: 'fingerprint' | 'face' | 'none';
  reason?: string;
}

export interface BiometricAuthResult {
  authenticated: boolean;
  canceled?: boolean;
  reason?: string;
}

export interface NativeBiometricPluginInterface {
  isAvailable(): Promise<BiometricAvailability>;
  verifyIdentity(options?: {
    reason?: string;
    subtitle?: string;
    cancelTitle?: string;
  }): Promise<BiometricAuthResult>;
  cancelAuthentication(): Promise<void>;
}

const NativeBiometricPlugin = registerPlugin<NativeBiometricPluginInterface>('NativeBiometric');

class BiometricService {
  private static readonly STORAGE_KEY = 'nocturne_biometric_lock';

  public isLockEnabled(): boolean {
    return localStorage.getItem(BiometricService.STORAGE_KEY) === 'true';
  }

  public setLockEnabled(enabled: boolean): void {
    localStorage.setItem(BiometricService.STORAGE_KEY, String(enabled));
  }

  public async checkAvailability(): Promise<BiometricAvailability> {
    if (Capacitor.isNativePlatform()) {
      try {
        return await NativeBiometricPlugin.isAvailable();
      } catch (e: any) {
        return { isAvailable: false, reason: e.message || 'Plugin error' };
      }
    }

    // Web fallback using WebAuthn / PublicKeyCredential if supported
    if (window.PublicKeyCredential) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return {
          isAvailable: available,
          biometryType: available ? 'fingerprint' : 'none',
          reason: available ? undefined : 'No platform authenticator available on this browser'
        };
      } catch {
        return { isAvailable: false, reason: 'WebAuthn check failed' };
      }
    }

    return { isAvailable: false, reason: 'Biometrics unavailable in browser environment' };
  }

  public async promptVerification(reason: string = 'Verify your fingerprint to unlock Nocturne'): Promise<BiometricAuthResult> {
    if (Capacitor.isNativePlatform()) {
      try {
        return await NativeBiometricPlugin.verifyIdentity({
          reason,
          subtitle: 'Nocturne Kinetic App Lock',
          cancelTitle: 'Cancel'
        });
      } catch (e: any) {
        return {
          authenticated: false,
          reason: e.message || 'Biometric prompt error'
        };
      }
    }

    // Web fallback simulator (asks user confirmation)
    const confirmed = window.confirm(`${reason}\n\n(Simulated Biometric Check on Web)`);
    return {
      authenticated: confirmed,
      canceled: !confirmed,
      reason: confirmed ? undefined : 'User canceled verification'
    };
  }
}

export const biometricService = new BiometricService();
