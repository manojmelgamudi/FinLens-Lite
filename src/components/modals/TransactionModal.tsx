import React, { useEffect, useState } from 'react';
import { CalendarDays, ArrowLeftRight } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { EMIInstallment, Transaction, TransactionType } from '../../types/finance';
import { computeInstallmentStatus, formatCurrency, getTodayISO } from '../../utils/calculations';
import { BottomSheet } from '../common/BottomSheet';
import { CustomFieldsRenderer } from '../common/CustomFieldsRenderer';

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
  defaultPersonId?: string;
  onOpenNewEMIPlan: (personId?: string) => void;
  onSelectInstallmentForPayment: (inst: EMIInstallment) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  open,
  onClose,
  editingTransaction,
  defaultPersonId,
  onOpenNewEMIPlan,
  onSelectInstallmentForPayment,
}) => {
  const { dataset, performSyncAction } = useFinance();
  const activePeople = dataset.people.filter((p) => p.status !== 'Archived');

  const [modeStep, setModeStep] = useState<'choose' | 'one_time' | 'emi_choose'>('choose');
  const [personId, setPersonId] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>('Lending');
  const [date, setDate] = useState(getTodayISO());
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(dataset.settings.defaultCurrency || 'INR');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(dataset.lists.categories[0] || 'Personal Loan');
  const [paymentMethod, setPaymentMethod] = useState(dataset.lists.paymentMethods[0] || 'UPI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [reducesPrincipal, setReducesPrincipal] = useState(true);
  const [customFields, setCustomFields] = useState<Record<string, string | number | boolean>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingTransaction) {
      setModeStep('one_time');
      setPersonId(editingTransaction.personId);
      setTransactionType(editingTransaction.transactionType);
      setDate(editingTransaction.date || '');
      setAmount(String(editingTransaction.amount));
      setCurrency(editingTransaction.currency || 'INR');
      setDescription(editingTransaction.description || '');
      setCategory(editingTransaction.category || 'Personal Loan');
      setPaymentMethod(editingTransaction.paymentMethod || '');
      setReferenceNumber(editingTransaction.referenceNumber || '');
      setNotes(editingTransaction.notes || '');
      setReducesPrincipal(Boolean(editingTransaction.reducesPrincipal));
      setCustomFields(editingTransaction.customFields || {});
      setShowAdvanced(true);
    } else {
      setModeStep('choose');
      const pId = defaultPersonId || activePeople[0]?.id || '';
      const p = activePeople.find((x) => x.id === pId);
      setPersonId(pId);
      setTransactionType('Lending');
      setDate(getTodayISO());
      setAmount('');
      setCurrency(p?.defaultCurrency || dataset.settings.defaultCurrency || 'INR');
      setDescription('');
      setCategory(dataset.lists.categories[0] || 'Personal Loan');
      setPaymentMethod(dataset.lists.paymentMethods[0] || 'UPI');
      setReferenceNumber('');
      setNotes('');
      setReducesPrincipal(true);
      setCustomFields({});
      setShowAdvanced(false);
    }
  }, [open, editingTransaction, defaultPersonId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(amount);
    if (!personId) return setError('Please select a person.');
    if (!Number.isFinite(numAmt) || numAmt <= 0) return setError('Amount must be a positive number.');
    if (!description.trim()) return setError('Description is required.');

    setSaving(true);
    setError(null);
    const ok = await performSyncAction(
      editingTransaction ? 'updateTransaction' : 'addTransaction',
      {
        id: editingTransaction?.id,
        personId,
        transactionType,
        transactionMode: editingTransaction?.transactionMode || 'One-time',
        date,
        amount: numAmt,
        currency,
        description: description.trim(),
        category,
        paymentMethod,
        referenceNumber: referenceNumber.trim(),
        notes: notes.trim(),
        reducesPrincipal: transactionType === 'Interest Adjustment' ? reducesPrincipal : false,
        customFields,
      },
      editingTransaction
        ? `Updated transaction ${editingTransaction.id}`
        : `Added ${transactionType} (${formatCurrency(numAmt, currency)})`
    );
    setSaving(false);
    if (ok) onClose();
  };

  const unpaidInstallments = dataset.emiSchedule
    .map((i) => ({ ...i, status: computeInstallmentStatus(i) }))
    .filter((i) => i.remainingAmount > 0.01 && i.status !== 'Skipped')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const inputClass =
    'w-full rounded-full border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-4 py-2.5 text-sm text-[#171A22] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/40';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        editingTransaction
          ? `Edit Transaction ${editingTransaction.id}`
          : modeStep === 'choose'
          ? 'New Transaction'
          : modeStep === 'emi_choose'
          ? 'EMI Transaction'
          : 'One-Time Transaction'
      }
      subtitle={
        editingTransaction
          ? `Original currency ${editingTransaction.currency} is preserved`
          : 'Select transaction workflow'
      }
      footer={
        modeStep === 'one_time' ? (
          <div className="flex items-center justify-end gap-3">
            {!editingTransaction && (
              <button
                type="button"
                onClick={() => setModeStep('choose')}
                className="px-4 py-2.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-sm font-medium text-[#747B8A]"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-sm font-medium text-[#747B8A]"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="tx-form"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-brand-gradient text-sm font-semibold text-white shadow-xs hover:opacity-95 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingTransaction ? 'Update Transaction' : 'Save Transaction'}
            </button>
          </div>
        ) : undefined
      }
    >
      {modeStep === 'choose' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <button
            type="button"
            onClick={() => setModeStep('one_time')}
            className="text-left rounded-2xl border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] p-5 hover:border-[#1677FF] transition group"
          >
            <div className="h-10 w-10 rounded-xl bg-[#1677FF]/10 text-[#1677FF] flex items-center justify-center mb-3">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <p className="text-base font-semibold text-[#171A22] dark:text-[#F8FAFC]">
              One-Time Transaction
            </p>
            <p className="mt-1 text-xs text-[#747B8A] dark:text-[#9CA3AF]">
              Record lending, repayment, interest earned, adjustment, or fee in INR, USD, or any currency.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setModeStep('emi_choose')}
            className="text-left rounded-2xl border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] p-5 hover:border-[#1677FF] transition group"
          >
            <div className="h-10 w-10 rounded-xl bg-[#38BDF8]/15 text-[#1677FF] flex items-center justify-center mb-3">
              <CalendarDays className="w-5 h-5" />
            </div>
            <p className="text-base font-semibold text-[#171A22] dark:text-[#F8FAFC]">
              EMI Transaction
            </p>
            <p className="mt-1 text-xs text-[#747B8A] dark:text-[#9CA3AF]">
              Create a new Fixed/Flexible EMI plan or record a payment against an existing schedule.
            </p>
          </button>
        </div>
      )}

      {modeStep === 'emi_choose' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewEMIPlan(defaultPersonId);
            }}
            className="w-full text-left rounded-2xl border border-[#1677FF]/30 bg-[#1677FF]/5 p-4 hover:bg-[#1677FF]/10 transition"
          >
            <p className="text-sm font-semibold text-[#1677FF]">+ Create a New EMI Plan</p>
            <p className="mt-0.5 text-xs text-[#747B8A] dark:text-[#9CA3AF]">
              Generates plan and individual installments without auto-creating a duplicate repayment.
            </p>
          </button>

          <div>
            <p className="text-xs font-semibold text-[#747B8A] mb-2">
              Or Record Payment Against an Existing Installment
            </p>
            {unpaidInstallments.length === 0 ? (
              <p className="text-xs text-[#747B8A] py-4 text-center rounded-xl border border-[#E7EAF0] dark:border-[#30343D]">
                No pending EMI installments found. Create an EMI plan above first.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto divide-y divide-[#E7EAF0] dark:divide-[#30343D] rounded-xl border border-[#E7EAF0] dark:border-[#30343D]">
                {unpaidInstallments.slice(0, 15).map((inst, idx) => (
                  <button
                    key={`${inst.id || 'inst'}-${idx}`}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectInstallmentForPayment(inst);
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-[#F7F8FA] dark:hover:bg-[#101216]"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#171A22] dark:text-[#F8FAFC]">
                        {inst.personName} · #{inst.installmentNumber}
                      </p>
                      <p className="text-xs text-[#747B8A]">
                        Due {inst.dueDate} · {inst.status}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[#1677FF] tabular-nums">
                      {formatCurrency(inst.remainingAmount, inst.currency)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setModeStep('choose')}
            className="text-xs font-medium text-[#747B8A] hover:underline"
          >
            ← Back to transaction type
          </button>
        </div>
      )}

      {modeStep === 'one_time' && (
        <form id="tx-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-xs font-medium text-[#DC2626] bg-[#DC2626]/5 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Person *</label>
              <select
                required
                disabled={Boolean(editingTransaction)}
                value={personId}
                onChange={(e) => {
                  setPersonId(e.target.value);
                  const p = activePeople.find((x) => x.id === e.target.value);
                  if (p) setCurrency(p.defaultCurrency || 'INR');
                }}
                className={inputClass}
              >
                <option value="">Select person</option>
                {activePeople.map((p, idx) => (
                  <option key={`${p.id || 'p'}-${idx}`} value={p.id}>
                    {p.name} ({p.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Transaction Type *</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                className={inputClass}
              >
                {dataset.lists.transactionTypes.map((t, idx) => (
                  <option key={`${t}-${idx}`} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`${inputClass} font-semibold tabular-nums`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
                {dataset.lists.currencies.map((c, idx) => (
                  <option key={`${c}-${idx}`} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {transactionType === 'Interest Adjustment' && (
            <label className="flex items-center gap-2.5 text-xs text-[#171A22] dark:text-[#F8FAFC] cursor-pointer">
              <input
                type="checkbox"
                checked={reducesPrincipal}
                onChange={(e) => setReducesPrincipal(e.target.checked)}
                className="h-4 w-4 rounded border-[#E7EAF0] text-[#1677FF]"
              />
              <span>Treat as reduction in principal balance (matches workbook T005 accounting)</span>
            </label>
          )}

          <div>
            <label className="block text-xs font-medium text-[#747B8A] mb-1">Description *</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Bank transfer / Loan repayment"
              className={inputClass}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="text-xs font-semibold text-[#1677FF] hover:underline"
          >
            {showAdvanced ? 'Hide optional details' : '+ Category, payment method, reference & notes'}
          </button>

          {showAdvanced && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#747B8A] mb-1">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                    {dataset.lists.categories.map((c, idx) => (
                      <option key={`${c}-${idx}`} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#747B8A] mb-1">Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                    <option value="">Unspecified</option>
                    {dataset.lists.paymentMethods.map((m, idx) => (
                      <option key={`${m}-${idx}`} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#747B8A] mb-1">Reference #</label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="UTR / Ref"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#747B8A] mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional memo or reconciliation note..."
                  className="w-full rounded-2xl border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-3.5 py-2.5 text-sm text-[#171A22] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/40"
                />
              </div>
            </div>
          )}

          <CustomFieldsRenderer
            entity="Transactions"
            definitions={dataset.customFields}
            values={customFields}
            onChange={setCustomFields}
          />
        </form>
      )}
    </BottomSheet>
  );
};
