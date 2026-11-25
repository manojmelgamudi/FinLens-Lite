import {
  AppSettings,
  CurrencyCode,
  DateRangeFilter,
  Debt,
  EMIInstallment,
  EMIInstallmentStatus,
  EMIPlan,
  FinanceDataset,
  Investment,
  Person,
  PersonFinancialSummary,
  Transaction,
} from '../types/finance';

export const DEFAULT_EXCHANGE_RATES_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 84.5,
  EUR: 91.2,
  GBP: 107.4,
  AED: 23.0,
};

export function getCurrencySymbol(currency: CurrencyCode): string {
  const symbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    AED: 'د.إ ',
  };
  return symbols[currency] || `${currency} `;
}

export function convertCurrency(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  exchangeRatesToINR: Record<string, number> = DEFAULT_EXCHANGE_RATES_TO_INR
): number {
  if (!Number.isFinite(amount)) return 0;
  if (fromCurrency === toCurrency) return amount;

  const fromRate = exchangeRatesToINR[fromCurrency] ?? (fromCurrency === 'INR' ? 1 : 84.5);
  const toRate = exchangeRatesToINR[toCurrency] ?? (toCurrency === 'INR' ? 1 : 84.5);
  if (toRate === 0) return amount;

  const inINR = amount * fromRate;
  return inINR / toRate;
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = 'INR',
  numberFormat: 'en-IN' | 'en-US' = 'en-IN',
  maximumFractionDigits = 2
): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const locale = currency === 'INR' && numberFormat === 'en-IN' ? 'en-IN' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'INR',
      minimumFractionDigits: Math.abs(safe % 1) > 0.001 ? 2 : 0,
      maximumFractionDigits,
    }).format(safe);
  } catch {
    return `${getCurrencySymbol(currency)}${safe.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

export function formatDateDisplay(
  isoDate: string | undefined | null,
  dateFormat: AppSettings['dateFormat'] = 'DD/MM/YYYY'
): string {
  if (!isoDate) return 'Undated';
  const clean = isoDate.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  if (dateFormat === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
  if (dateFormat === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
  return `${d}/${m}/${y}`;
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Computes effective installment status based on remaining amount, paid amount, and due date.
 * Never marks a fully paid, skipped, or rescheduled installment overdue.
 */
export function computeInstallmentStatus(
  installment: Pick<EMIInstallment, 'scheduledAmount' | 'paidAmount' | 'dueDate' | 'status'>,
  todayISO: string = getTodayISO()
): EMIInstallmentStatus {
  if (installment.status === 'Skipped' || installment.status === 'Rescheduled') {
    return installment.status;
  }
  const remaining = Math.max(0, roundCurrency(installment.scheduledAmount - installment.paidAmount));
  if (remaining <= 0.01) {
    return 'Paid';
  }
  if (installment.paidAmount > 0 && remaining > 0.01) {
    return installment.dueDate && installment.dueDate < todayISO ? 'Overdue' : 'Partially Paid';
  }
  if (installment.dueDate && installment.dueDate < todayISO) {
    return 'Overdue';
  }
  return 'Pending';
}

export function roundCurrency(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Checks whether a transaction falls within a Dashboard date range filter.
 * Legacy undated transactions (date === '') are included in 'all' and in balance calculations.
 */
export function isDateInRange(isoDate: string, filter: DateRangeFilter, todayISO: string = getTodayISO()): boolean {
  if (filter.preset === 'all') return true;
  if (!isoDate) return false;
  const d = isoDate.slice(0, 10);
  const today = new Date(`${todayISO}T00:00:00`);
  const year = today.getFullYear();
  const month = today.getMonth();

  let start = '';
  let end = todayISO;

  switch (filter.preset) {
    case 'this_month': {
      start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      break;
    }
    case 'last_month': {
      const lm = new Date(year, month - 1, 1);
      const lmLast = new Date(year, month, 0);
      start = toISODate(lm);
      end = toISODate(lmLast);
      break;
    }
    case 'last_3_months': {
      const s = new Date(year, month - 2, 1);
      start = toISODate(s);
      break;
    }
    case 'last_6_months': {
      const s = new Date(year, month - 5, 1);
      start = toISODate(s);
      break;
    }
    case 'this_year': {
      start = `${year}-01-01`;
      end = `${year}-12-31`;
      break;
    }
    case 'custom': {
      start = filter.startDate || '1900-01-01';
      end = filter.endDate || '2999-12-31';
      break;
    }
  }
  return d >= start && d <= end;
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Determines whether an Interest Adjustment reduces principal balance (e.g. T005).
 */
export function isPrincipalReductionAdjustment(tx: Transaction): boolean {
  if (tx.transactionType !== 'Interest Adjustment') return false;
  if (typeof tx.reducesPrincipal === 'boolean') return tx.reducesPrincipal;
  const text = `${tx.description} ${tx.notes}`.toLowerCase();
  return text.includes('reduction in balance') || text.includes('deduction from balance');
}

/**
 * Computes consistent financial summary for a single person.
 * Strictly separates Principal Outstanding from Interest Earned & Interest Outstanding.
 * Never counts unpaid scheduled EMI installments as repayments.
 */
export function computePersonSummary(
  person: Person,
  allTransactions: Transaction[],
  allEmiPlans: EMIPlan[],
  allInstallments: EMIInstallment[],
  settings: AppSettings,
  displayCurrency: CurrencyCode = settings.defaultCurrency,
  todayISO: string = getTodayISO()
): PersonFinancialSummary {
  const activeTx = allTransactions.filter(
    (t) => t.personId === person.id && t.status === 'Active'
  );

  const rates = settings.exchangeRatesToINR || DEFAULT_EXCHANGE_RATES_TO_INR;

  const totalLentByCurrency: Record<string, number> = {};
  const principalRepaidByCurrency: Record<string, number> = {};
  const principalReductionByCurrency: Record<string, number> = {};
  const interestEarnedByCurrency: Record<string, number> = {};
  const interestPaidByCurrency: Record<string, number> = {};

  let totalLentDisplay = 0;
  let totalRepaidDisplay = 0;
  let principalReductionDisplay = 0;
  let interestEarnedDisplay = 0;
  let interestPaidDisplay = 0;
  let hasReconciliationNote = false;

  for (const tx of activeTx) {
    const cur = tx.currency || person.defaultCurrency || 'INR';
    const amt = Number(tx.amount) || 0;
    const converted = convertCurrency(amt, cur, displayCurrency, rates);

    if (
      tx.notes.toLowerCase().includes('reconcile') ||
      tx.notes.toLowerCase().includes('double-counting')
    ) {
      hasReconciliationNote = true;
    }

    switch (tx.transactionType) {
      case 'Lending': {
        totalLentByCurrency[cur] = roundCurrency((totalLentByCurrency[cur] || 0) + amt);
        totalLentDisplay += converted;
        break;
      }
      case 'Repayment': {
        principalRepaidByCurrency[cur] = roundCurrency((principalRepaidByCurrency[cur] || 0) + amt);
        totalRepaidDisplay += converted;
        break;
      }
      case 'Interest Adjustment': {
        if (isPrincipalReductionAdjustment(tx)) {
          principalReductionByCurrency[cur] = roundCurrency(
            (principalReductionByCurrency[cur] || 0) + amt
          );
          principalReductionDisplay += converted;
        } else {
          interestPaidByCurrency[cur] = roundCurrency((interestPaidByCurrency[cur] || 0) + amt);
          interestPaidDisplay += converted;
        }
        break;
      }
      case 'Interest Earned': {
        interestEarnedByCurrency[cur] = roundCurrency((interestEarnedByCurrency[cur] || 0) + amt);
        interestEarnedDisplay += converted;
        break;
      }
      case 'Fee': {
        // Fees increase receivable unless marked otherwise
        totalLentByCurrency[cur] = roundCurrency((totalLentByCurrency[cur] || 0) + amt);
        totalLentDisplay += converted;
        break;
      }
      case 'Other Adjustment': {
        principalReductionByCurrency[cur] = roundCurrency(
          (principalReductionByCurrency[cur] || 0) + amt
        );
        principalReductionDisplay += converted;
        break;
      }
    }
  }

  const principalOutstandingByCurrency: Record<string, number> = {};
  const currencies = new Set([
    ...Object.keys(totalLentByCurrency),
    ...Object.keys(principalRepaidByCurrency),
    ...Object.keys(principalReductionByCurrency),
  ]);

  for (const cur of currencies) {
    const lent = totalLentByCurrency[cur] || 0;
    const repaid = principalRepaidByCurrency[cur] || 0;
    const reduced = principalReductionByCurrency[cur] || 0;
    principalOutstandingByCurrency[cur] = roundCurrency(Math.max(0, lent - repaid - reduced));
  }

  const principalOutstandingDisplay = roundCurrency(
    Math.max(0, totalLentDisplay - totalRepaidDisplay - principalReductionDisplay)
  );
  const interestOutstandingDisplay = roundCurrency(
    Math.max(0, interestEarnedDisplay - interestPaidDisplay)
  );

  // EMI Status
  const personPlans = allEmiPlans.filter(
    (p) => p.personId === person.id && p.status !== 'Cancelled'
  );
  const activePlans = personPlans.filter((p) => p.status === 'Active');
  const personInstallments = allInstallments
    .filter((i) => i.personId === person.id)
    .map((i) => ({ ...i, status: computeInstallmentStatus(i, todayISO) }));

  const pendingOrOverdue = personInstallments
    .filter((i) => i.status === 'Pending' || i.status === 'Partially Paid' || i.status === 'Overdue')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const nextInstallment = pendingOrOverdue[0] || null;
  const hasOverdue = pendingOrOverdue.some((i) => i.status === 'Overdue');
  const hasDueToday = pendingOrOverdue.some((i) => i.dueDate === todayISO);

  let emiStatusSummary: PersonFinancialSummary['emiStatusSummary'] = 'No EMI';
  if (personPlans.length > 0) {
    if (hasOverdue) emiStatusSummary = 'Overdue';
    else if (hasDueToday) emiStatusSummary = 'Due Today';
    else if (pendingOrOverdue.length > 0) emiStatusSummary = 'On Track';
    else emiStatusSummary = 'Completed';
  }

  return {
    person,
    totalLentDisplay: roundCurrency(totalLentDisplay),
    totalRepaidDisplay: roundCurrency(totalRepaidDisplay),
    principalOutstandingDisplay,
    interestEarnedDisplay: roundCurrency(interestEarnedDisplay),
    interestOutstandingDisplay,
    totalLentByCurrency,
    principalOutstandingByCurrency,
    activeEmiPlansCount: activePlans.length,
    nextEmiDueDate: nextInstallment ? nextInstallment.dueDate : null,
    nextEmiAmount: nextInstallment ? nextInstallment.remainingAmount : null,
    nextEmiCurrency: nextInstallment ? nextInstallment.currency : null,
    emiStatusSummary,
    hasReconciliationNote,
  };
}

/**
 * Generates fixed or initial flexible EMI installment schedule.
 * Final installment is automatically adjusted if principal / installment division leaves a remainder.
 */
export function generateEMIScheduleItems(
  plan: Omit<EMIPlan, 'id' | 'createdAt' | 'updatedAt'> & { id: string },
  customAmounts?: { dueDate: string; amount: number }[]
): EMIInstallment[] {
  const now = new Date().toISOString();
  const count = Math.max(1, Math.floor(plan.numberOfInstallments));

  if (plan.planType === 'Flexible' && customAmounts && customAmounts.length > 0) {
    return customAmounts.map((item, idx) => {
      const amt = roundCurrency(Math.max(0, item.amount));
      const status = computeInstallmentStatus({
        scheduledAmount: amt,
        paidAmount: 0,
        dueDate: item.dueDate,
        status: 'Pending',
      });
      return {
        id: `${plan.id}-I${String(idx + 1).padStart(2, '0')}`,
        emiPlanId: plan.id,
        personId: plan.personId,
        personName: plan.personName,
        installmentNumber: idx + 1,
        dueDate: item.dueDate,
        scheduledAmount: amt,
        paidAmount: 0,
        remainingAmount: amt,
        currency: plan.currency,
        status,
        linkedTransactionIds: [],
        notes: '',
        customFields: {},
        createdAt: now,
        updatedAt: now,
      };
    });
  }

  const totalTarget = roundCurrency(
    plan.totalPrincipal + (plan.interestRateOrAmount || 0) + (plan.processingFee || 0)
  );
  const baseAmount =
    plan.installmentAmount > 0
      ? roundCurrency(plan.installmentAmount)
      : roundCurrency(totalTarget / count);

  const items: EMIInstallment[] = [];
  let runningAllocated = 0;

  for (let i = 0; i < count; i++) {
    const dueDate = addFrequencyToDate(
      plan.firstDueDate || plan.startDate,
      i,
      plan.frequency,
      plan.customIntervalDays,
      plan.dueDay
    );

    let scheduledAmount = baseAmount;
    if (i === count - 1 && totalTarget > 0) {
      const remainder = roundCurrency(totalTarget - runningAllocated);
      if (remainder > 0 && Math.abs(remainder - baseAmount) < baseAmount * 1.5) {
        scheduledAmount = remainder;
      }
    }
    runningAllocated = roundCurrency(runningAllocated + scheduledAmount);

    const status = computeInstallmentStatus({
      scheduledAmount,
      paidAmount: 0,
      dueDate,
      status: 'Pending',
    });

    items.push({
      id: `${plan.id}-I${String(i + 1).padStart(2, '0')}`,
      emiPlanId: plan.id,
      personId: plan.personId,
      personName: plan.personName,
      installmentNumber: i + 1,
      dueDate,
      scheduledAmount,
      paidAmount: 0,
      remainingAmount: scheduledAmount,
      currency: plan.currency,
      status,
      linkedTransactionIds: [],
      notes: '',
      customFields: {},
      createdAt: now,
      updatedAt: now,
    });
  }

  return items;
}

export function addFrequencyToDate(
  startIso: string,
  steps: number,
  frequency: EMIPlan['frequency'],
  customIntervalDays = 30,
  dueDay?: number
): string {
  const base = new Date(`${(startIso || getTodayISO()).slice(0, 10)}T00:00:00`);
  if (steps === 0) return toISODate(base);

  if (frequency === 'Weekly') {
    base.setDate(base.getDate() + steps * 7);
    return toISODate(base);
  }
  if (frequency === 'Biweekly') {
    base.setDate(base.getDate() + steps * 14);
    return toISODate(base);
  }
  if (frequency === 'Custom') {
    base.setDate(base.getDate() + steps * Math.max(1, customIntervalDays));
    return toISODate(base);
  }

  const monthsPerStep = frequency === 'Quarterly' ? 3 : 1;
  const targetMonth = base.getMonth() + steps * monthsPerStep;
  const targetYear = base.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const desiredDay = dueDay && dueDay >= 1 && dueDay <= 31 ? dueDay : base.getDate();
  const maxDaysInMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const safeDay = Math.min(desiredDay, maxDaysInMonth);
  return toISODate(new Date(targetYear, normalizedMonth, safeDay));
}

export type AdvanceAllocationStrategy = 'current_first' | 'oldest_pending' | 'custom';

export function allocateAdvancePayment(
  planInstallments: EMIInstallment[],
  targetInstallmentId: string,
  paymentAmount: number,
  strategy: AdvanceAllocationStrategy,
  customAllocations?: Record<string, number>
): { installmentId: string; appliedAmount: number }[] {
  const unpaid = planInstallments
    .filter((i) => i.remainingAmount > 0.01 && i.status !== 'Skipped' && i.status !== 'Cancelled' as never)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (strategy === 'custom' && customAllocations) {
    return Object.entries(customAllocations)
      .filter(([, amt]) => amt > 0)
      .map(([installmentId, appliedAmount]) => ({
        installmentId,
        appliedAmount: roundCurrency(appliedAmount),
      }));
  }

  let ordered: EMIInstallment[];
  if (strategy === 'current_first') {
    const target = unpaid.find((i) => i.id === targetInstallmentId);
    const others = unpaid.filter((i) => i.id !== targetInstallmentId);
    ordered = target ? [target, ...others] : unpaid;
  } else {
    ordered = unpaid;
  }

  let left = roundCurrency(paymentAmount);
  const allocations: { installmentId: string; appliedAmount: number }[] = [];

  for (const inst of ordered) {
    if (left <= 0.009) break;
    const apply = roundCurrency(Math.min(left, inst.remainingAmount));
    if (apply > 0) {
      allocations.push({ installmentId: inst.id, appliedAmount: apply });
      left = roundCurrency(left - apply);
    }
  }

  return allocations;
}

export function computeInvestmentMetrics(
  investments: Investment[],
  displayCurrency: CurrencyCode,
  exchangeRatesToINR: Record<string, number>
) {
  const active = investments.filter((i) => i.status !== 'Archived');
  let totalInvested = 0;
  let totalCurrentValue = 0;
  let valuedCount = 0;

  for (const inv of active) {
    const investedConv = convertCurrency(
      inv.amountInvested,
      inv.currency,
      displayCurrency,
      exchangeRatesToINR
    );
    totalInvested += investedConv;

    // Do not assume an investment has gained value if current valuation is missing
    if (inv.currentValue !== null && inv.currentValue !== undefined && Number.isFinite(inv.currentValue)) {
      valuedCount++;
      totalCurrentValue += convertCurrency(
        inv.currentValue,
        inv.currentValueCurrency || inv.currency,
        displayCurrency,
        exchangeRatesToINR
      );
    } else {
      totalCurrentValue += investedConv;
    }
  }

  const profitLoss = roundCurrency(totalCurrentValue - totalInvested);
  return {
    count: active.length,
    valuedCount,
    totalInvested: roundCurrency(totalInvested),
    totalCurrentValue: roundCurrency(totalCurrentValue),
    profitLoss,
    returnPct: totalInvested > 0 ? roundCurrency((profitLoss / totalInvested) * 100) : 0,
  };
}

export function computeDebtMetrics(
  debts: Debt[],
  displayCurrency: CurrencyCode,
  exchangeRatesToINR: Record<string, number>
) {
  const active = debts.filter((d) => d.status !== 'Archived');
  let totalLiabilities = 0;
  let totalPaid = 0;
  let remainingLiabilities = 0;

  for (const d of active) {
    const amt = convertCurrency(d.amount, d.currency, displayCurrency, exchangeRatesToINR);
    const paid = convertCurrency(d.amountPaid, d.currency, displayCurrency, exchangeRatesToINR);
    const rem = Math.max(0, amt - paid);
    totalLiabilities += amt;
    totalPaid += paid;
    remainingLiabilities += rem;
  }

  return {
    count: active.length,
    totalLiabilities: roundCurrency(totalLiabilities),
    totalPaid: roundCurrency(totalPaid),
    remainingLiabilities: roundCurrency(remainingLiabilities),
  };
}

export function computeMonthlyEMISummary(
  installments: EMIInstallment[],
  monthYYYYMM: string,
  displayCurrency: CurrencyCode,
  exchangeRatesToINR: Record<string, number>,
  todayISO: string = getTodayISO()
) {
  const inMonth = installments
    .filter((i) => i.dueDate && i.dueDate.startsWith(monthYYYYMM) && i.status !== 'Skipped' && i.status !== 'Rescheduled')
    .map((i) => ({ ...i, status: computeInstallmentStatus(i, todayISO) }));

  let expected = 0;
  let collected = 0;
  let partiallyCollected = 0;
  let pending = 0;
  let overdue = 0;

  for (const inst of inMonth) {
    const sched = convertCurrency(inst.scheduledAmount, inst.currency, displayCurrency, exchangeRatesToINR);
    const paid = convertCurrency(inst.paidAmount, inst.currency, displayCurrency, exchangeRatesToINR);
    const rem = Math.max(0, sched - paid);

    expected += sched;
    collected += paid;
    if (inst.status === 'Partially Paid') {
      partiallyCollected += paid;
      pending += rem;
    } else if (inst.status === 'Overdue') {
      overdue += rem;
    } else if (inst.status === 'Pending') {
      pending += rem;
    }
  }

  const collectionPercentage = expected > 0 ? roundCurrency((collected / expected) * 100) : 0;

  return {
    month: monthYYYYMM,
    totalCount: inMonth.length,
    expected: roundCurrency(expected),
    collected: roundCurrency(collected),
    partiallyCollected: roundCurrency(partiallyCollected),
    pending: roundCurrency(pending),
    overdue: roundCurrency(overdue),
    collectionPercentage,
  };
}

export function computeDashboardSummary(
  dataset: FinanceDataset,
  displayCurrency: CurrencyCode,
  dateFilter: DateRangeFilter,
  todayISO: string = getTodayISO()
) {
  const rates = dataset.settings.exchangeRatesToINR || DEFAULT_EXCHANGE_RATES_TO_INR;
  const activePeople = dataset.people.filter((p) => p.status !== 'Archived');

  const personSummaries = activePeople.map((person) =>
    computePersonSummary(
      person,
      dataset.transactions,
      dataset.emiPlans,
      dataset.emiSchedule,
      dataset.settings,
      displayCurrency,
      todayISO
    )
  );

  const totalReceivablesDisplay = roundCurrency(
    personSummaries.reduce((acc, p) => acc + p.principalOutstandingDisplay, 0)
  );

  // Separate INR and USD lending breakdown (preserving original currencies!)
  let inrReceivablesNative = 0;
  let usdReceivablesNative = 0;
  let usdAccountCount = 0;
  let inrAccountCount = 0;

  for (const ps of personSummaries) {
    const inrBal = ps.principalOutstandingByCurrency['INR'] || 0;
    const usdBal = ps.principalOutstandingByCurrency['USD'] || 0;
    if (inrBal > 0) {
      inrReceivablesNative += inrBal;
      inrAccountCount++;
    }
    if (usdBal > 0) {
      usdReceivablesNative += usdBal;
      usdAccountCount++;
    }
  }

  const investmentMetrics = computeInvestmentMetrics(dataset.investments, displayCurrency, rates);
  const debtMetrics = computeDebtMetrics(dataset.debts, displayCurrency, rates);

  const currentMonth = todayISO.slice(0, 7);
  const emiSummary = computeMonthlyEMISummary(
    dataset.emiSchedule,
    currentMonth,
    displayCurrency,
    rates,
    todayISO
  );

  const upcomingInstallments = dataset.emiSchedule
    .map((i) => ({ ...i, status: computeInstallmentStatus(i, todayISO) }))
    .filter((i) => i.status === 'Pending' || i.status === 'Partially Paid' || i.status === 'Overdue')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  const filteredTransactions = dataset.transactions
    .filter((t) => t.status === 'Active' && isDateInRange(t.date, dateFilter, todayISO))
    .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));

  const recentActivity = (filteredTransactions.length > 0
    ? filteredTransactions
    : dataset.transactions.filter((t) => t.status === 'Active')
  ).slice(0, 8);

  const activeEmiPlansCount = dataset.emiPlans.filter((p) => p.status === 'Active').length;

  return {
    totalReceivablesDisplay,
    inrReceivablesNative: roundCurrency(inrReceivablesNative),
    inrAccountCount,
    usdReceivablesNative: roundCurrency(usdReceivablesNative),
    usdAccountCount,
    peopleCount: activePeople.length,
    activeEmiPlansCount,
    investmentMetrics,
    debtMetrics,
    emiSummary,
    upcomingInstallments,
    recentActivity,
    personSummaries,
    exchangeRateUSDToINR: rates.USD || 84.5,
  };
}

const GENERIC_EMI_PLACEHOLDER_REGEX = /existing\s+emi\s+plan\s*[-–—:]?\s*complete\s+details/i;

export function isGenericEMIPlanPlaceholder(value?: string | null): boolean {
  if (!value) return false;
  return GENERIC_EMI_PLACEHOLDER_REGEX.test(value);
}

export function getEMIPlanDisplayName(
  plan: EMIPlan | undefined | null,
  transactions: Transaction[] = [],
  installments: EMIInstallment[] = []
): string {
  if (!plan) return 'EMI Plan';
  const rawName = (plan.planName || '').trim();
  if (rawName && !isGenericEMIPlanPlaceholder(rawName)) {
    return rawName;
  }

  const linkedTxIds = new Set<string>();
  for (const inst of installments) {
    if (inst.emiPlanId === plan.id && Array.isArray(inst.linkedTransactionIds)) {
      inst.linkedTransactionIds.forEach((id) => linkedTxIds.add(id));
    }
  }

  const candidateTx = transactions.find(
    (t) =>
      t.status !== 'Archived' &&
      (t.emiPlanId === plan.id || linkedTxIds.has(t.id)) &&
      t.description &&
      !isGenericEMIPlanPlaceholder(t.description)
  );
  if (candidateTx) {
    return candidateTx.description.trim();
  }

  const personEmiTx = transactions.find(
    (t) =>
      t.status !== 'Archived' &&
      t.personId === plan.personId &&
      t.transactionMode === 'EMI' &&
      t.description &&
      !isGenericEMIPlanPlaceholder(t.description)
  );
  if (personEmiTx) {
    return personEmiTx.description.trim();
  }

  return `${plan.frequency || ''} EMI Plan`.trim();
}

export function getTransactionDisplayTitle(
  tx: Transaction,
  emiPlans: EMIPlan[] = [],
  emiSchedule: EMIInstallment[] = [],
  allTransactions: Transaction[] = []
): string {
  const rawDesc = (tx.description || '').trim();

  if (rawDesc && !isGenericEMIPlanPlaceholder(rawDesc)) {
    return rawDesc;
  }

  const stripped = rawDesc
    .replace(GENERIC_EMI_PLACEHOLDER_REGEX, '')
    .replace(/^[\s·\-–—:]+/, '')
    .replace(/[\s·\-–—:]+$/, '')
    .trim();

  const linkedPlan = tx.emiPlanId
    ? emiPlans.find((p) => p.id === tx.emiPlanId)
    : undefined;
  const resolvedPlanName = linkedPlan
    ? getEMIPlanDisplayName(linkedPlan, allTransactions, emiSchedule)
    : '';
  const hasSpecificPlanName =
    Boolean(resolvedPlanName) &&
    !isGenericEMIPlanPlaceholder(resolvedPlanName) &&
    resolvedPlanName !== `${linkedPlan?.frequency || ''} EMI Plan`.trim();

  const linkedInst = tx.emiInstallmentId
    ? emiSchedule.find((i) => i.id === tx.emiInstallmentId)
    : undefined;

  const baseLabel =
    (hasSpecificPlanName ? resolvedPlanName : '') ||
    (tx.category && !isGenericEMIPlanPlaceholder(tx.category) ? tx.category.trim() : '') ||
    tx.transactionType;

  if (stripped) {
    return baseLabel && !stripped.toLowerCase().includes(baseLabel.toLowerCase())
      ? `${baseLabel} · ${stripped}`
      : stripped;
  }

  if (linkedInst) {
    return `${baseLabel} · Installment #${linkedInst.installmentNumber}`;
  }

  return baseLabel || tx.transactionType;
}
