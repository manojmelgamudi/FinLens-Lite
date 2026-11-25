import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CalendarDays, ChartNoAxesCombined, Landmark, Search, Users, X } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import {
  formatCurrency,
  getEMIPlanDisplayName,
  getTransactionDisplayTitle,
} from '../../utils/calculations';

export type SearchNavTarget =
  | { page: 'person'; personId: string }
  | { page: 'transactions'; highlightId?: string }
  | { page: 'emi'; highlightPlanId?: string }
  | { page: 'investments' }
  | { page: 'debts' };

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (target: SearchNavTarget) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  open,
  onClose,
  onNavigate,
}) => {
  const { dataset } = useFinance();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebounced('');
      return;
    }
    const id = window.setTimeout(() => setDebounced(query.trim().toLowerCase()), 160);
    return () => window.clearTimeout(id);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const results = useMemo(() => {
    if (!debounced) return [];
    const hits: {
      id: string;
      kind: string;
      title: string;
      subtitle: string;
      meta?: string;
      amountLabel?: string;
      target: SearchNavTarget;
    }[] = [];

    for (const p of dataset.people) {
      if (`${p.id} ${p.name} ${p.relationship} ${p.notes}`.toLowerCase().includes(debounced)) {
        hits.push({
          id: `p-${p.id}`,
          kind: 'Person',
          title: p.name,
          subtitle: p.relationship ? `${p.relationship} · ${p.defaultCurrency}` : p.defaultCurrency,
          target: { page: 'person', personId: p.id },
        });
      }
    }

    for (const t of dataset.transactions) {
      const txTitle = getTransactionDisplayTitle(
        t,
        dataset.emiPlans,
        dataset.emiSchedule,
        dataset.transactions
      );
      if (
        `${t.id} ${t.personName} ${t.description} ${txTitle} ${t.amount} ${t.date} ${t.category} ${t.referenceNumber} ${t.notes}`
          .toLowerCase()
          .includes(debounced)
      ) {
        hits.push({
          id: `t-${t.id}`,
          kind: 'Transaction',
          title: t.personName || txTitle,
          subtitle: txTitle,
          meta: t.date || 'Opening Balance',
          amountLabel: formatCurrency(t.amount, t.currency),
          target: { page: 'transactions', highlightId: t.id },
        });
      }
    }

    for (const e of dataset.emiPlans) {
      const planTitle = getEMIPlanDisplayName(e, dataset.transactions, dataset.emiSchedule);
      if (`${e.id} ${e.planName} ${planTitle} ${e.personName} ${e.totalPrincipal}`.toLowerCase().includes(debounced)) {
        hits.push({
          id: `e-${e.id}`,
          kind: 'EMI Plan',
          title: planTitle,
          subtitle: `${e.personName} · ${e.frequency}`,
          amountLabel: formatCurrency(e.totalPrincipal, e.currency),
          target: { page: 'emi', highlightPlanId: e.id },
        });
      }
    }

    for (const i of dataset.emiSchedule) {
      if (`${i.id} ${i.personName} ${i.dueDate} ${i.scheduledAmount}`.toLowerCase().includes(debounced)) {
        hits.push({
          id: `i-${i.id}`,
          kind: 'Installment',
          title: i.personName,
          subtitle: `Installment #${i.installmentNumber} · ${i.status}`,
          meta: `Due ${i.dueDate}`,
          amountLabel: formatCurrency(i.scheduledAmount, i.currency),
          target: { page: 'emi', highlightPlanId: i.emiPlanId },
        });
      }
    }

    for (const inv of dataset.investments) {
      if (`${inv.id} ${inv.name} ${inv.category} ${inv.amountInvested}`.toLowerCase().includes(debounced)) {
        hits.push({
          id: `inv-${inv.id}`,
          kind: 'Investment',
          title: inv.name,
          subtitle: inv.category,
          amountLabel: formatCurrency(inv.amountInvested, inv.currency),
          target: { page: 'investments' },
        });
      }
    }

    for (const d of dataset.debts) {
      if (`${d.id} ${d.creditor} ${d.description} ${d.amount}`.toLowerCase().includes(debounced)) {
        hits.push({
          id: `d-${d.id}`,
          kind: 'Debt',
          title: d.creditor,
          subtitle: d.description || 'Liability',
          amountLabel: formatCurrency(d.outstandingAmount, d.currency),
          target: { page: 'debts' },
        });
      }
    }

    return hits.slice(0, 25);
  }, [debounced, dataset]);

  if (!open) return null;

  const iconForKind = (kind: string) => {
    switch (kind) {
      case 'Person':
        return <Users className="w-4 h-4 text-[#1677FF]" />;
      case 'Transaction':
        return <ArrowLeftRight className="w-4 h-4 text-[#3B82F6]" />;
      case 'Investment':
        return <ChartNoAxesCombined className="w-4 h-4 text-[#16A34A]" />;
      case 'Debt':
        return <Landmark className="w-4 h-4 text-[#DC2626]" />;
      default:
        return <CalendarDays className="w-4 h-4 text-[#38BDF8]" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-xs pt-14 sm:pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E7EAF0] dark:border-[#30343D]">
          <Search className="w-5 h-5 text-[#747B8A] shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, Amount, Transactions"
            className="w-full bg-transparent text-sm text-[#171A22] dark:text-[#F8FAFC] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#747B8A] hover:bg-slate-100 dark:hover:bg-[#232730]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-[#E7EAF0]/80 dark:divide-[#30343D]/80">
          {!debounced && (
            <p className="px-4 py-8 text-center text-xs text-[#747B8A]">
              Search people, Amount, Transactions.
            </p>
          )}
          {debounced && results.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-[#747B8A]">
              No matching records found for "{debounced}".
            </p>
          )}
          {results.map((item, idx) => (
            <button
              key={`${item.id}-${idx}`}
              type="button"
              onClick={() => {
                onNavigate(item.target);
                onClose();
              }}
              className="w-full flex items-center justify-between gap-6 px-5 py-4 text-left hover:bg-[#F7F8FA] dark:hover:bg-[#101216] transition"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-10 w-10 rounded-2xl bg-[#F7F8FA] dark:bg-[#101216] flex items-center justify-center shrink-0">
                  {iconForKind(item.kind)}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF] truncate">
                    {item.subtitle}
                  </p>
                  <p className="text-[11px] font-medium text-[#747B8A]/90 dark:text-[#9CA3AF]/80">
                    {item.meta ? `${item.kind} · ${item.meta}` : item.kind}
                  </p>
                </div>
              </div>
              {item.amountLabel && (
                <span className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums shrink-0 pl-2">
                  {item.amountLabel}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
