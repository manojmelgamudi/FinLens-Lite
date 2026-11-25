import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const ALLOWED_FINANCE_ACTIONS = new Set([
  'addPerson',
  'updatePerson',
  'archivePerson',
  'restorePerson',
  'addTransaction',
  'updateTransaction',
  'reverseTransaction',
  'archiveTransaction',
  'createEMIPlan',
  'recordEMIPayment',
  'updateInstallment',
  'pauseEMIPlan',
  'resumeEMIPlan',
  'cancelEMIPlan',
  'completeEMIPlan',
  'addInvestment',
  'updateInvestment',
  'archiveInvestment',
  'addDebt',
  'updateDebt',
  'settleDebt',
  'archiveDebt',
  'updateSettings',
  'updateLists',
  'addCustomField',
  'updateCustomField',
  'archiveCustomField',
  'importWorkbookSeed',
]);

// Defense-in-depth per-IP rate limiting at the Express boundary in addition to Apps Script lockout
const ipRateLimitMap = new Map<string, { attempts: number; lockedUntil: number }>();

function getClientKey(req: Request): string {
  return String(req.ip || req.headers['x-forwarded-for'] || 'default');
}

export class AppsScriptProxyError extends Error {
  status: number;
  code?: string;
  lockedUntil?: number;
  failedAttempts?: number;

  constructor(
    message: string,
    status = 400,
    opts?: { code?: string; lockedUntil?: number; failedAttempts?: number }
  ) {
    super(message);
    this.status = status;
    this.code = opts?.code;
    this.lockedUntil = opts?.lockedUntil;
    this.failedAttempts = opts?.failedAttempts;
  }
}

function validateGasUrl(rawUrl: string): string {
  const clean = rawUrl.trim();
  if (!clean) {
    throw new AppsScriptProxyError(
      'Backend Apps Script Web App URL (GAS_WEB_APP_URL) is not configured on the server.',
      503,
      { code: 'BACKEND_NOT_CONFIGURED' }
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    throw new AppsScriptProxyError(
      'Configured GAS_WEB_APP_URL is invalid. Administrator must configure a valid https://script.google.com Web App URL.',
      503,
      { code: 'BACKEND_NOT_CONFIGURED' }
    );
  }
  if (
    parsed.protocol !== 'https:' ||
    (parsed.hostname !== 'script.google.com' && parsed.hostname !== 'script.googleusercontent.com')
  ) {
    throw new AppsScriptProxyError(
      'GAS_WEB_APP_URL must be an https://script.google.com Web App deployment URL.',
      503,
      { code: 'BACKEND_NOT_CONFIGURED' }
    );
  }
  return clean;
}

async function callAppsScript<T = unknown>(
  action: string,
  params: Record<string, unknown> = {},
  sessionToken = ''
): Promise<T> {
  const gasUrl = validateGasUrl(String(process.env.GAS_WEB_APP_URL || ''));
  const apiSecret = String(process.env.GAS_API_SECRET || '');

  let gasRes: globalThis.Response;
  try {
    gasRes = await fetch(gasUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        params,
        sessionToken,
        apiSecret,
      }),
    });
  } catch {
    throw new AppsScriptProxyError(
      'Unable to reach the Google Apps Script backend. Please check network connectivity or GAS_WEB_APP_URL.',
      503,
      { code: 'BACKEND_UNREACHABLE' }
    );
  }

  const contentType = gasRes.headers.get('content-type') || '';
  const bodyText = await gasRes.text();

  // Detect Google Sign-In HTML redirect or Apps Script permission error pages
  // Never redirect website visitors to Google login; return a clear administrator message instead.
  if (
    contentType.includes('text/html') ||
    bodyText.trimStart().startsWith('<') ||
    bodyText.includes('accounts.google.com')
  ) {
    throw new AppsScriptProxyError(
      'Apps Script backend authorization error. Administrator: deploy the Apps Script Web App with "Execute as: Me" and "Who has access: Anyone", and authorize SpreadsheetApp permissions once in the Apps Script editor.',
      503,
      { code: 'BACKEND_AUTH_REQUIRED' }
    );
  }

  let parsed: {
    ok?: boolean;
    data?: T;
    error?: string;
    code?: string;
    lockedUntil?: number;
    failedAttempts?: number;
  };
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new AppsScriptProxyError(
      'Unexpected response received from the Apps Script backend.',
      502,
      { code: 'BACKEND_INVALID_RESPONSE' }
    );
  }

  if (!parsed || parsed.ok === false) {
    const code = parsed?.code;
    let status = 400;
    if (code === 'PIN_LOCKED') status = 429;
    else if (code === 'INVALID_PIN' || code === 'SESSION_EXPIRED') status = 401;
    else if (code === 'BACKEND_AUTH_REQUIRED' || code === 'UNAUTHORIZED_SECRET') status = 503;

    throw new AppsScriptProxyError(parsed?.error || 'Apps Script request failed.', status, {
      code,
      lockedUntil: parsed?.lockedUntil,
      failedAttempts: parsed?.failedAttempts,
    });
  }

  return parsed.data as T;
}

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice('Bearer '.length).trim();
}

