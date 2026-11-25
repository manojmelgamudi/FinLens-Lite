import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Edit3,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { Transaction } from '../types/finance';
import {
  formatCurrency,
  formatDateDisplay,
  getTransactionDisplayTitle,
} from '../utils/calculations';
import { BottomSheet } from '../components/common/BottomSheet';

interface TransactionsPageProps {
  onAddTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onSelectPerson: (personId: string) => void;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  onAddTransaction,
  onEditTransaction,
  onSelectPerson,
}) => {
  const { dataset, performSyncAction } = useFinance();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [personFilter, setPersonFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [confirmTx, setConfirmTx] = useState<{ tx: Transaction; action: 'reverseTransaction' | 'archiveTransaction' } | null>(null);
  const [openMenuTxId, setOpenMenuTxId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.transactions
      .filter((t) => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (typeFilter !== 'all' && t.transactionType !== typeFilter) return false;
        if (modeFilter !== 'all' && t.transactionMode !== modeFilter) return false;
        if (personFilter !== 'all' && t.personId !== personFilter) return false;
        if (
          q &&
          !`${t.id} ${t.personName} ${t.description} ${t.amount} ${t.notes} ${t.category} ${t.paymentMethod}`
            .toLowerCase()
            .includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
  }, [dataset.transactions, search, typeFilter, modeFilter, personFilter, statusFilter]);

  const handleConfirmRemoval = async () => {
    if (!confirmTx) return;
    setBusy(true);
    const ok = await performSyncAction(
      confirmTx.action,
      { id: confirmTx.tx.id },
      `${confirmTx.action === 'reverseTransaction' ? 'Reversed' : 'Archived'} transaction ${confirmTx.tx.id}`
    );
    setBusy(false);
    if (ok) setConfirmTx(null);
  };

  const numFmt = dataset.settings.numberFormat;

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

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[#171A22] dark:text-[#F8FAFC]">
            Transactions
          </h2>
          <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF]">
            {filtered.length} records
          </p>
        </div>

        <button
          type="button"
          onClick={onAddTransaction}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:opacity-95 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Transaction</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-[#747B8A] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search person, description, amount..."
            className="w-full rounded-full bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30"
          />
        </div>

        <div className="relative">
          <select
            aria-label="Filter by person"
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            className="no-auto-chevron w-full appearance-none rounded-full bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] pl-4 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30 cursor-pointer"
          >
            <option value="all">All People</option>
            {dataset.people.map((p, idx) => (
              <option key={`${p.id || 'p'}-${idx}`} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-[#747B8A] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
        </div>

        <div className="relative">
          <select
            aria-label="Filter by transaction type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="no-auto-chevron w-full appearance-none rounded-full bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] pl-4 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30 cursor-pointer"
          >
            <option value="all">All Types</option>
            {dataset.lists.transactionTypes.map((t, idx) => (
              <option key={`${t}-${idx}`} value={t}>
                {t}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-[#747B8A] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <select
              aria-label="Filter by transaction mode"
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="no-auto-chevron w-full appearance-none rounded-full bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] pl-3.5 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30 cursor-pointer"
            >
              <option value="all">All Modes</option>
              <option value="One-time">One-time</option>
              <option value="EMI">EMI</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#747B8A] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
          </div>

          <div className="relative">
            <select
              aria-label="Filter by transaction status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="no-auto-chevron w-full appearance-none rounded-full bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] pl-3.5 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30 cursor-pointer"
            >
              <option value="Active">Active</option>
              <option value="Reversed">Reversed</option>
              <option value="Archived">Archived</option>
              <option value="all">All Status</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#747B8A] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Ledger List */}
      <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-6 shadow-xs">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#747B8A]">
            No transactions match the current filters.
          </p>
        ) : (
          <div className="divide-y divide-[#E7EAF0]/80 dark:divide-[#30343D]/80">
            {filtered.map((tx, idx) => {
              const vis = txVisual(tx);
              const isEMI = Boolean(tx.emiInstallmentId);
              const rowKey = `${tx.id || 'tx'}-${idx}`;
              const menuOpen = openMenuTxId === rowKey;
              const txTitle = getTransactionDisplayTitle(
                tx,
                dataset.emiPlans,
                dataset.emiSchedule,
                dataset.transactions
              );
              return (
                <div
                  key={rowKey}
                  className="py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-6"
                >
                  <button
                    type="button"
                    onClick={() => onSelectPerson(tx.personId)}
                    className="flex items-center gap-4 min-w-0 flex-1 text-left"
                  >
                    <div
                      className={`h-10 w-10 rounded-2xl ${vis.bg} flex items-center justify-center shrink-0`}
                    >
                      {vis.icon}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] truncate">
                        {tx.personName || txTitle}
                      </p>
                      <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF] truncate">
                        {txTitle}
                      </p>
                      <p className="text-[11px] font-medium text-[#747B8A]/90 dark:text-[#9CA3AF]/80">
                        {tx.date ? formatDateDisplay(tx.date, dataset.settings.dateFormat) : 'Opening Balance'}
                        {tx.status !== 'Active' ? ` · ${tx.status}` : ''}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2.5 shrink-0 pl-2">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        tx.status !== 'Active' ? 'line-through text-[#747B8A]' : vis.color
                      }`}
                    >
                      {vis.sign}
                      {formatCurrency(tx.amount, tx.currency, numFmt)}
                    </span>

                    {tx.status === 'Active' && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuTxId(menuOpen ? null : rowKey)}
                          className="p-2 rounded-xl text-[#747B8A] hover:text-[#171A22] dark:hover:text-white hover:bg-[#F7F8FA] dark:hover:bg-[#101216] transition"
                          aria-label="Transaction actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {menuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={() => setOpenMenuTxId(null)}
                              aria-hidden="true"
                            />
                            <div className="absolute right-0 top-full mt-1.5 w-40 rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] shadow-xl py-1.5 z-30">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuTxId(null);
                                  onEditTransaction(tx);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#171A22] dark:text-[#F8FAFC] hover:bg-[#F7F8FA] dark:hover:bg-[#232732] flex items-center gap-2.5"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[#747B8A]" />
                                <span>Edit</span>
                              </button>
                              {!isEMI && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuTxId(null);
                                      setConfirmTx({ tx, action: 'reverseTransaction' });
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#F59E0B] hover:bg-[#F7F8FA] dark:hover:bg-[#232732] flex items-center gap-2.5"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Reverse</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuTxId(null);
                                      setConfirmTx({ tx, action: 'archiveTransaction' });
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-[#DC2626] hover:bg-[#F7F8FA] dark:hover:bg-[#232732] flex items-center gap-2.5"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                    <span>Archive</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Reversal / Archival */}
      <BottomSheet
        open={Boolean(confirmTx)}
        onClose={() => setConfirmTx(null)}
        title={
          confirmTx?.action === 'reverseTransaction'
            ? `Reverse Transaction ${confirmTx?.tx.id}?`
            : `Archive Transaction ${confirmTx?.tx.id}?`
        }
        subtitle="Audit history is preserved in Google Sheets Activity Log."
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmTx(null)}
              className="px-4 py-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-sm font-medium text-[#747B8A]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleConfirmRemoval}
              className="px-4 py-2 rounded-xl bg-[#DC2626] text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Updating...' : 'Confirm'}
            </button>
          </div>
        }
      >
        {confirmTx && (
          <p className="text-sm text-[#171A22] dark:text-[#F8FAFC]">
            This will mark{' '}
            <strong>
              {getTransactionDisplayTitle(
                confirmTx.tx,
                dataset.emiPlans,
                dataset.emiSchedule,
                dataset.transactions
              )}
            </strong>{' '}
            ({formatCurrency(confirmTx.tx.amount, confirmTx.tx.currency, numFmt)}) for{' '}
            <strong>{confirmTx.tx.personName}</strong> as{' '}
            <strong>
              {confirmTx.action === 'reverseTransaction' ? 'Reversed' : 'Archived'}
            </strong>{' '}
            and recalculate outstanding receivables.
          </p>
        )}
      </BottomSheet>
    </div>
  );
};
