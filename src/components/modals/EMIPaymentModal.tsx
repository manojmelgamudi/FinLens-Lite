import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { EMIInstallment } from '../../types/finance';
import {
  AdvanceAllocationStrategy,
  allocateAdvancePayment,
  formatCurrency,
  formatDateDisplay,
  getEMIPlanDisplayName,
  getTodayISO,
  roundCurrency,
} from '../../utils/calculations';
import { BottomSheet } from '../common/BottomSheet';

interface EMIPaymentModalProps {
  open: boolean;
  onClose: () => void;
  installment: EMIInstallment | null;
}

export const EMIPaymentModal: React.FC<EMIPaymentModalProps> = ({
  open,
  onClose,
  installment,
}) => {
  const { dataset, performSyncAction } = useFinance();

  const [amountReceived, setAmountReceived] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayISO());
  const [paymentMethod, setPaymentMethod] = useState(dataset.lists.paymentMethods[0] || 'UPI');
  const [notes, setNotes] = useState('');
  const [isAdvanceMode, setIsAdvanceMode] = useState(false);
  const [strategy, setStrategy] = useState<AdvanceAllocationStrategy>('current_first');
  const [customAlloc, setCustomAlloc] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = useMemo(
    () => dataset.emiPlans.find((p) => p.id === installment?.emiPlanId),
    [dataset.emiPlans, installment]
  );

  const planInstallments = useMemo(
    () =>
      dataset.emiSchedule
        .filter(
          (i) =>
            i.emiPlanId === installment?.emiPlanId &&
            i.remainingAmount > 0.01 &&
            i.status !== 'Skipped'
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [dataset.emiSchedule, installment]
  );

  const totalPlanRemaining = useMemo(
    () => roundCurrency(planInstallments.reduce((acc, i) => acc + i.remainingAmount, 0)),
    [planInstallments]
  );

  useEffect(() => {
    if (!open || !installment) return;
    setError(null);
    setAmountReceived(String(installment.remainingAmount));
    setPaymentDate(getTodayISO());
    setPaymentMethod(dataset.lists.paymentMethods[0] || 'UPI');
    setNotes('');
    setIsAdvanceMode(false);
    setStrategy('current_first');
    setCustomAlloc({});
  }, [open, installment]);

  if (!installment) return null;

  const amtNum = Number(amountReceived) || 0;
  const exceedsSingleInstallment = amtNum > installment.remainingAmount + 0.01;

  const allocations = useMemo(() => {
    if (amtNum <= 0) return [];
    if (!exceedsSingleInstallment && !isAdvanceMode) {
      return [{ installmentId: installment.id, appliedAmount: roundCurrency(amtNum) }];
    }
    const customParsed: Record<string, number> = {};
    for (const [k, v] of Object.entries(customAlloc)) {
      customParsed[k] = Number(v) || 0;
    }
    return allocateAdvancePayment(
      planInstallments,
      installment.id,
      amtNum,
      strategy,
      customParsed
    );
  }, [amtNum, exceedsSingleInstallment, isAdvanceMode, installment, planInstallments, strategy, customAlloc]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return; // Prevent double-tap duplicate payments

    if (installment.remainingAmount <= 0.01) {
      setError('This installment is already fully paid.');
      return;
    }
    if (!Number.isFinite(amtNum) || amtNum <= 0) {
      setError('Enter a valid positive payment amount.');
      return;
    }
    if (exceedsSingleInstallment && !isAdvanceMode) {
      setError('Amount exceeds this installment remaining balance. Enable Advance Payment allocation to pay multiple installments.');
      return;
    }
    if (amtNum > totalPlanRemaining + 0.01) {
      setError(`Payment exceeds total remaining plan balance (${formatCurrency(totalPlanRemaining, installment.currency)}).`);
      return;
    }
    if (allocations.length === 0) {
      setError('Please allocate the payment to at least one installment.');
      return;
    }

    setSaving(true);
    setError(null);
    const resolvedPlanName = getEMIPlanDisplayName(plan, dataset.transactions, dataset.emiSchedule);
    const ok = await performSyncAction(
      'recordEMIPayment',
      {
        emiPlanId: installment.emiPlanId,
        planName: resolvedPlanName,
        paymentDate,
        paymentMethod,
        notes: notes.trim(),
        allocations,
      },
      `Recorded ${formatCurrency(amtNum, installment.currency)} EMI payment for ${installment.personName}`
    );
    setSaving(false);
    if (ok) onClose();
  };

  const inputClass =
    'w-full rounded-full border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-4 py-2.5 text-sm text-[#171A22] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/40';

  const resolvedSubtitlePlanName = getEMIPlanDisplayName(
    plan,
    dataset.transactions,
    dataset.emiSchedule
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Confirm EMI Payment"
      subtitle={`${installment.personName} · ${resolvedSubtitlePlanName} · Installment #${installment.installmentNumber}`}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-sm font-medium text-[#747B8A]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="emi-payment-form"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-gradient text-sm font-semibold text-white shadow-xs hover:opacity-95 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{saving ? 'Recording...' : 'Confirm Payment'}</span>
          </button>
        </div>
      }
    >
      <form id="emi-payment-form" onSubmit={handleConfirm} className="space-y-4">
        {error && (
          <p className="text-xs font-medium text-[#DC2626] bg-[#DC2626]/5 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="grid grid-cols-3 gap-3 rounded-2xl bg-[#F7F8FA] dark:bg-[#101216] border border-[#E7EAF0] dark:border-[#30343D] p-3.5 text-xs">
          <div>
            <p className="text-[#747B8A]">Due Date</p>
            <p className="mt-0.5 font-semibold text-[#171A22] dark:text-[#F8FAFC]">
              {formatDateDisplay(installment.dueDate, dataset.settings.dateFormat)}
            </p>
          </div>
          <div>
            <p className="text-[#747B8A]">Scheduled</p>
            <p className="mt-0.5 font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
              {formatCurrency(installment.scheduledAmount, installment.currency)}
            </p>
          </div>
          <div>
            <p className="text-[#747B8A]">Remaining Due</p>
            <p className="mt-0.5 font-semibold text-[#1677FF] tabular-nums">
              {formatCurrency(installment.remainingAmount, installment.currency)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#747B8A] mb-1">
              Amount Received ({installment.currency}) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amountReceived}
              onChange={(e) => {
                setAmountReceived(e.target.value);
                if (Number(e.target.value) > installment.remainingAmount + 0.01) {
                  setIsAdvanceMode(true);
                }
              }}
              className={`${inputClass} font-semibold tabular-nums`}
            />
            {amtNum > 0 && amtNum < installment.remainingAmount - 0.01 && (
              <p className="mt-1 text-[11px] text-[#F59E0B] font-medium">
                Partial payment · Remaining after this:{' '}
                {formatCurrency(installment.remainingAmount - amtNum, installment.currency)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#747B8A] mb-1">Payment Date *</label>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className={inputClass}
            />
            {paymentDate < installment.dueDate && (
              <p className="mt-1 text-[11px] text-[#1677FF] font-medium">
                Early payment (future due dates remain unchanged).
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#747B8A] mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={inputClass}
            >
              {dataset.lists.paymentMethods.map((m, idx) => (
                <option key={`${m}-${idx}`} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#747B8A] mb-1">Notes / Reference</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="UPI ref or memo"
              className={inputClass}
            />
          </div>
        </div>

        {/* Advance Multi-Installment Allocation */}
        {planInstallments.length > 1 && (
          <div className="pt-2 border-t border-[#E7EAF0] dark:border-[#30343D] space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#171A22] dark:text-[#F8FAFC]">
              <input
                type="checkbox"
                checked={isAdvanceMode}
                onChange={(e) => setIsAdvanceMode(e.target.checked)}
                className="h-4 w-4 rounded border-[#E7EAF0] text-[#1677FF]"
              />
              <span>Pay multiple installments in advance</span>
            </label>

            {isAdvanceMode && (
              <div className="space-y-3 rounded-xl bg-[#F7F8FA] dark:bg-[#101216] border border-[#E7EAF0] dark:border-[#30343D] p-3">
                <div>
                  <label className="block text-xs font-medium text-[#747B8A] mb-1">
                    Allocation Strategy
                  </label>
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value as AdvanceAllocationStrategy)}
                    className={inputClass}
                  >
                    <option value="current_first">Current installment first, then upcoming</option>
                    <option value="oldest_pending">Oldest pending installments first</option>
                    <option value="custom">Custom allocation</option>
                  </select>
                </div>

                {strategy === 'custom' ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {planInstallments.map((inst, idx) => (
                      <div key={`${inst.id || 'inst'}-${idx}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[#747B8A]">
                          #{inst.installmentNumber} ({inst.dueDate}) · Due{' '}
                          {formatCurrency(inst.remainingAmount, inst.currency)}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={inst.remainingAmount}
                          value={customAlloc[inst.id] || ''}
                          onChange={(e) =>
                            setCustomAlloc((prev) => ({ ...prev, [inst.id]: e.target.value }))
                          }
                          placeholder="0"
                          className="w-24 rounded-full border border-[#E7EAF0] dark:border-[#30343D] bg-white dark:bg-[#1A1D24] px-3 py-1 text-right tabular-nums"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs space-y-1">
                    <p className="font-medium text-[#747B8A]">Allocation Preview:</p>
                    {allocations.map((a, idx) => {
                      const inst = planInstallments.find((x) => x.id === a.installmentId);
                      return (
                        <div key={`${a.installmentId || 'alloc'}-${idx}`} className="flex justify-between tabular-nums">
                          <span>
                            #{inst?.installmentNumber} ({inst?.dueDate})
                          </span>
                          <span className="font-semibold text-[#16A34A]">
                            {formatCurrency(a.appliedAmount, installment.currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </form>
    </BottomSheet>
  );
};
