import React, { useEffect, useState } from 'react';
import { AlertTriangle, Delete, LockKeyhole, RefreshCw, ShieldAlert } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { BrandLogo, BrandName } from '../common/BrandLogo';

export const PinScreen: React.FC = () => {
  const { authStatus, refreshAuthStatus, setupPin, verifyPin } = useFinance();

  const backendReady = authStatus ? authStatus.backendConfigured : true;
  const isSetupMode = authStatus ? authStatus.backendConfigured && !authStatus.pinConfigured : false;
  const targetLength = authStatus?.pinConfigured && authStatus?.pinLength ? authStatus.pinLength : 4;

  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number>(authStatus?.lockedUntil || 0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (authStatus?.lockedUntil) {
      setLockedUntil(authStatus.lockedUntil);
    }
  }, [authStatus?.lockedUntil]);

  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  const isLocked = lockedUntil > nowMs;
  const lockSecondsLeft = isLocked ? Math.ceil((lockedUntil - nowMs) / 1000) : 0;
  const keypadDisabled = submitting || isLocked || !backendReady;

  const handleDigit = (digit: string) => {
    if (keypadDisabled) return;
    setError(null);
    if (pin.length < targetLength) {
      setPin((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    if (keypadDisabled) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleSubmit = async (enteredPin = pin) => {
    if (keypadDisabled) return;
    if (enteredPin.length < 4) {
      setError(`Enter your ${targetLength}-digit PIN.`);
      return;
    }

    if (isSetupMode) {
      if (step === 'create') {
        setFirstPin(enteredPin);
        setPin('');
        setStep('confirm');
        return;
      }
      if (enteredPin !== firstPin) {
        setError('PINs do not match. Please try again.');
        setPin('');
        setFirstPin('');
        setStep('create');
        return;
      }
      setSubmitting(true);
      try {
        await setupPin(firstPin, enteredPin);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to save PIN.');
        setPin('');
        setStep('create');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      await verifyPin(enteredPin);
    } catch (err) {
      const e = err as Error & { lockedUntil?: number };
      if (e.lockedUntil) setLockedUntil(e.lockedUntil);
      setError(e.message || 'Incorrect PIN.');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit when reaching target length on unlock/confirm
  useEffect(() => {
    if (pin.length === targetLength && !keypadDisabled) {
      handleSubmit(pin);
    }
  }, [pin]);

  // Keyboard support on desktop
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Enter' && pin.length >= 4) {
        handleSubmit(pin);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pin, step, firstPin, isSetupMode, isLocked, submitting, backendReady]);

  const handleRetryBackend = async () => {
    setRetrying(true);
    await refreshAuthStatus();
    setRetrying(false);
  };

  const titleText = isSetupMode
    ? step === 'create'
      ? 'Create your 4-digit PIN'
      : 'Confirm your PIN'
    : 'Enter your PIN';

  const subtitleText = isSetupMode
    ? 'Your PIN is salted and hashed on the server. Never stored in plaintext.'
    : 'Unlock to access your financial dashboard.';

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F7F8FA] dark:bg-[#101216] px-4 py-8 pt-safe pb-safe">
      <div className="w-full max-w-sm rounded-[24px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-7 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <BrandLogo size={64} />
          <h1 className="mt-4">
            <BrandName size="xl" />
          </h1>
          <p className="mt-1 text-xs font-medium text-[#747B8A] dark:text-[#9CA3AF]">
            Finance, Clearly.
          </p>

          {!backendReady && authStatus?.adminError && (
            <div className="mt-5 w-full rounded-2xl border border-[#F59E0B]/40 bg-[#F59E0B]/5 p-4 text-left space-y-2.5">
              <div className="flex items-start gap-2 text-xs font-semibold text-[#F59E0B]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Backend Configuration Required</span>
              </div>
              <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF] leading-relaxed">
                {authStatus.adminError}
              </p>
              <button
                type="button"
                disabled={retrying}
                onClick={handleRetryBackend}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] bg-white dark:bg-[#101216] px-3 py-1.5 text-xs font-semibold text-[#171A22] dark:text-[#F8FAFC] hover:opacity-90"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
                <span>{retrying ? 'Checking...' : 'Retry Connection'}</span>
              </button>
            </div>
          )}

          <div className="mt-6">
            <p className="text-base font-semibold text-[#171A22] dark:text-[#F8FAFC]">{titleText}</p>
            <p className="mt-1 text-xs text-[#747B8A] dark:text-[#9CA3AF] max-w-[260px] mx-auto">
              {subtitleText}
            </p>
          </div>

          {/* PIN Dot Indicators */}
          <div className="mt-6 flex items-center justify-center gap-3.5" aria-label="PIN progress">
            {Array.from({ length: targetLength }).map((_, idx) => {
              const filled = idx < pin.length;
              return (
                <div
                  key={idx}
                  className={`h-3.5 w-3.5 rounded-full transition-all duration-150 ${
                    filled
                      ? 'bg-[#1677FF] scale-110 shadow-xs shadow-[#1677FF]/40'
                      : 'bg-[#E7EAF0] dark:bg-[#30343D]'
                  }`}
                />
              );
            })}
          </div>

          {error && (
            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-[#DC2626]">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLocked && (
            <p className="mt-3 text-xs font-medium text-[#F59E0B] tabular-nums">
              Locked for security. Try again in {lockSecondsLeft}s.
            </p>
          )}
        </div>

        {/* Numeric Keypad */}
        <div className="mt-7 grid grid-cols-3 gap-3 max-w-[264px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={keypadDisabled}
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-[#F7F8FA] dark:bg-[#101216] border border-[#E7EAF0] dark:border-[#30343D] text-xl font-semibold text-[#171A22] dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#232730] active:scale-95 transition tabular-nums disabled:opacity-40"
            >
              {digit}
            </button>
          ))}

          <div aria-hidden="true" />

          <button
            type="button"
            disabled={keypadDisabled}
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-[#F7F8FA] dark:bg-[#101216] border border-[#E7EAF0] dark:border-[#30343D] text-xl font-semibold text-[#171A22] dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#232730] active:scale-95 transition tabular-nums disabled:opacity-40"
          >
            0
          </button>

          <button
            type="button"
            disabled={keypadDisabled || pin.length === 0}
            onClick={handleDelete}
            className="h-14 rounded-2xl flex items-center justify-center text-[#747B8A] dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#232730] active:scale-95 transition disabled:opacity-30"
            aria-label="Delete digit"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        <button
          type="button"
          disabled={keypadDisabled || pin.length < 4}
          onClick={() => handleSubmit(pin)}
          className="mt-6 w-full h-12 rounded-xl bg-brand-gradient text-sm font-semibold text-white flex items-center justify-center gap-2 shadow-sm hover:opacity-95 active:scale-[0.98] transition disabled:opacity-40"
        >
          <LockKeyhole className="w-4 h-4" />
          <span>{submitting ? 'Verifying...' : isSetupMode ? (step === 'create' ? 'Continue' : 'Save & Unlock') : 'Unlock'}</span>
        </button>
      </div>
    </div>
  );
};
