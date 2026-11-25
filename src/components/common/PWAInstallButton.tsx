import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { BrandName } from './BrandLogo';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.98] transition whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Download className="w-4 h-4" />
        <span>{compact ? 'Install' : 'Install App'}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowIOSGuide(true)}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] bg-white dark:bg-[#1A1D24] px-3.5 py-2 text-xs font-medium text-[#171A22] dark:text-[#F8FAFC] hover:bg-slate-50 dark:hover:bg-[#232730] active:scale-[0.98] transition whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Smartphone className="w-4 h-4 text-[#1677FF]" />
        <span>{isIOS ? 'Add to iPhone' : 'Install Guide'}</span>
      </button>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-6 pb-safe shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#171A22] dark:text-[#F8FAFC] flex items-baseline gap-1.5">
                <span>Install</span>
                <BrandName size="lg" />
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-2 rounded-xl text-[#747B8A] hover:bg-slate-100 dark:hover:bg-[#232730]"
                aria-label="Close install guide"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-[#747B8A] dark:text-[#9CA3AF]">
              Install FinLens on your Home Screen for a full-screen, offline-ready native experience.
            </p>
            <ol className="mt-4 space-y-3 text-sm text-[#171A22] dark:text-[#F8FAFC]">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#1677FF]/10 text-xs font-semibold text-[#1677FF]">
                  1
                </span>
                <span>
                  On iPhone or iPad, open this page in <strong>Safari</strong> and tap the{' '}
                  <Share className="inline w-4 h-4 text-[#1677FF]" /> <strong>Share</strong> button.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#1677FF]/10 text-xs font-semibold text-[#1677FF]">
                  2
                </span>
                <span>
                  Scroll down and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#1677FF]/10 text-xs font-semibold text-[#1677FF]">
                  3
                </span>
                <span>
                  On desktop Chrome or Edge, click the <strong>Install</strong> icon in the address bar.
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-6 w-full rounded-xl bg-brand-gradient py-3 text-sm font-semibold text-white"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
