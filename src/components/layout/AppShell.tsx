import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  CloudOff,
  FileBarChart2,
  House,
  Landmark,
  LockKeyhole,
  Menu,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Users,
  AlertCircle,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { computeInstallmentStatus, formatCurrency, getTodayISO } from '../../utils/calculations';
import { BrandLogo, BrandName } from '../common/BrandLogo';
import { BottomSheet } from '../common/BottomSheet';
import { PWAInstallButton } from '../common/PWAInstallButton';

export type NavSection =
  | 'home'
  | 'people'
  | 'emi'
  | 'transactions'
  | 'investments'
  | 'debts'
  | 'reports'
  | 'settings';

interface AppShellProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  onOpenSearch: () => void;
  onOpenAdd: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeSection,
  onNavigate,
  onOpenSearch,
  onOpenAdd,
  children,
}) => {
  const {
    dataset,
    syncState,
    pendingQueue,
    syncNow,
    retryPendingQueue,
    lockApp,
    spreadsheetTitle,
    hasDataLoaded,
  } = useFinance();

  const [moreOpen, setMoreOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  const todayISO = getTodayISO();
  const emiAlerts = useMemo(() => {
    return dataset.emiSchedule
      .map((i) => ({ ...i, status: computeInstallmentStatus(i, todayISO) }))
      .filter(
        (i) =>
          i.remainingAmount > 0.01 &&
          (i.status === 'Overdue' || i.dueDate === todayISO)
      )
      .slice(0, 6);
  }, [dataset.emiSchedule, todayISO]);

  const syncMeta = () => {
    switch (syncState) {
      case 'syncing':
        return {
          icon: <RefreshCw className="w-4 h-4 animate-spin text-[#1677FF] shrink-0" />,
          label: 'Syncing...',
          sub: 'Updating Google Sheets',
          color: 'text-[#1677FF]',
          onClick: () => {},
        };
      case 'offline':
        return {
          icon: <CloudOff className="w-4 h-4 text-[#F59E0B] shrink-0" />,
          label: 'Offline',
          sub: 'Changes queued locally',
          color: 'text-[#F59E0B]',
          onClick: () => syncNow(),
        };
      case 'pending':
        return {
          icon: <RefreshCw className="w-4 h-4 text-[#F59E0B] shrink-0" />,
          label: `Pending (${pendingQueue.length})`,
          sub: 'Tap to retry sync',
          color: 'text-[#F59E0B]',
          onClick: () => retryPendingQueue(),
        };
      case 'failed':
        return {
          icon: <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />,
          label: 'Sync Failed',
          sub: 'Tap to retry',
          color: 'text-[#DC2626]',
          onClick: () => syncNow(),
        };
      default:
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />,
          label: hasDataLoaded ? 'Synced' : 'Ready',
          sub: spreadsheetTitle || 'Tap to refresh from Google Sheets',
          color: 'text-[#16A34A]',
          onClick: () => syncNow(),
        };
    }
  };

  const sidebarItems: { id: NavSection; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <House className="w-4 h-4" /> },
    { id: 'people', label: 'People', icon: <Users className="w-4 h-4" /> },
    { id: 'emi', label: 'EMI Tracker', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'transactions', label: 'Transactions', icon: <ArrowLeftRight className="w-4 h-4" /> },
    { id: 'investments', label: 'Investments', icon: <ChartNoAxesCombined className="w-4 h-4" /> },
    { id: 'debts', label: 'Debts', icon: <Landmark className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <FileBarChart2 className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const isMoreActive = ['investments', 'debts', 'reports', 'settings'].includes(activeSection);

  return (
    <div className="min-h-screen flex bg-[#F7F8FA] dark:bg-[#101216] text-[#171A22] dark:text-[#F8FAFC]">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-white dark:bg-[#1A1D24] border-r border-[#E7EAF0] dark:border-[#30343D] z-30 no-print">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-[#E7EAF0] dark:border-[#30343D]">
          <BrandLogo size={36} />
          <div className="min-w-0">
            <BrandName size="sm" />
            <p className="mt-0.5 text-[11px] text-[#747B8A] dark:text-[#9CA3AF]">Finance, Clearly.</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  active
                    ? 'bg-brand-gradient text-white shadow-xs'
                    : 'text-[#747B8A] dark:text-[#9CA3AF] hover:bg-[#F7F8FA] dark:hover:bg-[#101216] hover:text-[#171A22] dark:hover:text-white'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#E7EAF0] dark:border-[#30343D] space-y-2">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={lockApp}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-[#747B8A] hover:bg-[#F7F8FA] dark:hover:bg-[#101216] hover:text-[#DC2626] transition"
          >
            <LockKeyhole className="w-4 h-4" />
            <span>Lock Vault</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-60 print:pl-0 flex flex-col min-w-0">
        {/* Compact Sticky Header */}
        <header className="sticky top-0 z-20 pt-safe bg-[#F7F8FA]/90 dark:bg-[#101216]/90 backdrop-blur-md border-b border-[#E7EAF0] dark:border-[#30343D] no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 sm:h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="lg:hidden shrink-0">
                <BrandLogo size={28} />
              </div>
              <div className="min-w-0 flex items-center">
                <BrandName size="md" />
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenSearch}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full text-[#747B8A] hover:bg-white dark:hover:bg-[#1A1D24] transition"
                aria-label="Global search"
              >
                <Search className="w-4 h-4" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    setNotifOpen((o) => !o);
                  }}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full text-[#747B8A] hover:bg-white dark:hover:bg-[#1A1D24] transition relative"
                  aria-label="EMI reminders"
                >
                  <Bell className="w-4 h-4" />
                  {emiAlerts.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#DC2626]" />
                  )}
                </button>

                {notifOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setNotifOpen(false)}
                      aria-hidden="true"
                    />
                    <div className="fixed inset-x-4 top-[calc(env(safe-area-inset-top,0px)+3.5rem)] sm:inset-x-auto sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-80 rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] shadow-xl p-4 z-40">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold">EMI Reminders</p>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            onNavigate('emi');
                          }}
                          className="text-[11px] font-semibold text-[#1677FF]"
                        >
                          Open Tracker
                        </button>
                      </div>
                      {emiAlerts.length === 0 ? (
                        <p className="text-xs text-[#747B8A] py-3">
                          No EMIs due today or overdue.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {emiAlerts.map((a, idx) => (
                            <div key={`${a.id || 'alert'}-${idx}`} className="text-xs py-1.5 border-b border-[#E7EAF0] dark:border-[#30343D] last:border-0">
                              <p className="font-semibold">{a.personName} · #{a.installmentNumber}</p>
                              <p className="text-[#747B8A]">
                                {a.status} · {formatCurrency(a.remainingAmount, a.currency)} ({a.dueDate})
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="hidden sm:flex min-h-[38px] min-w-[38px] items-center justify-center rounded-full text-[#747B8A] hover:bg-white dark:hover:bg-[#1A1D24] transition"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    setHeaderMenuOpen((o) => !o);
                  }}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full text-[#171A22] dark:text-[#F8FAFC] hover:bg-white dark:hover:bg-[#1A1D24] transition relative"
                  aria-label="Quick actions and sync status"
                >
                  <MoreVertical className="w-4 h-4" />
                  {(syncState === 'failed' || syncState === 'pending' || syncState === 'offline') && (
                    <span
                      className={`absolute top-2 right-2 h-2 w-2 rounded-full ${
                        syncState === 'failed' ? 'bg-[#DC2626]' : 'bg-[#F59E0B]'
                      }`}
                    />
                  )}
                </button>

                {headerMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setHeaderMenuOpen(false)}
                      aria-hidden="true"
                    />
                    <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] shadow-xl py-1.5 z-40">
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          onOpenAdd();
                        }}
                        className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left text-xs font-semibold text-[#171A22] dark:text-[#F8FAFC] hover:bg-[#F7F8FA] dark:hover:bg-[#101216] transition"
                      >
                        <Plus className="w-4 h-4 text-[#1677FF] shrink-0" />
                        <span>Add New Transaction</span>
                      </button>

                      <div className="my-1 border-t border-[#E7EAF0] dark:border-[#30343D]" />

                      {(() => {
                        const meta = syncMeta();
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setHeaderMenuOpen(false);
                              meta.onClick();
                            }}
                            className="w-full px-3.5 py-2.5 flex items-start gap-2.5 text-left hover:bg-[#F7F8FA] dark:hover:bg-[#101216] transition"
                          >
                            <span className="mt-0.5">{meta.icon}</span>
                            <div className="min-w-0">
                              <p className={`text-xs font-semibold ${meta.color}`}>
                                Sync Status: {meta.label}
                              </p>
                              <p className="text-[11px] text-[#747B8A] dark:text-[#9CA3AF] truncate">
                                {meta.sub}
                              </p>
                            </div>
                          </button>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Scrollable Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 pb-28 lg:pb-10 print:max-w-none print:p-0">
          {children}
        </main>
      </div>

      {/* Floating Pill Mobile Bottom Navigation Bar (5 Tabs) */}
      <nav className="lg:hidden fixed bottom-3 inset-x-4 z-30 mb-safe no-print">
        <div className="rounded-full bg-white/95 dark:bg-[#1A1D24]/95 backdrop-blur-md border border-[#E7EAF0] dark:border-[#30343D] shadow-lg px-2 py-1.5">
          <div className="grid grid-cols-5 items-center gap-1">
            {(
              [
                { id: 'home', label: 'Home', icon: House },
                { id: 'people', label: 'People', icon: Users },
                { id: 'emi', label: 'EMI', icon: CalendarDays },
                { id: 'transactions', label: 'Ledger', icon: ArrowLeftRight },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full transition ${
                    active
                      ? 'bg-[#1677FF]/10 text-[#1677FF]'
                      : 'text-[#747B8A] dark:text-[#9CA3AF] hover:text-[#171A22] dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full transition ${
                isMoreActive
                  ? 'bg-[#1677FF]/10 text-[#1677FF]'
                  : 'text-[#747B8A] dark:text-[#9CA3AF] hover:text-[#171A22] dark:hover:text-white'
              }`}
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile "More" Drawer */}
      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More"
        subtitle="Investments, Debts, Reports & Settings"
      >
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { id: 'investments', label: 'Investments', icon: ChartNoAxesCombined },
              { id: 'debts', label: 'Debts', icon: Landmark },
              { id: 'reports', label: 'Reports', icon: FileBarChart2 },
              { id: 'settings', label: 'Settings', icon: Settings },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  setMoreOpen(false);
                }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-[#F7F8FA] dark:bg-[#101216] border border-[#E7EAF0] dark:border-[#30343D] text-left"
              >
                <Icon className="w-5 h-5 text-[#1677FF]" />
                <span className="text-sm font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
};
