import React, { useEffect, useMemo, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { EMIFrequency, EMIPlanType } from '../../types/finance';
import {
  addFrequencyToDate,
  formatCurrency,
  generateEMIScheduleItems,
  getTodayISO,
  roundCurrency,
} from '../../utils/calculations';
import { BottomSheet } from '../common/BottomSheet';
import { CustomFieldsRenderer } from '../common/CustomFieldsRenderer';

interface EMIPlanModalProps {
  open: boolean;
  onClose: () => void;
  defaultPersonId?: string;
}

export const EMIPlanModal: React.FC<EMIPlanModalProps> = ({
  open,
  onClose,
  defaultPersonId,
}) => {
  const { dataset, performSyncAction } = useFinance();
  const activePeople = dataset.people.filter((p) => p.status !== 'Archived');

  const [personId, setPersonId] = useState('');
  const [planName, setPlanName] = useState('');
  const [planType, setPlanType] = useState<EMIPlanType>('Fixed');
  const [totalPrincipal, setTotalPrincipal] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [frequency, setFrequency] = useState<EMIFrequency>('Monthly');
  const [customIntervalDays, setCustomIntervalDays] = useState('30');
  const [startDate, setStartDate] = useState(getTodayISO());
  const [firstDueDate, setFirstDueDate] = useState(getTodayISO());
  const [dueDay, setDueDay] = useState(String(new Date().getDate()));
  const [numberOfInstallments, setNumberOfInstallments] = useState('6');
  const [interest, setInterest] = useState('0');
  const [processingFee, setProcessingFee] = useState('0');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string | number | boolean>>({});
  const [flexibleRows, setFlexibleRows] = useState<{ dueDate: string; amount: string }[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const pId = defaultPersonId || activePeople[0]?.id || '';
    const p = activePeople.find((x) => x.id === pId);
    setPersonId(pId);
    setCurrency(p?.defaultCurrency || dataset.settings.defaultCurrency || 'INR');
    setPlanName('');
    setPlanType('Fixed');
    setTotalPrincipal('');
    setInstallmentAmount('');
    setFrequency('Monthly');
    setCustomIntervalDays('30');
    const today = getTodayISO();
    setStartDate(today);
    setFirstDueDate(today);
    setDueDay(String(Number(today.slice(8, 10)) || 1));
    setNumberOfInstallments('6');
    setInterest('0');
    setProcessingFee('0');
    setNotes('');
    setCustomFields({});
    setShowAdvanced(false);
  }, [open, defaultPersonId]);

  const countNum = Math.max(1, Math.min(120, Math.floor(Number(numberOfInstallments) || 1)));
  const principalNum = Number(totalPrincipal) || 0;
  const interestNum = Number(interest) || 0;
  const feeNum = Number(processingFee) || 0;
  const totalPayable = roundCurrency(principalNum + interestNum + feeNum);

  // Auto-suggest installment amount when principal or count changes in Fixed mode
  useEffect(() => {
    if (planType === 'Fixed' && totalPayable > 0 && countNum > 0) {
      setInstallmentAmount(String(roundCurrency(totalPayable / countNum)));
    }
  }, [totalPrincipal, interest, processingFee, numberOfInstallments, planType]);

  // Keep flexible rows synced with installment count
  useEffect(() => {
    if (planType !== 'Flexible') return;
    const suggested = countNum > 0 && totalPayable > 0 ? roundCurrency(totalPayable / countNum) : 0;
    const rows: { dueDate: string; amount: string }[] = [];
    for (let i = 0; i < countNum; i++) {
      const existing = flexibleRows[i];
      rows.push({
        dueDate:
          existing?.dueDate ||
          addFrequencyToDate(
            firstDueDate,
            i,
            frequency,
            Number(customIntervalDays) || 30,
            Number(dueDay) || 1
          ),
        amount: existing?.amount ?? String(suggested),
      });
    }
    setFlexibleRows(rows);
  }, [planType, countNum, firstDueDate, frequency]);

  const previewSchedule = useMemo(() => {
    if (principalNum <= 0) return [];
    const person = activePeople.find((p) => p.id === personId);
    const customAmounts =
      planType === 'Flexible'
        ? flexibleRows.map((r) => ({ dueDate: r.dueDate, amount: Number(r.amount) || 0 }))
        : undefined;

    return generateEMIScheduleItems(
      {
        id: 'PREVIEW',
        personId,
        personName: person?.name || '',
        planName: planName || 'EMI Plan',
        planType,
        totalPrincipal: principalNum,
        installmentAmount: Number(installmentAmount) || roundCurrency(totalPayable / countNum),
        currency,
        frequency,
        customIntervalDays: Number(customIntervalDays) || 30,
        startDate,
        firstDueDate,
        dueDay: Number(dueDay) || 1,
        numberOfInstallments: countNum,
        endDate: '',
        interestRateOrAmount: interestNum,
        processingFee: feeNum,
        status: 'Active',
        notes,
        customFields,
      },
      customAmounts
    );
  }, [
    personId,
    planName,
    planType,
    principalNum,
    installmentAmount,
    currency,
    frequency,
    customIntervalDays,
    startDate,
    firstDueDate,
    dueDay,
    countNum,
    interestNum,
    feeNum,
    flexibleRows,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personId) return setError('Please select a person.');
    if (!planName.trim()) return setError('Please enter an EMI plan name.');
    if (principalNum <= 0) return setError('Total principal must be positive.');
    if (previewSchedule.length === 0) return setError('Schedule could not be generated.');

    setSaving(true);
    setError(null);
    const lastDue = previewSchedule[previewSchedule.length - 1]?.dueDate || firstDueDate;

    const ok = await performSyncAction(
      'createEMIPlan',
      {
        personId,
        planName: planName.trim(),
        planType,
        totalPrincipal: principalNum,
        installmentAmount:
          Number(installmentAmount) || roundCurrency(totalPayable / countNum),
        currency,
        frequency,
        customIntervalDays: Number(customIntervalDays) || 30,
        startDate,
        firstDueDate,
        dueDay: Number(dueDay) || 1,
        numberOfInstallments: countNum,
        endDate: lastDue,
        interestRateOrAmount: interestNum,
        processingFee: feeNum,
        notes: notes.trim(),
        customFields,
        installments: previewSchedule,
      },
      `Created EMI Plan "${planName.trim()}" (${countNum} installments)`
    );
    setSaving(false);
    if (ok) onClose();
  };

  const inputClass =
    'w-full rounded-full border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-3.5 py-2 text-sm text-[#171A22] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/40';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Create EMI Plan"
      subtitle="Generates separate EMI Plan & Installment Schedule records. Unpaid installments never count as received."
      maxWidthClass="sm:max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-[#747B8A] dark:text-[#9CA3AF]">
            {previewSchedule.length} installments · Total{' '}
            <span className="font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
              {formatCurrency(
                previewSchedule.reduce((acc, s) => acc + s.scheduledAmount, 0),
                currency
              )}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-sm font-medium text-[#747B8A]"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="emi-plan-form"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-brand-gradient text-sm font-semibold text-white shadow-xs hover:opacity-95 disabled:opacity-50"
            >
              {saving ? 'Generating...' : 'Save EMI Plan'}
            </button>
          </div>
        </div>
      }
    >
      <form id="emi-plan-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-xs font-medium text-[#DC2626] bg-[#DC2626]/5 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {/* Fixed vs Flexible Segmented Switch */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F7F8FA] dark:bg-[#101216] border border-[#E7EAF0] dark:border-[#30343D]">
          {(['Fixed', 'Flexible'] as EMIPlanType[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPlanType(mode)}
              className={`py-2 text-xs font-semibold rounded-lg transition ${
                planType === mode
                  ? 'bg-white dark:bg-[#1A1D24] text-[#1677FF] shadow-xs'
                  : 'text-[#747B8A] dark:text-[#9CA3AF]'
              }`}
            >
              {mode} EMI Plan
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#747B8A] mb-1">Person *</label>
            <select
              required
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
            <label className="block text-xs font-medium text-[#747B8A] mb-1">EMI Plan Name *</label>
            <input
              type="text"
              required
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="e.g., Bike Loan / Consolidation"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-xs font-medium text-[#747B8A] mb-1">Total Principal *</label>
            <input
              type="number"
              step="0.01"
              min="1"
              required
              value={totalPrincipal}
              onChange={(e) => setTotalPrincipal(e.target.value)}
              placeholder="0.00"
              className={`${inputClass} tabular-nums`}
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

          <div>
            <label className="block text-xs font-medium text-[#747B8A] mb-1">Installments *</label>
            <input
              type="number"
              min="1"
              max="120"
              required
              value={numberOfInstallments}
              onChange={(e) => setNumberOfInstallments(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#747B8A] mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as EMIFrequency)}
              className={inputClass}
            >
              {dataset.lists.emiFrequencies.map((f, idx) => (
                <option key={`${f}-${idx}`} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#747B8A] mb-1">First Due Date *</label>
            <input
              type="date"
              required
              value={firstDueDate}
              onChange={(e) => {
                setFirstDueDate(e.target.value);
                if (e.target.value) setDueDay(String(Number(e.target.value.slice(8, 10)) || 1));
              }}
              className={inputClass}
            />
          </div>

          {planType === 'Fixed' && (
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Installment Amount</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={installmentAmount}
                onChange={(e) => setInstallmentAmount(e.target.value)}
                className={`${inputClass} tabular-nums`}
              />
            </div>
          )}

          {frequency === 'Custom' && (
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Every (Days)</label>
              <input
                type="number"
                min="1"
                value={customIntervalDays}
                onChange={(e) => setCustomIntervalDays(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="text-xs font-semibold text-[#1677FF] hover:underline"
        >
          {showAdvanced ? 'Hide advanced EMI options' : '+ Start date, due day, interest, processing fee & notes'}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Due Day (1–31)</label>
              <input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Interest Total</label>
              <input type="number" step="0.01" min="0" value={interest} onChange={(e) => setInterest(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Processing Fee</label>
              <input type="number" step="0.01" min="0" value={processingFee} onChange={(e) => setProcessingFee(e.target.value)} className={inputClass} />
            </div>
            <div className="col-span-2 sm:col-span-4">
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Notes</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Terms or agreement notes" className={inputClass} />
            </div>
          </div>
        )}

        {/* Flexible Schedule Editor OR Fixed Schedule Preview */}
        {planType === 'Flexible' && flexibleRows.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#171A22] dark:text-[#F8FAFC]">
              Customize Individual Installments
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {flexibleRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-2 text-xs font-medium text-[#747B8A] tabular-nums">
                    #{idx + 1}
                  </span>
                  <input
                    type="date"
                    value={row.dueDate}
                    onChange={(e) => {
                      const next = [...flexibleRows];
                      next[idx] = { ...next[idx], dueDate: e.target.value };
                      setFlexibleRows(next);
                    }}
                    className={`col-span-5 ${inputClass}`}
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.amount}
                    onChange={(e) => {
                      const next = [...flexibleRows];
                      next[idx] = { ...next[idx], amount: e.target.value };
                      setFlexibleRows(next);
                    }}
                    className={`col-span-5 ${inputClass} tabular-nums`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {planType === 'Fixed' && previewSchedule.length > 0 && (
          <div className="rounded-xl border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] p-3">
            <p className="text-xs font-semibold text-[#747B8A] mb-2">
              Generated Schedule Preview ({previewSchedule.length} installments)
            </p>
            <div className="max-h-36 overflow-y-auto divide-y divide-[#E7EAF0] dark:divide-[#30343D] text-xs">
              {previewSchedule.map((item, idx) => (
                <div key={`${item.id || 'prev'}-${idx}`} className="py-1.5 flex items-center justify-between tabular-nums">
                  <span className="text-[#747B8A]">
                    #{item.installmentNumber} · {item.dueDate}
                  </span>
                  <span className="font-semibold text-[#171A22] dark:text-[#F8FAFC]">
                    {formatCurrency(item.scheduledAmount, item.currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <CustomFieldsRenderer
          entity="EMI Plans"
          definitions={dataset.customFields}
          values={customFields}
          onChange={setCustomFields}
        />
      </form>
    </BottomSheet>
  );
};
