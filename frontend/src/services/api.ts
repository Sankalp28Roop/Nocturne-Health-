import { handleLocalApi } from './localApi';

const SERVER_HOST_KEY = 'nocturne_backend_host';
const LOCAL_STORAGE_MODE_KEY = 'nocturne_prefer_local_engine';

export function getCustomBackendHost(): string | null {
  return localStorage.getItem(SERVER_HOST_KEY);
}

export function setCustomBackendHost(host: string) {
  const clean = host.trim().replace(/^https?:\/\//, '').replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  localStorage.setItem(SERVER_HOST_KEY, clean);
}

export function resolveBaseUrl(): string {
  const custom = getCustomBackendHost();
  if (custom) {
    return custom.startsWith('http') ? `${custom}/api/v1` : `http://${custom}/api/v1`;
  }

  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  return 'http://192.168.1.4:4000/api/v1';
}

export function getApiBaseUrl(): string {
  return resolveBaseUrl();
}

const TOKEN_KEY = 'nocturne_access_token';
const REFRESH_KEY = 'nocturne_refresh_token';
const USER_KEY = 'nocturne_current_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredTokens(accessToken: string, refreshToken?: string, user?: any) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): any | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

/**
 * apiRequest:
 * Local-First Architecture:
 * 1. Executes directly on-device using handleLocalApi (100% private, no cloud, no Mac dependency).
 * 2. If user specifically configured an external backend host, it tries external first,
 *    and falls back cleanly to local-first if unavailable.
 */
export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const customHost = getCustomBackendHost();

  // If the user hasn't explicitly configured a remote server, run 100% ON-DEVICE
  if (!customHost) {
    return handleLocalApi(endpoint, options) as Promise<T>;
  }

  // If a custom host is specified, try network with automatic fallback to local engine
  try {
    const token = getStoredToken();
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const baseUrl = resolveBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.status === 401) {
      clearStoredAuth();
      window.dispatchEvent(new Event('nocturne_auth_unauthorized'));
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Request failed with status ${response.status}`);
    }

    return response.json();
  } catch (netErr: any) {
    console.warn(`[Nocturne] Remote server at ${customHost} unavailable (${netErr.message}). Falling back to On-Device local engine.`);
    return handleLocalApi(endpoint, options) as Promise<T>;
  }
}
