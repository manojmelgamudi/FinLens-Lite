import React, { useMemo, useState } from 'react';
import { Archive, CheckCircle2, Edit3, Landmark, Plus } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { Debt } from '../types/finance';
import { computeDebtMetrics, formatCurrency, formatDateDisplay, getTodayISO } from '../utils/calculations';
import { BottomSheet } from '../components/common/BottomSheet';
import { CustomFieldsRenderer } from '../components/common/CustomFieldsRenderer';

export const DebtsPage: React.FC = () => {
  const { dataset, displayCurrency, performSyncAction } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);

  const [creditor, setCreditor] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [amount, setAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');
  const [currency, setCurrency] = useState('INR');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string | number | boolean>>({});
  const [saving, setSaving] = useState(false);

  const rates = dataset.settings.exchangeRatesToINR;
  const numFmt = dataset.settings.numberFormat;
  const metrics = useMemo(
    () => computeDebtMetrics(dataset.debts, displayCurrency, rates),
    [dataset.debts, displayCurrency, rates]
  );
  const activeDebts = dataset.debts.filter((d) => d.status !== 'Archived');

  const openAdd = () => {
    setEditing(null);
    setCreditor('');
    setDescription('');
    setDate(getTodayISO());
    setAmount('');
    setAmountPaid('0');
    setCurrency(dataset.settings.defaultCurrency || 'INR');
    setNotes('');
    setCustomFields({});
    setModalOpen(true);
  };

  const openEdit = (d: Debt) => {
    setEditing(d);
    setCreditor(d.creditor);
    setDescription(d.description);
    setDate(d.date);
    setAmount(String(d.amount));
    setAmountPaid(String(d.amountPaid));
    setCurrency(d.currency);
    setNotes(d.notes);
    setCustomFields(d.customFields || {});
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditor.trim() || Number(amount) <= 0) return;
    setSaving(true);
    const ok = await performSyncAction(
      editing ? 'updateDebt' : 'addDebt',
      {
        id: editing?.id,
        creditor: creditor.trim(),
        description: description.trim(),
        date,
        amount: Number(amount),
        amountPaid: Number(amountPaid) || 0,
        currency,
        notes: notes.trim(),
        customFields,
      },
      editing ? `Updated debt (${creditor.trim()})` : `Added debt (${creditor.trim()})`
    );
    setSaving(false);
    if (ok) setModalOpen(false);
  };

  const inputClass =
    'w-full rounded-full border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[#171A22] dark:text-[#F8FAFC]">
            Debts & Liabilities
          </h2>
          <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF]">
            Independent liabilities tracker · Initial workbook value is zero
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-xs whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Debt</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5">
          <p className="text-xs text-[#747B8A]">Total Liabilities</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums">
            {formatCurrency(metrics.totalLiabilities, displayCurrency, numFmt)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5">
          <p className="text-xs text-[#747B8A]">Total Paid</p>
          <p className="mt-1.5 text-2xl font-semibold text-[#16A34A] tabular-nums">
            {formatCurrency(metrics.totalPaid, displayCurrency, numFmt)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5">
          <p className="text-xs text-[#747B8A]">Remaining Liabilities</p>
          <p className="mt-1.5 text-2xl font-semibold text-[#DC2626] tabular-nums">
            {formatCurrency(metrics.remainingLiabilities, displayCurrency, numFmt)}
          </p>
        </div>
      </div>

      <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-6 shadow-xs">
        {activeDebts.length === 0 ? (
          <div className="py-10 text-center">
            <Landmark className="w-8 h-8 text-[#747B8A]/50 mx-auto mb-2" />
            <p className="text-sm font-medium">Zero outstanding liabilities</p>
            <p className="text-xs text-[#747B8A] mt-0.5">
              Matches your workbook initial debt balance of zero. Add a liability if needed.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E7EAF0]/80 dark:divide-[#30343D]/80">
            {activeDebts.map((d, idx) => (
              <div key={`${d.id || 'debt'}-${idx}`} className="py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-6">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-10 w-10 rounded-2xl bg-[#DC2626]/10 flex items-center justify-center shrink-0">
                    <Landmark className="w-4 h-4 text-[#DC2626]" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] truncate">
                      {d.creditor}
                    </p>
                    <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF] truncate">
                      {d.description || 'Liability'}
                    </p>
                    <p
                      className={`text-[11px] font-medium ${
                        d.status === 'Settled'
                          ? 'text-[#16A34A]'
                          : 'text-[#747B8A]/90 dark:text-[#9CA3AF]/80'
                      }`}
                    >
                      {formatDateDisplay(d.date, dataset.settings.dateFormat)} · {d.status}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 pl-2">
                  <span className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
                    {formatCurrency(d.outstandingAmount, d.currency, numFmt)}
                  </span>
                  {d.status !== 'Settled' && (
                    <button
                      type="button"
                      onClick={() => performSyncAction('settleDebt', { id: d.id }, `Settled debt ${d.creditor}`)}
                      className="p-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-[#16A34A] hover:bg-[#16A34A]/5 transition"
                      title="Mark settled"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(d)}
                    className="p-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-[#747B8A] hover:text-[#171A22] dark:hover:text-white transition"
                    aria-label="Edit debt"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => performSyncAction('archiveDebt', { id: d.id }, `Archived debt ${d.creditor}`)}
                    className="p-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-[#747B8A] hover:text-[#DC2626] transition"
                    aria-label="Archive debt"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomSheet
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Debt (${editing.creditor})` : 'Add Debt / Liability'}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-sm text-[#747B8A]"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="debt-form"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-brand-gradient text-sm font-semibold text-white"
            >
              {saving ? 'Saving...' : 'Save Debt'}
            </button>
          </div>
        }
      >
        <form id="debt-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Creditor *</label>
              <input type="text" required value={creditor} onChange={(e) => setCreditor(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Description *</label>
              <input type="text" required value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Original Amount *</label>
              <input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} tabular-nums`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Amount Paid</label>
              <input type="number" step="0.01" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className={`${inputClass} tabular-nums`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
                {dataset.lists.currencies.map((c, idx) => <option key={`${c}-${idx}`} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Date *</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#747B8A] mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30"
            />
          </div>

          <CustomFieldsRenderer
            entity="Debts"
            definitions={dataset.customFields}
            values={customFields}
            onChange={setCustomFields}
          />
        </form>
      </BottomSheet>
    </div>
  );
};
