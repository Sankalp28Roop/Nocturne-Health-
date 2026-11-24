import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface PermissionStatusOverview {
  location: 'granted' | 'denied' | 'prompt';
  activity: 'granted' | 'denied' | 'prompt';
  notifications: 'granted' | 'denied' | 'prompt';
  camera: 'granted' | 'denied' | 'prompt';
  microphone: 'granted' | 'denied' | 'prompt';
  healthConnect: 'granted' | 'denied' | 'prompt' | 'not_supported';
}

const ONBOARDING_COMPLETED_KEY = 'permissions_onboarding_completed';

// Helper to prevent any native dialog promise from freezing indefinitely
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 15000, fallbackValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), timeoutMs))
  ]);
}

export const PermissionsService = {
  // Check if onboarding was already completed
  async hasCompletedOnboarding(): Promise<boolean> {
    try {
      const { value } = await Preferences.get({ key: ONBOARDING_COMPLETED_KEY });
      return value === 'true';
    } catch {
      return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
    }
  },

  // Mark onboarding as completed
  async markOnboardingCompleted(): Promise<void> {
    try {
      await Preferences.set({ key: ONBOARDING_COMPLETED_KEY, value: 'true' });
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch {
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    }
  },

  // 1. Request GPS Location just-in-time
  async requestLocationPermission(): Promise<boolean> {
    return withTimeout(
      (async () => {
        try {
          if (Capacitor.isNativePlatform()) {
            // First check if already granted
            try {
              const check = await Geolocation.checkPermissions();
              if (check.location === 'granted' || (check as any).coarseLocation === 'granted') {
                return true;
              }
            } catch {}

            // Request permission from native OS
            const req = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
            if (req.location === 'granted' || (req as any).coarseLocation === 'granted') {
              return true;
            }

            // Fallback check in case OS dialog resolved
            const finalCheck = await Geolocation.checkPermissions();
            return finalCheck.location === 'granted' || (finalCheck as any).coarseLocation === 'granted';
          }

          // Web browser fallback
          if (typeof navigator !== 'undefined' && navigator.geolocation) {
            return new Promise<boolean>((resolve) => {
              navigator.geolocation.getCurrentPosition(
                () => resolve(true),
                () => resolve(false),
                { timeout: 8000 }
              );
            });
          }
          return false;
        } catch (e) {
          console.warn('[Permissions] Location request error:', e);
          return false;
        }
      })(),
      15000,
      false
    );
  },

  // 2. Request Notification Permission (Android 13+ Tiramisu)
  async requestNotificationPermission(): Promise<boolean> {
    return withTimeout(
      (async () => {
        try {
          if (Capacitor.isNativePlatform()) {
            try {
              const check = await LocalNotifications.checkPermissions();
              if (check.display === 'granted') return true;
            } catch {}

            const req = await LocalNotifications.requestPermissions();
            if (req.display === 'granted') return true;

            const finalCheck = await LocalNotifications.checkPermissions();
            return finalCheck.display === 'granted';
          }

          if (typeof Notification !== 'undefined') {
            const res = await Notification.requestPermission();
            return res === 'granted';
          }
          return false;
        } catch (e) {
          console.warn('[Permissions] Notification request error:', e);
          return false;
        }
      })(),
      15000,
      false
    );
  },

  // 3. Request Physical Activity Recognition
  async requestActivityPermission(): Promise<boolean> {
    return withTimeout(
      (async () => {
        try {
          if (Capacitor.isNativePlatform()) {
            try {
              const Pedometer = registerPlugin<any>('PedometerStepTracker');
              if (typeof Pedometer?.requestPermission === 'function') {
                const res = await Pedometer.requestPermission();
                if (res?.granted) return true;
              }
            } catch {}
          }

          if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
            const state = await (DeviceMotionEvent as any).requestPermission();
            return state === 'granted';
          }
          return true;
        } catch {
          return true;
        }
      })(),
      15000,
      true
    );
  },

  // 4. Request Camera / Photo Picker
  async requestCameraPermission(): Promise<boolean> {
    return withTimeout(
      (async () => {
        try {
          if (Capacitor.isNativePlatform()) {
            try {
              const check = await Camera.checkPermissions();
              if (check.camera === 'granted' || check.photos === 'granted') return true;
            } catch {}

            const req = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
            if (req.camera === 'granted' || req.photos === 'granted') return true;

            const finalCheck = await Camera.checkPermissions();
            return finalCheck.camera === 'granted' || finalCheck.photos === 'granted';
          }

          if (navigator.mediaDevices?.getUserMedia) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true });
              stream.getTracks().forEach(t => t.stop());
              return true;
            } catch {
              return false;
            }
          }
          return false;
        } catch (e) {
          console.warn('[Permissions] Camera request error:', e);
          return false;
        }
      })(),
      15000,
      false
    );
  },

  // 5. Request Microphone Permission for Voice Coach
  async requestMicrophonePermission(): Promise<boolean> {
    return withTimeout(
      (async () => {
        try {
          if (Capacitor.isNativePlatform()) {
            try {
              const micCheck = await SpeechRecognition.checkPermissions();
              if (micCheck.speechRecognition === 'granted') return true;
            } catch {}

            const status = await SpeechRecognition.requestPermissions();
            if (status.speechRecognition === 'granted') return true;

            const finalCheck = await SpeechRecognition.checkPermissions();
            return finalCheck.speechRecognition === 'granted';
          }

          if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            return true;
          }
          return false;
        } catch (e) {
          console.warn('[Permissions] Microphone request error:', e);
          return false;
        }
      })(),
      15000,
      false
    );
  },

  // 6. Open Android App System Settings
  async openAppSettings(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await (App as any).openUrl?.({ url: 'package:com.nocturne.health' });
      }
    } catch {
      alert('Please open Android Settings > Apps > Nocturne > Permissions to customize access.');
    }
  },

  // 7. Query live status of all permissions
  async getAllPermissionsStatus(): Promise<PermissionStatusOverview> {
    const overview: PermissionStatusOverview = {
      location: 'prompt',
      activity: 'prompt',
      notifications: 'prompt',
      camera: 'prompt',
      microphone: 'prompt',
      healthConnect: 'prompt',
    };

    // Location
    try {
      const loc = await Geolocation.checkPermissions();
      const isGranted = loc.location === 'granted' || (loc as any).coarseLocation === 'granted';
      const isDenied = loc.location === 'denied';
      overview.location = isGranted ? 'granted' : isDenied ? 'denied' : 'prompt';
    } catch {
      overview.location = 'prompt';
    }

    // Notifications
    try {
      const notif = await LocalNotifications.checkPermissions();
      overview.notifications = notif.display === 'granted' ? 'granted' : notif.display === 'denied' ? 'denied' : 'prompt';
    } catch {
      if (typeof Notification !== 'undefined') {
        overview.notifications = Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'prompt';
      }
    }

    // Camera
    try {
      const cam = await Camera.checkPermissions();
      overview.camera = (cam.camera === 'granted' || cam.photos === 'granted') ? 'granted' : cam.camera === 'denied' ? 'denied' : 'prompt';
    } catch {
      overview.camera = 'prompt';
    }

    // Microphone
    try {
      if (typeof (SpeechRecognition as any)?.checkPermissions === 'function') {
        const micCheck = await SpeechRecognition.checkPermissions();
        overview.microphone = micCheck.speechRecognition === 'granted' ? 'granted' : 'prompt';
      }
    } catch {
      overview.microphone = 'prompt';
    }

    overview.activity = 'granted';
    overview.healthConnect = 'prompt';

    return overview;
  },

  // 8. Request Camera / Photo Picker avatar
  async pickProfilePhoto(): Promise<string | null> {
    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
      });
      return image.dataUrl || null;
    } catch {
      return null;
    }
  },

  // 9. Export & Share CSV file
  async shareCsv(filename: string, csvContent: string): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        const writeRes = await Filesystem.writeFile({
          path: filename,
          data: csvContent,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });

        await Share.share({
          title: 'Export Nocturne Health Data',
          text: 'Exported from Nocturne',
          url: writeRes.uri,
          dialogTitle: 'Share Health CSV'
        });
        return true;
      }

      // Web download fallback
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    } catch (e) {
      console.warn('[Permissions] Share CSV error:', e);
      return false;
    }
  },

  // Haptic feedback helpers
  async hapticTap() {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  },

  async hapticSuccess() {
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      await Haptics.notification({ type: NotificationType.Success });
    } catch {}
  }
};
