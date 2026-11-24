import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { apiRequest } from './api';

export interface OfflineMutation {
  id: string;
  type: 'WORKOUT_SESSION' | 'WEIGHT_LOG' | 'MEAL_LOG' | 'BREATHING_SESSION';
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: any;
  createdAt: string;
}

const STORAGE_KEY = 'nocturne_offline_mutation_queue_v1';

class OfflineSyncEngine {
  private queue: OfflineMutation[] = [];
  private isSyncing = false;
  private isOnline = true;
  private listeners: Array<(status: { isOnline: boolean; pendingCount: number; isSyncing: boolean }) => void> = [];

  constructor() {
    this.init();
  }

  private async init() {
    await this.loadQueue();

    try {
      const status = await Network.getStatus();
      this.isOnline = status.connected;
    } catch {
      this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    }

    try {
      Network.addListener('networkStatusChange', (status) => {
        const wasOffline = !this.isOnline;
        this.isOnline = status.connected;
        this.notify();
        if (wasOffline && this.isOnline) {
          this.syncPending();
        }
      });
    } catch {}

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notify();
        this.syncPending();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notify();
      });
    }

    if (this.isOnline && this.queue.length > 0) {
      this.syncPending();
    }
  }

  private async loadQueue() {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (value) {
        this.queue = JSON.parse(value);
      }
    } catch {
      this.queue = [];
    }
    this.notify();
  }

  private async saveQueue() {
    try {
      await Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify(this.queue)
      });
    } catch (e) {
      console.warn('Failed to persist offline queue:', e);
    }
    this.notify();
  }

  public getStatus() {
    return {
      isOnline: this.isOnline,
      pendingCount: this.queue.length,
      isSyncing: this.isSyncing
    };
  }

  public addListener(cb: (status: { isOnline: boolean; pendingCount: number; isSyncing: boolean }) => void) {
    this.listeners.push(cb);
    cb(this.getStatus());
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach(cb => cb(status));
  }

  // Enqueue a mutation for offline replay
  public async enqueue(mutation: Omit<OfflineMutation, 'id' | 'createdAt'>) {
    const item: OfflineMutation = {
      ...mutation,
      id: 'mut_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      createdAt: new Date().toISOString()
    };

    this.queue.push(item);
    await this.saveQueue();

    if (this.isOnline) {
      this.syncPending();
    }

    return item;
  }

  // Wrapper for API requests with auto-offline queuing
  public async mutate(
    type: OfflineMutation['type'],
    endpoint: string,
    body: any,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
  ): Promise<{ synced: boolean; data?: any }> {
    if (!this.isOnline) {
      await this.enqueue({ type, endpoint, method, body });
      return { synced: false };
    }

    try {
      const res = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(body)
      });
      return { synced: true, data: res };
    } catch (err: any) {
      // Network drop / unreachable server -> queue offline
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('network'))) {
        this.isOnline = false;
        await this.enqueue({ type, endpoint, method, body });
        return { synced: false };
      }
      throw err;
    }
  }

  // Drain and replay queue in chronological order
  public async syncPending() {
    if (this.isSyncing || this.queue.length === 0 || !this.isOnline) return;

    this.isSyncing = true;
    this.notify();

    const failedItems: OfflineMutation[] = [];

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        await apiRequest(item.endpoint, {
          method: item.method,
          body: JSON.stringify(item.body)
        });
      } catch (err: any) {
        if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
          // Still offline, push item back and abort current loop
          failedItems.push(item);
          failedItems.push(...this.queue);
          this.queue = [];
          this.isOnline = false;
          break;
        }
        // Non-network error (e.g. 400 invalid schema) - drop from queue
        console.warn('Dropping invalid offline mutation:', item, err);
      }
    }

    this.queue = failedItems;
    await this.saveQueue();
    this.isSyncing = false;
    this.notify();
  }
}

export const offlineSyncEngine = new OfflineSyncEngine();
