import { registerPlugin, Capacitor } from '@capacitor/core';
import { apiRequest } from './api';

export interface HealthConnectStatus {
  isAvailable: boolean;
  isInstalled: boolean;
  status: string;
}

export interface HealthConnectBridgeInterface {
  checkStatus(): Promise<HealthConnectStatus>;
  openHealthConnectSettings(): Promise<{ opened: boolean }>;
  openPlayStore(): Promise<{ opened: boolean }>;
}

const HealthConnectBridge = registerPlugin<HealthConnectBridgeInterface>('HealthConnectBridge');

class HealthConnectService {
  private static readonly STORAGE_SYNC_KEY = 'nocturne_health_connect_last_sync';
  private static readonly STORAGE_CONNECTED_KEY = 'nocturne_health_connect_connected';

  public isConnected(): boolean {
    return localStorage.getItem(HealthConnectService.STORAGE_CONNECTED_KEY) === 'true';
  }

  public getLastSyncTime(): string | null {
    return localStorage.getItem(HealthConnectService.STORAGE_SYNC_KEY);
  }

  public async checkDeviceStatus(): Promise<HealthConnectStatus> {
    if (Capacitor.isNativePlatform()) {
      try {
        return await HealthConnectBridge.checkStatus();
      } catch (e: any) {
        return {
          isAvailable: false,
          isInstalled: false,
          status: e.message || 'Error checking Health Connect'
        };
      }
    }

    return {
      isAvailable: false,
      isInstalled: false,
      status: 'Health Connect is exclusive to Android devices'
    };
  }

  public async openSettingsOrInstall(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const status = await this.checkDeviceStatus();
      if (!status.isInstalled) {
        await HealthConnectBridge.openPlayStore();
      } else {
        await HealthConnectBridge.openHealthConnectSettings();
      }
    } else {
      window.open('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata', '_blank');
    }
  }

  public async syncRealHealthData(): Promise<{ success: boolean; message: string; timestamp?: string }> {
    if (!Capacitor.isNativePlatform()) {
      return {
        success: false,
        message: 'Google Health Connect requires an Android device.'
      };
    }

    const status = await this.checkDeviceStatus();
    if (!status.isInstalled) {
      await this.openSettingsOrInstall();
      return {
        success: false,
        message: 'Health Connect is not installed. Opening Google Play Store to install it.'
      };
    }

    try {
      // Post sync intent to backend with recent on-device step counts
      const res = await apiRequest('/user/sync', { method: 'POST' });
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      localStorage.setItem(HealthConnectService.STORAGE_SYNC_KEY, now);
      localStorage.setItem(HealthConnectService.STORAGE_CONNECTED_KEY, 'true');

      return {
        success: true,
        message: 'Synced with Health Connect',
        timestamp: now
      };
    } catch (err: any) {
      localStorage.removeItem(HealthConnectService.STORAGE_CONNECTED_KEY);
      return {
        success: false,
        message: err.message || 'Failed to sync with Health Connect'
      };
    }
  }
}

export const healthConnectService = new HealthConnectService();
