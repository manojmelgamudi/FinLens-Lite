import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { useTheme } from './hooks/useTheme';
import { EMIInstallment, EMIPlan, Person, Transaction } from './types/finance';
import { PinScreen } from './components/auth/PinScreen';
import { BrandName } from './components/common/BrandLogo';
import { AppShell, NavSection } from './components/layout/AppShell';
import { GlobalSearchModal, SearchNavTarget } from './components/common/GlobalSearchModal';
import { PersonFormModal } from './components/modals/PersonFormModal';
import { TransactionModal } from './components/modals/TransactionModal';
import { EMIPlanModal } from './components/modals/EMIPlanModal';
import { EMIPaymentModal } from './components/modals/EMIPaymentModal';
import { EMIScheduleModal } from './components/modals/EMIScheduleModal';
import { DashboardPage } from './pages/DashboardPage';
import { PeoplePage } from './pages/PeoplePage';
import { PersonProfilePage } from './pages/PersonProfilePage';
import { TransactionsPage } from './pages/TransactionsPage';
import { EMITrackerPage } from './pages/EMITrackerPage';
import { InvestmentsPage } from './pages/InvestmentsPage';
import { DebtsPage } from './pages/DebtsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

const MainAppContent: React.FC = () => {
  useTheme();
  const {
    authLoading,
    isAuthenticated,
    hasDataLoaded,
    backendError,
    syncNow,
    toasts,
    dismissToast,
  } = useFinance();

  const [section, setSection] = useState<NavSection>('home');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Modals state
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txDefaultPersonId, setTxDefaultPersonId] = useState<string | undefined>(undefined);

  const [emiPlanModalOpen, setEmiPlanModalOpen] = useState(false);
  const [emiDefaultPersonId, setEmiDefaultPersonId] = useState<string | undefined>(undefined);

  const [paymentInstallment, setPaymentInstallment] = useState<EMIInstallment | null>(null);
  const [schedulePlan, setSchedulePlan] = useState<EMIPlan | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-[#F7F8FA] dark:bg-[#101216] text-xs text-[#747B8A]">
        <BrandName size="lg" />
        <span>Initializing...</span>
      </div>
    );
  }

  // Strictly block access to financial dashboard until PIN authentication succeeds
  if (!isAuthenticated) {
    return <PinScreen />;
  }

  const handleNavigate = (next: NavSection) => {
    setSection(next);
    if (next !== 'people') {
      setSelectedPersonId(null);
    }
  };

  const handleSearchNavigate = (target: SearchNavTarget) => {
    if (target.page === 'person') {
      setSection('people');
      setSelectedPersonId(target.personId);
    } else if (target.page === 'transactions') {
      setSection('transactions');
      setSelectedPersonId(null);
    } else if (target.page === 'emi') {
      setSection('emi');
      setSelectedPersonId(null);
    } else if (target.page === 'investments') {
      setSection('investments');
    } else if (target.page === 'debts') {
      setSection('debts');
    }
  };

  const openAddTransaction = (personId?: string) => {
    setEditingTx(null);
    setTxDefaultPersonId(personId);
    setTxModalOpen(true);
  };

  const openEditTransaction = (tx: Transaction) => {
    setEditingTx(tx);
    setTxDefaultPersonId(tx.personId);
    setTxModalOpen(true);
  };

  const openAddPerson = () => {
    setEditingPerson(null);
    setPersonModalOpen(true);
  };

  const openEditPerson = (person: Person) => {
    setEditingPerson(person);
    setPersonModalOpen(true);
  };

  const openNewEMIPlan = (personId?: string) => {
    setEmiDefaultPersonId(personId);
    setEmiPlanModalOpen(true);
  };

  const hasFatalBackendError = Boolean(backendError && !hasDataLoaded && section !== 'settings');

  return (
    <>
      <AppShell
        activeSection={section}
        onNavigate={handleNavigate}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenAdd={() => openAddTransaction(selectedPersonId || undefined)}
      >
        {hasFatalBackendError ? (
          <div className="py-8 max-w-xl mx-auto">
            <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#F59E0B]/40 p-6 space-y-3 shadow-sm">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-[#F59E0B]">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>Administrator Backend Configuration Error</span>
              </div>
              <p className="text-sm text-[#747B8A] dark:text-[#9CA3AF] leading-relaxed">
                {backendError}
              </p>
              <button
                type="button"
                onClick={() => syncNow()}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-xs font-semibold text-white"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Connection
              </button>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedPersonId ? `person-${selectedPersonId}` : section}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {section === 'home' && (
                <DashboardPage
                  onOpenAddTransaction={() => openAddTransaction()}
                  onOpenPerson={(pid) => {
                    setSection('people');
                    setSelectedPersonId(pid);
                  }}
                  onPayInstallment={(inst) => setPaymentInstallment(inst)}
                  onNavigateTab={(tab) => handleNavigate(tab)}
                />
              )}

              {section === 'people' && !selectedPersonId && (
                <PeoplePage
                  onSelectPerson={(pid) => setSelectedPersonId(pid)}
                  onAddPerson={openAddPerson}
                  onEditPerson={openEditPerson}
                />
              )}

              {section === 'people' && selectedPersonId && (
                <PersonProfilePage
                  personId={selectedPersonId}
                  onBack={() => setSelectedPersonId(null)}
                  onEditPerson={openEditPerson}
                  onAddTransaction={(pid) => openAddTransaction(pid)}
                  onEditTransaction={openEditTransaction}
                  onAddEMIPlan={(pid) => openNewEMIPlan(pid)}
                  onViewEMISchedule={(plan) => setSchedulePlan(plan)}
                />
              )}

              {section === 'transactions' && (
                <TransactionsPage
                  onAddTransaction={() => openAddTransaction()}
                  onEditTransaction={openEditTransaction}
                  onSelectPerson={(pid) => {
                    setSection('people');
                    setSelectedPersonId(pid);
                  }}
                />
              )}

              {section === 'emi' && (
                <EMITrackerPage
                  onCreatePlan={() => openNewEMIPlan()}
                  onPayInstallment={(inst) => setPaymentInstallment(inst)}
                  onViewSchedule={(plan) => setSchedulePlan(plan)}
                />
              )}

              {section === 'investments' && <InvestmentsPage />}
              {section === 'debts' && <DebtsPage />}
              {section === 'reports' && <ReportsPage />}
              {section === 'settings' && <SettingsPage onAddPerson={openAddPerson} />}
            </motion.div>
          </AnimatePresence>
        )}
      </AppShell>

      {/* Modals & Drawers */}
      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleSearchNavigate}
      />

      <PersonFormModal
        open={personModalOpen}
        onClose={() => setPersonModalOpen(false)}
        editingPerson={editingPerson}
      />

      <TransactionModal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        editingTransaction={editingTx}
        defaultPersonId={txDefaultPersonId}
        onOpenNewEMIPlan={(pid) => openNewEMIPlan(pid)}
        onSelectInstallmentForPayment={(inst) => setPaymentInstallment(inst)}
      />

      <EMIPlanModal
        open={emiPlanModalOpen}
        onClose={() => setEmiPlanModalOpen(false)}
        defaultPersonId={emiDefaultPersonId}
      />

      <EMIPaymentModal
        open={Boolean(paymentInstallment)}
        onClose={() => setPaymentInstallment(null)}
        installment={paymentInstallment}
      />

      <EMIScheduleModal
        open={Boolean(schedulePlan)}
        onClose={() => setSchedulePlan(null)}
        plan={schedulePlan}
        onPayInstallment={(inst) => {
          setSchedulePlan(null);
          setPaymentInstallment(inst);
        }}
      />

      {/* Toast Notifications */}
      <div className="fixed bottom-20 lg:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs font-medium shadow-lg border ${
              t.type === 'error'
                ? 'bg-[#DC2626] text-white border-[#DC2626]'
                : t.type === 'success'
                ? 'bg-[#171A22] dark:bg-white text-white dark:text-[#171A22] border-transparent'
                : 'bg-white dark:bg-[#1A1D24] text-[#171A22] dark:text-[#F8FAFC] border-[#E7EAF0] dark:border-[#30343D]'
            }`}
          >
            <span>{t.text}</span>
            <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
              <X className="w-3.5 h-3.5 opacity-75" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default function App() {
  return (
    <FinanceProvider>
      <MainAppContent />
    </FinanceProvider>
  );
}
