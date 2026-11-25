import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  Download,
  Edit3,
  Plus,
  Printer,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { CurrencyCode, EMIPlan, Person, Transaction } from '../types/finance';
import {
  computeInstallmentStatus,
  computePersonSummary,
  formatCurrency,
  formatDateDisplay,
  getEMIPlanDisplayName,
  getTodayISO,
  getTransactionDisplayTitle,
} from '../utils/calculations';
import { exportPersonStatementPDF } from '../utils/exportUtils';
import { BottomSheet } from '../components/common/BottomSheet';

interface PersonProfilePageProps {
  personId: string;
  onBack: () => void;
  onEditPerson: (person: Person) => void;
  onAddTransaction: (personId: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onAddEMIPlan: (personId: string) => void;
  onViewEMISchedule: (plan: EMIPlan) => void;
}

export const PersonProfilePage: React.FC<PersonProfilePageProps> = ({
  personId,
  onBack,
  onEditPerson,
  onAddTransaction,
  onEditTransaction,
  onAddEMIPlan,
  onViewEMISchedule,
}) => {
  const { dataset, displayCurrency, performSyncAction } = useFinance();
  const person = dataset.people.find((p) => p.id === personId);

  const [profileCurrency, setProfileCurrency] = useState<CurrencyCode>(
    person?.defaultCurrency || displayCurrency || 'INR'
  );
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'emi'>('overview');
  const [txFilter, setTxFilter] = useState<string>('all');
  const [statementOpen, setStatementOpen] = useState(false);

  const summary = useMemo(() => {
    if (!person) return null;
    return computePersonSummary(
      person,
      dataset.transactions,
      dataset.emiPlans,
      dataset.emiSchedule,
      dataset.settings,
      profileCurrency
    );
  }, [person, dataset, profileCurrency]);

  const personTransactions = useMemo(
    () =>
      dataset.transactions
        .filter((t) => t.personId === personId && t.status !== 'Archived')
        .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || '')),
    [dataset.transactions, personId]
  );

  const statementTransactions = useMemo(
    () =>
      [...personTransactions].sort((a, b) =>
        (a.date || a.createdAt || '').localeCompare(b.date || b.createdAt || '')
      ),
    [personTransactions]
  );

  const filteredTransactions = useMemo(() => {
    return personTransactions.filter((t) => {
      if (txFilter === 'all') return true;
      if (txFilter === 'one_time') return t.transactionMode === 'One-time';
      if (txFilter === 'emi') return t.transactionMode === 'EMI';
      return t.transactionType === txFilter;
    });
  }, [personTransactions, txFilter]);

  const personPlans = useMemo(
    () => dataset.emiPlans.filter((p) => p.personId === personId),
    [dataset.emiPlans, personId]
  );

  if (!person || !summary) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#1677FF]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to People
          </button>
        </div>
        <p className="text-sm text-[#747B8A]">Person record not found.</p>
      </div>
    );
  }

  const numFmt = dataset.settings.numberFormat;

  const handleArchiveToggle = async () => {
    const action = person.status === 'Archived' ? 'restorePerson' : 'archivePerson';
    await performSyncAction(
      action,
      { id: person.id },
      person.status === 'Archived' ? `Restored ${person.name}` : `Archived ${person.name}`
    );
  };

  const txVisual = (tx: Transaction) => {
    switch (tx.transactionType) {
      case 'Lending':
        return {
          icon: <ArrowUpRight className="w-4 h-4 text-[#1677FF]" />,
          bg: 'bg-[#1677FF]/10',
          sign: '+',
          color: 'text-[#171A22] dark:text-[#F8FAFC]',
        };
      case 'Repayment':
        return {
          icon: <ArrowDownLeft className="w-4 h-4 text-[#16A34A]" />,
          bg: 'bg-[#16A34A]/10',
          sign: '−',
          color: 'text-[#16A34A]',
        };
      case 'Interest Earned':
        return {
          icon: <TrendingUp className="w-4 h-4 text-[#38BDF8]" />,
          bg: 'bg-[#38BDF8]/15',
          sign: '+',
          color: 'text-[#1677FF]',
        };
      default:
        return {
          icon: <Sparkles className="w-4 h-4 text-[#F59E0B]" />,
          bg: 'bg-[#F59E0B]/12',
          sign: '',
          color: 'text-[#F59E0B]',
        };
    }
  };

  const subtitleText = person.relationship
    ? `${person.relationship} · Status: ${person.status}`
    : `Status: ${person.status}`;

  return (
    <>
      <div className="space-y-6 print:hidden">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-12 w-12 rounded-2xl bg-brand-gradient text-white font-semibold text-lg flex items-center justify-center shrink-0">
            {person.name.slice(0, 1).toUpperCase()}
          </div>

          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-[#171A22] dark:text-[#F8FAFC] truncate">
              {person.name}
            </h2>
            <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF] truncate">
              {subtitleText}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={onBack}
            className="h-10 inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] px-2 sm:px-3 text-xs font-semibold text-[#171A22] dark:text-[#F8FAFC] hover:bg-[#F7F8FA] dark:hover:bg-[#232732] transition"
            aria-label="Back to People"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span>Back</span>
          </button>

          <div className="relative">
            <select
              aria-label="Profile currency"
              value={profileCurrency}
              onChange={(e) => setProfileCurrency(e.target.value)}
              className="no-auto-chevron w-full h-10 appearance-none rounded-full bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] pl-3 pr-7 text-center text-xs font-semibold text-[#171A22] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30 cursor-pointer"
            >
              {dataset.lists.currencies.map((c, idx) => (
                <option key={`${c}-${idx}`} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#747B8A] pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
          </div>

          <button
            type="button"
            onClick={() => onEditPerson(person)}
            className="h-10 inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] px-2 sm:px-3 text-xs font-semibold text-[#171A22] dark:text-[#F8FAFC] hover:bg-[#F7F8FA] dark:hover:bg-[#232732] transition"
          >
            <Edit3 className="w-3.5 h-3.5 shrink-0" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={handleArchiveToggle}
            className="h-10 inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] px-2 sm:px-3 text-xs font-semibold text-[#747B8A] hover:text-[#171A22] dark:hover:text-white hover:bg-[#F7F8FA] dark:hover:bg-[#232732] transition"
          >
            {person.status === 'Archived' ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>Restore</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5 shrink-0" />
                <span>Archive</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onAddTransaction(person.id)}
            className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-semibold text-white shadow-xs hover:opacity-95 active:scale-[0.99] transition"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Add Transaction</span>
          </button>

          <button
            type="button"
            onClick={() => setStatementOpen(true)}
            className="h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] px-4 text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] hover:bg-[#F7F8FA] dark:hover:bg-[#232732] active:scale-[0.99] transition shrink-0"
            aria-label={`Print statement for ${person.name}`}
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Reconciliation Notice (e.g. Revanth T015/T016 note) */}
      {summary.hasReconciliationNote && (
        <div className="rounded-2xl border border-[#F59E0B]/40 bg-[#F59E0B]/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
          <div className="text-xs text-[#171A22] dark:text-[#F8FAFC]">
            <p className="font-semibold">Reconciliation Note Present</p>
            <p className="mt-0.5 text-[#747B8A] dark:text-[#9CA3AF]">
              One or more transactions carry an original workbook reconciliation note (e.g., verify EMI tracker vs ledger repayments to avoid double-counting).
            </p>
          </div>
        </div>
      )}

      {/* Principal vs Interest Financial Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="col-span-2 lg:col-span-1 rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-4">
          <p className="text-xs text-[#747B8A]">Principal Outstanding</p>
          <p className="mt-1 text-xl font-semibold text-[#1677FF] tabular-nums">
            {formatCurrency(summary.principalOutstandingDisplay, profileCurrency, numFmt)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-4">
          <p className="text-xs text-[#747B8A]">Total Lent</p>
          <p className="mt-1 text-lg font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
            {formatCurrency(summary.totalLentDisplay, profileCurrency, numFmt)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-4">
          <p className="text-xs text-[#747B8A]">Repayments Received</p>
          <p className="mt-1 text-lg font-semibold text-[#16A34A] tabular-nums">
            {formatCurrency(summary.totalRepaidDisplay, profileCurrency, numFmt)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-4">
          <p className="text-xs text-[#747B8A]">Interest Earned</p>
          <p className="mt-1 text-lg font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
            {formatCurrency(summary.interestEarnedDisplay, profileCurrency, numFmt)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-4">
          <p className="text-xs text-[#747B8A]">Interest Outstanding</p>
          <p className="mt-1 text-lg font-semibold text-[#F59E0B] tabular-nums">
            {formatCurrency(summary.interestOutstandingDisplay, profileCurrency, numFmt)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex max-w-full items-center gap-1 p-1 rounded-full bg-[#EEF1F6]/90 dark:bg-[#161920] border border-[#E7EAF0] dark:border-[#30343D] overflow-x-auto">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'transactions', label: `Transactions (${personTransactions.length})` },
            { id: 'emi', label: `EMI Plans (${personPlans.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-full text-xs transition whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-[#232732] text-[#171A22] dark:text-[#F8FAFC] font-semibold shadow-xs'
                : 'text-[#747B8A] dark:text-[#9CA3AF] font-medium hover:text-[#171A22] dark:hover:text-[#F8FAFC]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-6 space-y-3">
            <h3 className="text-base font-semibold text-[#171A22] dark:text-[#F8FAFC]">
              Account Summary
            </h3>
            <div className="text-sm space-y-2.5 text-[#171A22] dark:text-[#F8FAFC]">
              <div className="flex justify-between">
                <span className="text-[#747B8A]">Default Currency</span>
                <span className="font-medium">{person.defaultCurrency}</span>
              </div>
              {person.phone && (
                <div className="flex justify-between">
                  <span className="text-[#747B8A]">Phone</span>
                  <span className="font-medium">{person.phone}</span>
                </div>
              )}
              {person.email && (
                <div className="flex justify-between">
                  <span className="text-[#747B8A]">Email</span>
                  <span className="font-medium">{person.email}</span>
                </div>
              )}
              {person.notes && (
                <div className="pt-2.5 border-t border-[#E7EAF0] dark:border-[#30343D]">
                  <p className="text-xs text-[#747B8A] mb-1">Notes</p>
                  <p className="text-xs leading-relaxed">{person.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#171A22] dark:text-[#F8FAFC]">
                Active EMI Plans
              </h3>
              <button
                type="button"
                onClick={() => onAddEMIPlan(person.id)}
                className="text-xs font-semibold text-[#1677FF] hover:underline"
              >
                + Add EMI Plan
              </button>
            </div>
            {personPlans.length === 0 ? (
              <p className="text-xs text-[#747B8A] py-4">
                No EMI plans created for {person.name} yet.
              </p>
            ) : (
              <div className="divide-y divide-[#E7EAF0]/80 dark:divide-[#30343D]/80">
                {personPlans.map((plan, idx) => (
                  <button
                    key={`${plan.id || 'plan'}-${idx}`}
                    type="button"
                    onClick={() => onViewEMISchedule(plan)}
                    className="w-full py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-6 text-left hover:bg-[#F7F8FA]/60 dark:hover:bg-[#101216]/40 px-3 -mx-3 rounded-2xl transition"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-10 w-10 rounded-2xl bg-[#1677FF]/10 flex items-center justify-center shrink-0">
                        <CalendarDays className="w-4 h-4 text-[#1677FF]" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] truncate">
                          {getEMIPlanDisplayName(plan, dataset.transactions, dataset.emiSchedule)}
                        </p>
                        <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF] truncate">
                          {plan.frequency} · {plan.numberOfInstallments} installments
                        </p>
                        <p
                          className={`text-[11px] font-medium ${
                            plan.status === 'Active'
                              ? 'text-[#1677FF]'
                              : plan.status === 'Completed'
                              ? 'text-[#16A34A]'
                              : 'text-[#747B8A] dark:text-[#9CA3AF]'
                          }`}
                        >
                          {plan.status}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <p className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
                        {formatCurrency(plan.installmentAmount, plan.currency, numFmt)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-6 space-y-4">
          <div className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#EEF1F6]/90 dark:bg-[#161920] p-1 border border-[#E7EAF0] dark:border-[#30343D] overflow-x-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'Lending', label: 'Lending' },
              { id: 'Repayment', label: 'Repayment' },
              { id: 'Interest Earned', label: 'Interest' },
              { id: 'Interest Adjustment', label: 'Adjustment' },
              { id: 'one_time', label: 'One-time' },
              { id: 'emi', label: 'EMI-related' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTxFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs transition whitespace-nowrap shrink-0 ${
                  txFilter === f.id
                    ? 'bg-white dark:bg-[#232732] text-[#171A22] dark:text-[#F8FAFC] font-semibold shadow-xs'
                    : 'text-[#747B8A] dark:text-[#9CA3AF] font-medium hover:text-[#171A22] dark:hover:text-[#F8FAFC]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredTransactions.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#747B8A]">
              No transactions match this filter.
            </p>
          ) : (
            <div className="divide-y divide-[#E7EAF0]/80 dark:divide-[#30343D]/80">
              {filteredTransactions.map((tx, idx) => {
                const vis = txVisual(tx);
                return (
                  <div
                    key={`${tx.id || 'tx'}-${idx}`}
                    className="py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-6"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`h-10 w-10 rounded-2xl ${vis.bg} flex items-center justify-center shrink-0`}
                      >
                        {vis.icon}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] truncate">
                          {getTransactionDisplayTitle(
                            tx,
                            dataset.emiPlans,
                            dataset.emiSchedule,
                            dataset.transactions
                          )}
                          {tx.status === 'Reversed' && (
                            <span className="ml-2 text-xs font-medium text-[#DC2626]">(Reversed)</span>
                          )}
                        </p>
                        <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF] truncate">
                          {tx.transactionType} · {tx.transactionMode}
                        </p>
                        <p className="text-[11px] font-medium text-[#747B8A]/90 dark:text-[#9CA3AF]/80">
                          {tx.date ? formatDateDisplay(tx.date, dataset.settings.dateFormat) : 'Opening Balance'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 pl-2">
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          tx.status === 'Reversed' ? 'line-through text-[#747B8A]' : vis.color
                        }`}
                      >
                        {vis.sign}
                        {formatCurrency(tx.amount, tx.currency, numFmt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tx)}
                        className="p-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-[#747B8A] hover:text-[#171A22] dark:hover:text-white transition"
                        aria-label="Edit transaction"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'emi' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => onAddEMIPlan(person.id)}
            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-semibold text-white shadow-xs hover:opacity-95 active:scale-[0.99] transition"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Add EMI Plan</span>
          </button>

          {personPlans.length === 0 ? (
            <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-8 text-center text-xs text-[#747B8A]">
              No EMI plans found for {person.name}.
            </div>
          ) : (
            <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-6">
              <div className="divide-y divide-[#E7EAF0]/80 dark:divide-[#30343D]/80">
                {personPlans.map((plan, idx) => {
                  const insts = dataset.emiSchedule
                    .filter((i) => i.emiPlanId === plan.id)
                    .map((i) => ({ ...i, status: computeInstallmentStatus(i) }));
                  const paidCount = insts.filter((i) => i.status === 'Paid').length;
                  const overdueCount = insts.filter((i) => i.status === 'Overdue').length;
                  const remainingAmt = insts.reduce((acc, i) => acc + i.remainingAmount, 0);
                  const nextDue = insts
                    .filter((i) => i.remainingAmount > 0.01)
                    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

                  return (
                    <div
                      key={`${plan.id || 'plan'}-${idx}`}
                      className="py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-6"
                    >
                      <button
                        type="button"
                        onClick={() => onViewEMISchedule(plan)}
                        className="flex items-center gap-4 min-w-0 text-left flex-1"
                      >
                        <div
                          className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                            overdueCount > 0 ? 'bg-[#DC2626]/10' : 'bg-[#1677FF]/10'
                          }`}
                        >
                          <CalendarDays
                            className={`w-4 h-4 ${
                              overdueCount > 0 ? 'text-[#DC2626]' : 'text-[#1677FF]'
                            }`}
                          />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] truncate">
                            {getEMIPlanDisplayName(plan, dataset.transactions, dataset.emiSchedule)}
                          </p>
                          <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF] truncate">
                            {plan.planType} · {plan.frequency} · {paidCount}/{insts.length} paid
                          </p>
                          <p
                            className={`text-[11px] font-medium ${
                              overdueCount > 0
                                ? 'text-[#DC2626]'
                                : !nextDue
                                ? 'text-[#16A34A]'
                                : 'text-[#747B8A]/90 dark:text-[#9CA3AF]/80'
                            }`}
                          >
                            {nextDue
                              ? `Next due ${formatDateDisplay(nextDue.dueDate, dataset.settings.dateFormat)}`
                              : 'Completed'}
                            {overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-3 shrink-0 pl-2">
                        <span className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
                          {formatCurrency(
                            remainingAmt > 0 ? remainingAmt : plan.totalPrincipal,
                            plan.currency,
                            numFmt
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => onViewEMISchedule(plan)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#1677FF]/10 text-[#1677FF] text-xs font-semibold hover:bg-[#1677FF]/15 transition"
                        >
                          Schedule
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Minimal Printable Statement */}
      <div className="hidden print:block text-[#171A22] bg-white">
        <div className="flex items-start justify-between gap-4 pb-4 mb-5 border-b border-[#E7EAF0]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1677FF]">
              FinLens · Account Statement
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171A22]">
              {person.name}
            </h1>
            <p className="mt-0.5 text-xs text-[#747B8A]">
              Status: {person.status} · Currency: {profileCurrency}
            </p>
          </div>
          <div className="text-right text-xs text-[#747B8A] tabular-nums">
            <p className="font-semibold text-[#171A22]">
              Generated {formatDateDisplay(getTodayISO(), dataset.settings.dateFormat)}
            </p>
            <p className="mt-0.5">{statementTransactions.length} transactions</p>
          </div>
        </div>

        <div className="grid grid-cols-4 border border-[#E7EAF0] rounded-xl divide-x divide-[#E7EAF0] mb-6 text-xs">
          <div className="p-3">
            <p className="text-[#747B8A]">Principal Outstanding</p>
            <p className="mt-1 text-sm font-semibold text-[#1677FF] tabular-nums">
              {formatCurrency(summary.principalOutstandingDisplay, profileCurrency, numFmt)}
            </p>
          </div>
          <div className="p-3">
            <p className="text-[#747B8A]">Total Lent</p>
            <p className="mt-1 text-sm font-semibold text-[#171A22] tabular-nums">
              {formatCurrency(summary.totalLentDisplay, profileCurrency, numFmt)}
            </p>
          </div>
          <div className="p-3">
            <p className="text-[#747B8A]">Repayments Received</p>
            <p className="mt-1 text-sm font-semibold text-[#16A34A] tabular-nums">
              {formatCurrency(summary.totalRepaidDisplay, profileCurrency, numFmt)}
            </p>
          </div>
          <div className="p-3">
            <p className="text-[#747B8A]">Interest Earned</p>
            <p className="mt-1 text-sm font-semibold text-[#171A22] tabular-nums">
              {formatCurrency(summary.interestEarnedDisplay, profileCurrency, numFmt)}
            </p>
          </div>
        </div>

        {statementTransactions.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#747B8A] border border-[#E7EAF0] rounded-xl">
            No transactions recorded for {person.name}.
          </p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-[#E7EAF0] text-[#747B8A]">
                <th className="py-2 pr-3 text-left font-semibold whitespace-nowrap">Date</th>
                <th className="py-2 pr-3 text-left font-semibold">Description</th>
                <th className="py-2 pr-3 text-left font-semibold whitespace-nowrap">Type</th>
                <th className="py-2 pr-3 text-left font-semibold whitespace-nowrap">Mode</th>
                <th className="py-2 pr-3 text-left font-semibold whitespace-nowrap">Status</th>
                <th className="py-2 text-right font-semibold whitespace-nowrap">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7EAF0]">
              {statementTransactions.map((tx, idx) => {
                const vis = txVisual(tx);
                const txTitle = getTransactionDisplayTitle(
                  tx,
                  dataset.emiPlans,
                  dataset.emiSchedule,
                  dataset.transactions
                );
                return (
                  <tr key={`stmt-${tx.id || 'tx'}-${idx}`}>
                    <td className="py-2.5 pr-3 text-[#747B8A] whitespace-nowrap tabular-nums align-top">
                      {tx.date ? formatDateDisplay(tx.date, dataset.settings.dateFormat) : 'Opening'}
                    </td>
                    <td className="py-2.5 pr-3 align-top">
                      <p className="font-medium text-[#171A22]">{txTitle}</p>
                      {tx.notes && (
                        <p className="mt-0.5 text-[11px] text-[#747B8A]">{tx.notes}</p>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-[#171A22] whitespace-nowrap align-top">
                      {tx.transactionType}
                    </td>
                    <td className="py-2.5 pr-3 text-[#747B8A] whitespace-nowrap align-top">
                      {tx.transactionMode}
                      {tx.paymentMethod ? ` · ${tx.paymentMethod}` : ''}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap align-top">
                      <span className={tx.status === 'Reversed' ? 'text-[#DC2626]' : 'text-[#747B8A]'}>
                        {tx.status}
                      </span>
                    </td>
                    <td
                      className={`py-2.5 text-right font-semibold whitespace-nowrap tabular-nums align-top ${
                        tx.status === 'Reversed'
                          ? 'line-through text-[#747B8A]'
                          : tx.transactionType === 'Repayment'
                          ? 'text-[#16A34A]'
                          : 'text-[#171A22]'
                      }`}
                    >
                      {vis.sign}
                      {formatCurrency(tx.amount, tx.currency, numFmt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="mt-6 pt-3 border-t border-[#E7EAF0] flex items-center justify-between text-[11px] text-[#747B8A]">
          <span>FinLens Account Statement · {person.name}</span>
          <span>Original transaction currencies preserved</span>
        </div>
      </div>

      {/* In-App Statement Preview & PDF Export Modal (works inside iframes & mobile) */}
      <BottomSheet
        open={statementOpen}
        onClose={() => setStatementOpen(false)}
        title={`Account Statement · ${person.name}`}
        subtitle={`${statementTransactions.length} transactions · Summary in ${profileCurrency}`}
        maxWidthClass="sm:max-w-3xl"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setStatementOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-sm font-medium text-[#747B8A]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                setStatementOpen(false);
                window.setTimeout(() => window.print(), 120);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] hover:bg-[#F7F8FA] dark:hover:bg-[#232732]"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() =>
                exportPersonStatementPDF({
                  personName: person.name,
                  subtitle: `Status: ${person.status}`,
                  generatedDate: formatDateDisplay(getTodayISO(), dataset.settings.dateFormat),
                  summaryCurrency: profileCurrency,
                  summaryCards: [
                    {
                      label: 'Principal Outstanding',
                      value: formatCurrency(summary.principalOutstandingDisplay, profileCurrency, numFmt),
                    },
                    {
                      label: 'Total Lent',
                      value: formatCurrency(summary.totalLentDisplay, profileCurrency, numFmt),
                    },
                    {
                      label: 'Repayments Received',
                      value: formatCurrency(summary.totalRepaidDisplay, profileCurrency, numFmt),
                    },
                    {
                      label: 'Interest Earned',
                      value: formatCurrency(summary.interestEarnedDisplay, profileCurrency, numFmt),
                    },
                  ],
                  rows: statementTransactions.map((tx) => {
                    const vis = txVisual(tx);
                    const txTitle = getTransactionDisplayTitle(
                      tx,
                      dataset.emiPlans,
                      dataset.emiSchedule,
                      dataset.transactions
                    );
                    return {
                      date: tx.date
                        ? formatDateDisplay(tx.date, dataset.settings.dateFormat)
                        : 'Opening',
                      description: tx.notes ? `${txTitle} (${tx.notes})` : txTitle,
                      type: tx.transactionType,
                      mode: tx.paymentMethod
                        ? `${tx.transactionMode} · ${tx.paymentMethod}`
                        : tx.transactionMode,
                      status: tx.status,
                      amount: `${vis.sign}${formatCurrency(tx.amount, tx.currency, numFmt)}`,
                    };
                  }),
                })
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-gradient text-sm font-semibold text-white shadow-xs hover:opacity-95"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        }
      >
        <div className="rounded-2xl bg-white text-[#171A22] border border-[#E7EAF0] p-5 space-y-5">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E7EAF0]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1677FF]">
                FinLens · Account Statement
              </p>
              <h3 className="mt-1 text-xl font-bold tracking-tight text-[#171A22]">
                {person.name}
              </h3>
              <p className="mt-0.5 text-xs text-[#747B8A]">
                Status: {person.status} · Currency: {profileCurrency}
              </p>
            </div>
            <div className="text-right text-xs text-[#747B8A] tabular-nums shrink-0">
              <p className="font-semibold text-[#171A22]">
                {formatDateDisplay(getTodayISO(), dataset.settings.dateFormat)}
              </p>
              <p className="mt-0.5">{statementTransactions.length} transactions</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#E7EAF0] rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-[#E7EAF0] text-xs">
            <div className="p-3">
              <p className="text-[#747B8A]">Principal Outstanding</p>
              <p className="mt-1 text-sm font-semibold text-[#1677FF] tabular-nums">
                {formatCurrency(summary.principalOutstandingDisplay, profileCurrency, numFmt)}
              </p>
            </div>
            <div className="p-3">
              <p className="text-[#747B8A]">Total Lent</p>
              <p className="mt-1 text-sm font-semibold text-[#171A22] tabular-nums">
                {formatCurrency(summary.totalLentDisplay, profileCurrency, numFmt)}
              </p>
            </div>
            <div className="p-3">
              <p className="text-[#747B8A]">Repayments Received</p>
              <p className="mt-1 text-sm font-semibold text-[#16A34A] tabular-nums">
                {formatCurrency(summary.totalRepaidDisplay, profileCurrency, numFmt)}
              </p>
            </div>
            <div className="p-3">
              <p className="text-[#747B8A]">Interest Earned</p>
              <p className="mt-1 text-sm font-semibold text-[#171A22] tabular-nums">
                {formatCurrency(summary.interestEarnedDisplay, profileCurrency, numFmt)}
              </p>
            </div>
          </div>

          {statementTransactions.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#747B8A]">
              No transactions recorded for {person.name}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-[#E7EAF0] text-[#747B8A]">
                    <th className="py-2 pr-3 text-left font-semibold whitespace-nowrap">Date</th>
                    <th className="py-2 pr-3 text-left font-semibold">Description</th>
                    <th className="py-2 pr-3 text-left font-semibold whitespace-nowrap">Type</th>
                    <th className="py-2 pr-3 text-left font-semibold whitespace-nowrap">Mode</th>
                    <th className="py-2 pr-3 text-left font-semibold whitespace-nowrap">Status</th>
                    <th className="py-2 text-right font-semibold whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EAF0]">
                  {statementTransactions.map((tx, idx) => {
                    const vis = txVisual(tx);
                    const txTitle = getTransactionDisplayTitle(
                      tx,
                      dataset.emiPlans,
                      dataset.emiSchedule,
                      dataset.transactions
                    );
                    return (
                      <tr key={`modal-stmt-${tx.id || 'tx'}-${idx}`}>
                        <td className="py-2.5 pr-3 text-[#747B8A] whitespace-nowrap tabular-nums align-top">
                          {tx.date
                            ? formatDateDisplay(tx.date, dataset.settings.dateFormat)
                            : 'Opening'}
                        </td>
                        <td className="py-2.5 pr-3 align-top min-w-[140px]">
                          <p className="font-medium text-[#171A22]">{txTitle}</p>
                          {tx.notes && (
                            <p className="mt-0.5 text-[11px] text-[#747B8A]">{tx.notes}</p>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-[#171A22] whitespace-nowrap align-top">
                          {tx.transactionType}
                        </td>
                        <td className="py-2.5 pr-3 text-[#747B8A] whitespace-nowrap align-top">
                          {tx.transactionMode}
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap align-top">
                          <span className={tx.status === 'Reversed' ? 'text-[#DC2626]' : 'text-[#747B8A]'}>
                            {tx.status}
                          </span>
                        </td>
                        <td
                          className={`py-2.5 text-right font-semibold whitespace-nowrap tabular-nums align-top ${
                            tx.status === 'Reversed'
                              ? 'line-through text-[#747B8A]'
                              : tx.transactionType === 'Repayment'
                              ? 'text-[#16A34A]'
                              : 'text-[#171A22]'
                          }`}
                        >
                          {vis.sign}
                          {formatCurrency(tx.amount, tx.currency, numFmt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  );
};
