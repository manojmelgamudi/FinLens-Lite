import { FinanceDataset, PendingSyncOperation } from '../types/finance';

// Strictly in-memory PIN session token (never stored in localStorage or sessionStorage)
let sessionTokenInMemory: string | null = null;

export function setSessionToken(token: string | null) {
  sessionTokenInMemory = token;
}

export function getSessionToken(): string | null {
  return sessionTokenInMemory;
}

export interface AuthStatusResponse {
  backendConfigured: boolean;
  adminError?: string;
  pinConfigured: boolean;
  pinLength: number;
  lockedUntil: number;
  failedAttempts: number;
  sessionTimeoutMinutes: number;
}

export interface SheetDatasetResponse {
  spreadsheetId?: string;
  title: string;
  sheetNames: string[];
  dataset: FinanceDataset;
}

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (sessionTokenInMemory) {
    headers['Authorization'] = `Bearer ${sessionTokenInMemory}`;
  }

  const targetUrl = API_BASE_URL && url.startsWith('/') ? `${API_BASE_URL}${url}` : url;

  let res: Response;
  try {
    res = await fetch(targetUrl, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      'Unable to reach the backend server. Check that your server is running and reachable.'
    );
  }

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  let parsed: {
    ok?: boolean;
    data?: T;
    error?: string;
    code?: string;
    lockedUntil?: number;
  } = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    if (contentType.includes('text/html') || text.trimStart().startsWith('<')) {
      throw new Error(
        'Backend API (/api) is not active on this host (received HTML instead of JSON). Deploy with the Node server (npm start) or Vercel serverless API routes, and set GAS_WEB_APP_URL and GAS_API_SECRET in your host environment variables.'
      );
    }
    throw new Error(`Unexpected response from server (HTTP ${res.status}).`);
  }

  if (!res.ok || parsed.ok === false) {
    const err = new Error(parsed.error || `Request failed (${res.status})`) as Error & {
      status?: number;
      code?: string;
      lockedUntil?: number;
    };
    err.status = res.status;
    err.code = parsed.code;
    err.lockedUntil = parsed.lockedUntil;
    throw err;
  }

  return parsed.data as T;
}

export const authApi = {
  getStatus: () => apiFetch<AuthStatusResponse>('/api/auth/status'),
  setupPin: async (pin: string, confirmPin: string) => {
    const data = await apiFetch<{ sessionToken: string; expiresAt: number; pinLength: number }>(
      '/api/auth/setup-pin',
      { method: 'POST', body: JSON.stringify({ pin, confirmPin }) }
    );
    setSessionToken(data.sessionToken);
    return data;
  },
  verifyPin: async (pin: string) => {
    const data = await apiFetch<{ sessionToken: string; expiresAt: number }>(
      '/api/auth/verify-pin',
      { method: 'POST', body: JSON.stringify({ pin }) }
    );
    setSessionToken(data.sessionToken);
    return data;
  },
  changePin: (currentPin: string, newPin: string, confirmPin: string) =>
    apiFetch<{ pinLength?: number }>('/api/auth/change-pin', {
      method: 'POST',
      body: JSON.stringify({ currentPin, newPin, confirmPin }),
    }),
  validateSession: () => apiFetch<{ valid: boolean; expiresAt?: number }>('/api/auth/session'),
  logout: async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setSessionToken(null);
    }
  },
};

export const financeApi = {
  fetchDashboard: () => apiFetch<SheetDatasetResponse>('/api/finance/dashboard'),
  syncAction: (action: string, payload: Record<string, unknown>, operationId: string) =>
    apiFetch<SheetDatasetResponse>('/api/finance/action', {
      method: 'POST',
      body: JSON.stringify({ action, payload, operationId }),
    }),
};

const QUEUE_STORAGE_KEY = 'pf_pending_sync_queue_v1';
const SNAPSHOT_STORAGE_KEY = 'pf_offline_snapshot_v1';

export function loadPendingQueue(): PendingSyncOperation[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingSyncOperation[]) : [];
  } catch {
    return [];
  }
}

export function savePendingQueue(queue: PendingSyncOperation[]) {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // ignore storage quota errors
  }
}

export function loadOfflineSnapshot(): FinanceDataset | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FinanceDataset) : null;
  } catch {
    return null;
  }
}

export function saveOfflineSnapshot(dataset: FinanceDataset) {
  try {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(dataset));
  } catch {
    // ignore
  }
}