function requireBearerHeader(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({
      ok: false,
      code: 'SESSION_EXPIRED',
      error: 'Authentication required. Please enter your PIN.',
    });
    return;
  }
  (req as Request & { sessionToken?: string }).sessionToken = token;
  next();
}

function sendErrorResponse(res: Response, err: unknown) {
  if (err instanceof AppsScriptProxyError) {
    res.status(err.status).json({
      ok: false,
      code: err.code,
      error: err.message,
      lockedUntil: err.lockedUntil,
      failedAttempts: err.failedAttempts,
    });
    return;
  }
  const msg = err instanceof Error ? err.message : 'Unexpected server error.';
  res.status(500).json({ ok: false, error: msg });
}

export function createApiApp() {
  const app = express();
  app.set('trust proxy', true);

  // Optional CORS support for split frontend/backend deployments
  const allowedOrigin = String(process.env.CORS_ORIGIN || '').trim();
  if (allowedOrigin) {
    app.use('/api', (req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    });
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.body !== undefined && typeof req.body === 'object') {
      next();
      return;
    }
    express.json({ limit: '5mb' })(req, res, next);
  });

  // ---------------------------------------------------------------------------
  // 1. PUBLIC PIN AUTHENTICATION ROUTES (PROXIED TO GOOGLE APPS SCRIPT)
  // ---------------------------------------------------------------------------
  app.get('/api/auth/status', async (req: Request, res: Response) => {
    try {
      const data = await callAppsScript<{
        backendConfigured?: boolean;
        spreadsheetReady?: boolean;
        adminError?: string;
        pinConfigured: boolean;
        pinLength: number;
        lockedUntil: number;
        failedAttempts: number;
        sessionTimeoutMinutes: number;
      }>('getAuthStatus');

      const clientKey = getClientKey(req);
      const rl = ipRateLimitMap.get(clientKey);
      const ipLock = rl && rl.lockedUntil > Date.now() ? rl.lockedUntil : 0;

      res.json({
        ok: true,
        data: {
          backendConfigured: data.backendConfigured !== false && data.spreadsheetReady !== false,
          adminError: data.adminError || '',
          pinConfigured: Boolean(data.pinConfigured),
          pinLength: data.pinLength || 4,
          lockedUntil: Math.max(data.lockedUntil || 0, ipLock),
          failedAttempts: Math.max(data.failedAttempts || 0, rl?.attempts || 0),
          sessionTimeoutMinutes: data.sessionTimeoutMinutes || 15,
        },
      });
    } catch (err) {
      if (err instanceof AppsScriptProxyError && err.status === 503) {
        res.json({
          ok: true,
          data: {
            backendConfigured: false,
            adminError: err.message,
            pinConfigured: false,
            pinLength: 4,
            lockedUntil: 0,
            failedAttempts: 0,
            sessionTimeoutMinutes: 15,
          },
        });
        return;
      }
      sendErrorResponse(res, err);
    }
  });

  app.post('/api/auth/setup-pin', async (req: Request, res: Response) => {
    try {
      const pin = String(req.body?.pin || '').trim();
      const confirmPin = String(req.body?.confirmPin || '').trim();
      if (!/^\d{4,8}$/.test(pin)) {
        res.status(400).json({ ok: false, error: 'PIN must be between 4 and 8 digits.' });
        return;
      }
      if (pin !== confirmPin) {
        res.status(400).json({ ok: false, error: 'PIN confirmation does not match.' });
        return;
      }

      const data = await callAppsScript<{
        sessionToken: string;
        expiresAt: number;
        pinLength: number;
      }>('setupPin', { pin, confirmPin });

      res.json({ ok: true, data });
    } catch (err) {
      sendErrorResponse(res, err);
    }
  });

  app.post('/api/auth/verify-pin', async (req: Request, res: Response) => {
    const clientKey = getClientKey(req);
    const rl = ipRateLimitMap.get(clientKey) || { attempts: 0, lockedUntil: 0 };
    if (rl.lockedUntil > Date.now()) {
      const waitSec = Math.ceil((rl.lockedUntil - Date.now()) / 1000);
      res.status(429).json({
        ok: false,
        code: 'PIN_LOCKED',
        error: `Too many incorrect attempts. Try again in ${waitSec}s.`,
        lockedUntil: rl.lockedUntil,
      });
      return;
    }

    const pin = String(req.body?.pin || '').trim();
    if (!/^\d{4,8}$/.test(pin)) {
      res.status(400).json({ ok: false, error: 'Enter a valid numeric PIN.' });
      return;
    }

    try {
      const data = await callAppsScript<{ sessionToken: string; expiresAt: number }>('verifyPin', { pin });
      ipRateLimitMap.delete(clientKey);
      res.json({ ok: true, data });
    } catch (err) {
      if (err instanceof AppsScriptProxyError && err.code === 'INVALID_PIN') {
        const nextAttempts = rl.attempts + 1;
        if (nextAttempts >= 5) {
          const lockedUntil = Date.now() + 5 * 60 * 1000;
          ipRateLimitMap.set(clientKey, { attempts: 0, lockedUntil });
          res.status(429).json({
            ok: false,
            code: 'PIN_LOCKED',
            error: 'Maximum attempts reached. Locked for 5 minutes.',
            lockedUntil,
          });
          return;
        }
        ipRateLimitMap.set(clientKey, { attempts: nextAttempts, lockedUntil: 0 });
      }
      sendErrorResponse(res, err);
    }
  });

  app.post('/api/auth/change-pin', requireBearerHeader, async (req: Request, res: Response) => {
    try {
      const token = (req as Request & { sessionToken: string }).sessionToken;
      const currentPin = String(req.body?.currentPin || '').trim();
      const newPin = String(req.body?.newPin || '').trim();
      const confirmPin = String(req.body?.confirmPin || '').trim();

      const data = await callAppsScript<{ pinLength?: number }>(
        'changePin',
        { currentPin, newPin, confirmPin },
        token
      );
      res.json({ ok: true, data });
    } catch (err) {
      sendErrorResponse(res, err);
    }
  });

  app.get('/api/auth/session', requireBearerHeader, async (req: Request, res: Response) => {
    try {
      const token = (req as Request & { sessionToken: string }).sessionToken;
      const data = await callAppsScript<{ valid: boolean; expiresAt?: number }>('validateSession', {}, token);
      res.json({ ok: true, data });
    } catch (err) {
      sendErrorResponse(res, err);
    }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (token && process.env.GAS_WEB_APP_URL) {
      try {
        await callAppsScript('logout', {}, token);
      } catch {
        // Ignore backend error during logout cleanup
      }
    }
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // 2. PROTECTED FINANCIAL ROUTES (SESSION-GATED -> GOOGLE APPS SCRIPT)
  // ---------------------------------------------------------------------------
  app.get('/api/finance/dashboard', requireBearerHeader, async (req: Request, res: Response) => {
    try {
      const token = (req as Request & { sessionToken: string }).sessionToken;
      const data = await callAppsScript('getDashboardSummary', {}, token);
      res.json({ ok: true, data });
    } catch (err) {
      sendErrorResponse(res, err);
    }
  });

  app.post('/api/finance/action', requireBearerHeader, async (req: Request, res: Response) => {
    try {
      const token = (req as Request & { sessionToken: string }).sessionToken;
      const action = String(req.body?.action || '').trim();
      const operationId = String(req.body?.operationId || '').trim();
      const payload = (req.body?.payload || {}) as Record<string, unknown>;

      if (!ALLOWED_FINANCE_ACTIONS.has(action)) {
        res.status(400).json({ ok: false, error: `Unsupported action: ${action}` });
        return;
      }

      const data = await callAppsScript(
        'syncAction',
        {
          subAction: action,
          operationId,
          ...payload,
        },
        token
      );
      res.json({ ok: true, data });
    } catch (err) {
      sendErrorResponse(res, err);
    }
  });

  // Ensure unmatched /api/* routes always return JSON instead of falling back to HTML
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ ok: false, error: 'API endpoint not found.' });
  });

  // Ensure Express body-parser/middleware errors on /api/* also return JSON
  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    sendErrorResponse(res, err);
  });

  return app;
}
