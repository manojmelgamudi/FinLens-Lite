import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  authApi,
  AuthStatusResponse,
  financeApi,
  getSessionToken,
  loadOfflineSnapshot,
  loadPendingQueue,
  saveOfflineSnapshot,
  savePendingQueue,
  setSessionToken,
} from '../services/apiClient';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  CurrencyCode,
  DateRangeFilter,
  FinanceDataset,
  PendingSyncOperation,
  SyncState,
} from '../types/finance';
import { DEFAULT_LISTS, DEFAULT_SETTINGS } from '../utils/workbookSeed';

const EMPTY_DATASET: FinanceDataset = {
  people: [],
  transactions: [],
  emiPlans: [],
  emiSchedule: [],
  investments: [],
  debts: [],
  customFields: [],
  settings: DEFAULT_SETTINGS,
  lists: DEFAULT_LISTS,
  activityLog: [],
};

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface FinanceContextValue {
  // PIN Auth & Session
  authStatus: AuthStatusResponse | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  refreshAuthStatus: () => Promise<void>;
  setupPin: (pin: string, confirmPin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<void>;
  lockApp: () => Promise<void>;

  // Apps Script Backend & Dataset State
  spreadsheetTitle: string | null;
  backendError: string | null;
  dataset: FinanceDataset;
  hasDataLoaded: boolean;
  syncState: SyncState;
  syncError: string | null;
  pendingQueue: PendingSyncOperation[];
  isOnline: boolean;
  syncNow: () => Promise<void>;
  retryPendingQueue: () => Promise<void>;
  performSyncAction: (
    action: string,
    payload: Record<string, unknown>,
    description: string
  ) => Promise<boolean>;

  // Display state
  displayCurrency: CurrencyCode;
  setDisplayCurrency: (c: CurrencyCode) => void;
  dateFilter: DateRangeFilter;
  setDateFilter: (f: DateRangeFilter) => void;

  // Toasts
  toasts: ToastMessage[];
  pushToast: (type: ToastMessage['type'], text: string) => void;
  dismissToast: (id: string) => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isOnline = useOnlineStatus();

  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Never load or expose financial data before PIN authentication succeeds
  const [dataset, setDataset] = useState<FinanceDataset>(EMPTY_DATASET);
  const [hasDataLoaded, setHasDataLoaded] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingQueue, setPendingQueue] = useState<PendingSyncOperation[]>(() => loadPendingQueue());

  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>('INR');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>({ preset: 'all' });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const inactivityTimerRef = useRef<number | null>(null);

  const pushToast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshAuthStatus = useCallback(async () => {
    try {
      const status = await authApi.getStatus();
      setAuthStatus(status);
      setBackendError(status.backendConfigured ? null : status.adminError || 'Backend is not configured.');
    } catch (err) {
      setAuthStatus({
        backendConfigured: false,
        adminError:
          err instanceof Error
            ? err.message
            : 'Unable to reach server authentication status endpoint.',
        pinConfigured: false,
        pinLength: 4,
        lockedUntil: 0,
        failedAttempts: 0,
        sessionTimeoutMinutes: 15,
      });
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuthStatus();
  }, [refreshAuthStatus]);

  const clearAuthenticatedState = useCallback(() => {
    setIsAuthenticated(false);
    setSessionToken(null);
    setDataset(EMPTY_DATASET);
    setHasDataLoaded(false);
    setSpreadsheetTitle(null);
  }, []);

  const lockApp = useCallback(async () => {
    await authApi.logout();
    clearAuthenticatedState();
    await refreshAuthStatus();
  }, [clearAuthenticatedState, refreshAuthStatus]);

  // Inactivity session timeout tracker + periodic server session renewal
  useEffect(() => {
    if (!isAuthenticated) return;
    const timeoutMs = Math.max(1, dataset.settings.sessionTimeoutMinutes || authStatus?.sessionTimeoutMinutes || 15) * 60 * 1000;

    const resetTimer = () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = window.setTimeout(() => {
        lockApp();
        pushToast('info', 'Session locked due to inactivity.');
      }, timeoutMs);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    // Renew/validate session with server periodically while active
    const renewInterval = window.setInterval(() => {
      if (!isOnline || !getSessionToken()) return;
      authApi.validateSession().catch((err) => {
        if ((err as Error & { status?: number }).status === 401) {
          clearAuthenticatedState();
          pushToast('info', 'Session expired. Please unlock with your PIN.');
        }
      });
    }, 4 * 60 * 1000);

    return () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      window.clearInterval(renewInterval);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [
    isAuthenticated,
    isOnline,
    dataset.settings.sessionTimeoutMinutes,
    authStatus?.sessionTimeoutMinutes,
    lockApp,
    clearAuthenticatedState,
    pushToast,
  ]);

  const setupPin = async (pin: string, confirmPin: string) => {
    await authApi.setupPin(pin, confirmPin);
    setIsAuthenticated(true);
    await refreshAuthStatus();
  };

  const verifyPin = async (pin: string) => {
    await authApi.verifyPin(pin);
    setIsAuthenticated(true);
    await refreshAuthStatus();
  };

  const sanitizeDataset = useCallback((raw: FinanceDataset): FinanceDataset => {
    const cleanList = <T extends string>(arr: unknown, fallback: T[]): T[] => {
      const source = Array.isArray(arr) && arr.length > 0 ? arr : fallback;
      const seen = new Set<string>();
      const out: T[] = [];
      for (const item of source) {
        const s = String(item ?? '').trim();
        if (s && !seen.has(s)) {
          seen.add(s);
          out.push(s as T);
        }
      }
      return out;
    };

    return {
      ...EMPTY_DATASET,
      ...raw,
      people: Array.isArray(raw?.people) ? raw.people : [],
      transactions: Array.isArray(raw?.transactions) ? raw.transactions : [],
      emiPlans: Array.isArray(raw?.emiPlans) ? raw.emiPlans : [],
      emiSchedule: Array.isArray(raw?.emiSchedule) ? raw.emiSchedule : [],
      investments: Array.isArray(raw?.investments) ? raw.investments : [],
      debts: Array.isArray(raw?.debts) ? raw.debts : [],
      customFields: Array.isArray(raw?.customFields) ? raw.customFields : [],
      activityLog: Array.isArray(raw?.activityLog) ? raw.activityLog : [],
      settings: {
        ...DEFAULT_SETTINGS,
        ...(raw?.settings || {}),
      },
      lists: {
        transactionTypes: cleanList(raw?.lists?.transactionTypes, DEFAULT_LISTS.transactionTypes),
        categories: cleanList(raw?.lists?.categories, DEFAULT_LISTS.categories),
        paymentMethods: cleanList(raw?.lists?.paymentMethods, DEFAULT_LISTS.paymentMethods),
        emiFrequencies: cleanList(raw?.lists?.emiFrequencies, DEFAULT_LISTS.emiFrequencies),
        currencies: cleanList(raw?.lists?.currencies, DEFAULT_LISTS.currencies),
        relationshipTypes: cleanList(raw?.lists?.relationshipTypes, DEFAULT_LISTS.relationshipTypes),
        investmentCategories: cleanList(raw?.lists?.investmentCategories, DEFAULT_LISTS.investmentCategories),
        paymentStatuses: cleanList(raw?.lists?.paymentStatuses, DEFAULT_LISTS.paymentStatuses),
      },
    };
  }, []);

  const applyLoadedDataset = useCallback((nextDataset: FinanceDataset, title?: string) => {
    const cleanDataset = sanitizeDataset(nextDataset);
    setDataset(cleanDataset);
    setHasDataLoaded(true);
    setDisplayCurrency(cleanDataset.settings?.defaultCurrency || 'INR');
    saveOfflineSnapshot(cleanDataset);
    if (title) {
      setSpreadsheetTitle(title);
    }
    setBackendError(null);
    setSyncState('synced');
    setSyncError(null);
  }, [sanitizeDataset]);

  const syncNow = useCallback(async () => {
    if (!isAuthenticated || !getSessionToken()) return;
    if (!isOnline) {
      setSyncState('offline');
      const snap = loadOfflineSnapshot();
      if (snap && !hasDataLoaded) {
        setDataset(sanitizeDataset(snap));
        setHasDataLoaded(true);
      }
      return;
    }

    setSyncState('syncing');
    setSyncError(null);
    try {
      const res = await financeApi.fetchDashboard();
      applyLoadedDataset(res.dataset, res.title);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) {
        clearAuthenticatedState();
        pushToast('error', e.message || 'Session expired. Please unlock with your PIN.');
        return;
      }
      const msg = e.message || 'Failed to sync with Google Apps Script backend.';
      setSyncState('failed');
      setSyncError(msg);
      if (e.status === 503) {
        setBackendError(msg);
      }
    }
  }, [isAuthenticated, isOnline, hasDataLoaded, applyLoadedDataset, clearAuthenticatedState, pushToast]);

  // Fetch financial data ONLY after PIN authentication succeeds
  useEffect(() => {
    if (isAuthenticated) {
      syncNow();
    }
  }, [isAuthenticated, syncNow]);

  // Offline status indicator
  useEffect(() => {
    if (!isOnline) {
      setSyncState('offline');
    } else if (pendingQueue.length > 0) {
      setSyncState('pending');
    }
  }, [isOnline, pendingQueue.length]);

  const retryPendingQueue = useCallback(async () => {
    if (!isOnline || !isAuthenticated || !getSessionToken()) return;
    const queue = loadPendingQueue();
    if (queue.length === 0) return;

    setSyncState('syncing');
    const remaining: PendingSyncOperation[] = [];
    for (let i = 0; i < queue.length; i++) {
      const op = queue[i];
      try {
        const res = await financeApi.syncAction(op.action, op.payload, op.operationId);
        applyLoadedDataset(res.dataset, res.title);
      } catch (err) {
        const e = err as Error & { status?: number };
        if (e.status === 401) {
          clearAuthenticatedState();
          pushToast('error', 'Session expired. Please unlock to finish syncing.');
          return;
        }
        const msg = e.message || 'Sync failed';
        remaining.push({ ...op, retries: op.retries + 1, lastError: msg });
        for (let j = i + 1; j < queue.length; j++) {
          remaining.push(queue[j]);
        }
        setSyncState('failed');
        setSyncError(msg);
        break;
      }
    }
    setPendingQueue(remaining);
    savePendingQueue(remaining);
    if (remaining.length === 0) {
      setSyncState('synced');
      pushToast('success', 'All pending offline changes synchronized to Google Sheets.');
    }
  }, [isOnline, isAuthenticated, applyLoadedDataset, clearAuthenticatedState, pushToast]);

  // Auto-flush queue when back online
  useEffect(() => {
    if (isOnline && pendingQueue.length > 0 && isAuthenticated) {
      retryPendingQueue();
    }
  }, [isOnline, pendingQueue.length, isAuthenticated, retryPendingQueue]);

  const performSyncAction = async (
    action: string,
    payload: Record<string, unknown>,
    description: string
  ): Promise<boolean> => {
    if (!isAuthenticated || !getSessionToken()) {
      pushToast('error', 'Session locked. Please unlock with your PIN.');
      return false;
    }

    const operationId = crypto.randomUUID ? crypto.randomUUID() : `OP-${Date.now()}-${Math.random()}`;

    if (!isOnline) {
      const op: PendingSyncOperation = {
        operationId,
        action,
        payload,
        createdAt: new Date().toISOString(),
        description,
        retries: 0,
      };
      const nextQueue = [...pendingQueue, op];
      setPendingQueue(nextQueue);
      savePendingQueue(nextQueue);
      setSyncState('pending');
      pushToast('info', `Offline: "${description}" saved to pending sync queue.`);
      return true;
    }

    setSyncState('syncing');
    setSyncError(null);
    try {
      const res = await financeApi.syncAction(action, payload, operationId);
      applyLoadedDataset(res.dataset, res.title);
      pushToast('success', `${description} — synced to Google Sheets.`);
      return true;
    } catch (err) {
      const e = err as Error & { status?: number };
      const msg = e.message || 'Synchronization failed.';
      if (e.status === 401) {
        clearAuthenticatedState();
      }
      setSyncState('failed');
      setSyncError(msg);
      pushToast('error', msg);
      return false;
    }
  };

  return (
    <FinanceContext.Provider
      value={{
        authStatus,
        isAuthenticated,
        authLoading,
        refreshAuthStatus,
        setupPin,
        verifyPin,
        lockApp,
        spreadsheetTitle,
        backendError,
        dataset,
        hasDataLoaded,
        syncState,
        syncError,
        pendingQueue,
        isOnline,
        syncNow,
        retryPendingQueue,
        performSyncAction,
        displayCurrency,
        setDisplayCurrency,
        dateFilter,
        setDateFilter,
        toasts,
        pushToast,
        dismissToast,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used inside FinanceProvider');
  return ctx;
}
