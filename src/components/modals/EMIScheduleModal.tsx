import React, { useState } from 'react';
import { CalendarClock, Check, Pause, Play, XCircle } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { EMIInstallment, EMIPlan } from '../../types/finance';
import {
  computeInstallmentStatus,
  formatCurrency,
  formatDateDisplay,
  getEMIPlanDisplayName,
} from '../../utils/calculations';
import { BottomSheet } from '../common/BottomSheet';

interface EMIScheduleModalProps {
  open: boolean;
  onClose: () => void;
  plan: EMIPlan | null;
  onPayInstallment: (inst: EMIInstallment) => void;
}

export const EMIScheduleModal: React.FC<EMIScheduleModalProps> = ({
  open,
  onClose,
  plan,
  onPayInstallment,
}) => {
  const { dataset, performSyncAction } = useFinance();
  const [editingInstId, setEditingInstId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editStatus, setEditStatus] = useState<EMIInstallment['status']>('Pending');
  const [saving, setSaving] = useState(false);

  if (!plan) return null;

  const schedule = dataset.emiSchedule
    .filter((i) => i.emiPlanId === plan.id)
    .map((i) => ({ ...i, status: computeInstallmentStatus(i) }))
    .sort((a, b) => a.installmentNumber - b.installmentNumber);

  const startEdit = (inst: EMIInstallment) => {
    setEditingInstId(inst.id);
    setEditDate(inst.dueDate);
    setEditAmount(String(inst.scheduledAmount));
    setEditStatus(inst.status);
  };

  const saveEdit = async (inst: EMIInstallment) => {
    setSaving(true);
    const ok = await performSyncAction(
      'updateInstallment',
      {
        id: inst.id,
        dueDate: editDate,
        scheduledAmount: Number(editAmount) || inst.scheduledAmount,
        paidAmount: inst.paidAmount,
        status: editStatus,
      },
      `Updated installment #${inst.installmentNumber}`
    );
    setSaving(false);
    if (ok) setEditingInstId(null);
  };

  const handlePlanAction = async (action: 'pauseEMIPlan' | 'resumeEMIPlan' | 'cancelEMIPlan') => {
    setSaving(true);
    await performSyncAction(action, { id: plan.id }, `${action.replace('EMIPlan', '')} ${plan.planName}`);
    setSaving(false);
  };

  const statusColor: Record<string, string> = {
    Paid: 'text-[#16A34A]',
    'Partially Paid': 'text-[#F59E0B]',
    Overdue: 'text-[#DC2626]',
    Pending: 'text-[#3B82F6]',
    Skipped: 'text-[#747B8A]',
    Rescheduled: 'text-[#747B8A]',
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={getEMIPlanDisplayName(plan, dataset.transactions, dataset.emiSchedule)}
      subtitle={`${plan.personName} · ${plan.planType} · ${plan.frequency} · Status: ${plan.status}`}
      maxWidthClass="sm:max-w-2xl"
    >
      {/* Plan Controls */}
      <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-[#E7EAF0] dark:border-[#30343D]">
        {plan.status === 'Active' && (
          <button
            type="button"
            disabled={saving}
            onClick={() => handlePlanAction('pauseEMIPlan')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] px-3 py-1.5 text-xs font-medium text-[#171A22] dark:text-[#F8FAFC] hover:bg-slate-50 dark:hover:bg-[#232730]"
          >
            <Pause className="w-3.5 h-3.5 text-[#F59E0B]" />
            Pause Plan
          </button>
        )}
        {plan.status === 'Paused' && (
          <button
            type="button"
            disabled={saving}
            onClick={() => handlePlanAction('resumeEMIPlan')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] px-3 py-1.5 text-xs font-medium text-[#16A34A] hover:bg-slate-50 dark:hover:bg-[#232730]"
          >
            <Play className="w-3.5 h-3.5" />
            Resume Plan
          </button>
        )}
        {plan.status !== 'Cancelled' && plan.status !== 'Completed' && (
          <button
            type="button"
            disabled={saving}
            onClick={() => handlePlanAction('cancelEMIPlan')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#DC2626]/30 px-3 py-1.5 text-xs font-medium text-[#DC2626] hover:bg-[#DC2626]/5"
          >
            <XCircle className="w-3.5 h-3.5" />
            Cancel Plan
          </button>
        )}
      </div>

      {/* Installment List */}
      <div className="divide-y divide-[#E7EAF0]/80 dark:divide-[#30343D]/80">
        {schedule.map((inst, idx) => {
          const isEditing = editingInstId === inst.id;
          const isPaid = inst.status === 'Paid';
          return (
            <div key={`${inst.id || 'inst'}-${idx}`} className="py-4 first:pt-1 last:pb-1 space-y-2">
              <div className="flex items-center justify-between gap-6">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC]">
                    Installment #{inst.installmentNumber}
                  </p>
                  <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF]">
                    Due {formatDateDisplay(inst.dueDate, dataset.settings.dateFormat)}
                  </p>
                  <p className={`text-[11px] font-medium ${statusColor[inst.status] || 'text-[#747B8A]'}`}>
                    {inst.status}
                    {inst.paidAmount > 0 ? ` · Paid ${formatCurrency(inst.paidAmount, inst.currency)}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 pl-2">
                  <span className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
                    {formatCurrency(
                      inst.remainingAmount > 0 && inst.paidAmount > 0
                        ? inst.remainingAmount
                        : inst.scheduledAmount,
                      inst.currency
                    )}
                  </span>

                  {!isPaid && plan.status === 'Active' && (
                    <button
                      type="button"
                      onClick={() => onPayInstallment(inst)}
                      className="px-3.5 py-1.5 rounded-xl bg-brand-gradient text-xs font-semibold text-white hover:opacity-95"
                    >
                      Pay
                    </button>
                  )}
                  {!isPaid && (
                    <button
                      type="button"
                      onClick={() => (isEditing ? setEditingInstId(null) : startEdit(inst))}
                      className="p-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-[#747B8A] hover:text-[#171A22] dark:hover:text-white"
                      title="Reschedule or edit installment"
                    >
                      <CalendarClock className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="rounded-full border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min={inst.paidAmount}
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="rounded-full border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-3 py-1.5 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30"
                  />
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as EMIInstallment['status'])}
                    className="rounded-full border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Rescheduled">Rescheduled</option>
                    <option value="Skipped">Skipped</option>
                  </select>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => saveEdit(inst)}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#1677FF] text-white text-xs font-semibold px-3 py-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
};
