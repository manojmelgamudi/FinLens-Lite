import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  Landmark,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFinance } from '../context/FinanceContext';
import { EMIInstallment, Transaction } from '../types/finance';
import {
  computeDashboardSummary,
  formatCurrency,
  formatDateDisplay,
  getEMIPlanDisplayName,
  getTransactionDisplayTitle,
} from '../utils/calculations';

interface DashboardPageProps {
  onOpenAddTransaction: () => void;
  onOpenPerson: (personId: string) => void;
  onPayInstallment: (inst: EMIInstallment) => void;
  onNavigateTab: (tab: 'people' | 'emi' | 'transactions' | 'investments' | 'debts') => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenAddTransaction,
  onOpenPerson,
  onPayInstallment,
  onNavigateTab,
}) => {
  const {
    dataset,
    displayCurrency,
    dateFilter,
  } = useFinance();

  const summary = useMemo(
    () => computeDashboardSummary(dataset, displayCurrency, dateFilter),
    [dataset, displayCurrency, dateFilter]
  );

  // Subtle count-up animation for main financial figure
  const [animatedTotal, setAnimatedTotal] = useState(summary.totalReceivablesDisplay);
  useEffect(() => {
    const target = summary.totalReceivablesDisplay;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setAnimatedTotal(target);
      return;
    }
    const startVal = 0;
    const duration = 380;
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedTotal(startVal + (target - startVal) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [summary.totalReceivablesDisplay]);

  const chartData = useMemo(
    () =>
      summary.personSummaries
        .filter((p) => p.principalOutstandingDisplay > 0)
        .sort((a, b) => b.principalOutstandingDisplay - a.principalOutstandingDisplay)
        .map((p, idx) => ({
          keyId: `${p.person.id || 'person'}-${idx}`,
          name: p.person.name || 'Unnamed',
          outstanding: p.principalOutstandingDisplay,
          personId: p.person.id,
        })),
    [summary.personSummaries]
  );

  const chartNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of chartData) {
      map.set(item.keyId, item.name);
    }
    return map;
  }, [chartData]);

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

  const numFmt = dataset.settings.numberFormat;

  return (
    <div className="space-y-6">
      {/* Hero Card: Total Receivables + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-7 rounded-[20px] bg-gradient-to-br from-white via-[#F9FBFF] to-[#F1F7FF] dark:from-[#1A1D24] dark:via-[#1B202B] dark:to-[#182231] border border-[#E7EAF0] dark:border-[#30343D] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <p className="text-sm font-medium text-[#747B8A] dark:text-[#9CA3AF]">
              Total Receivables
            </p>

            <p className="mt-3 text-[34px] sm:text-[38px] font-semibold tracking-tight text-[#171A22] dark:text-[#F8FAFC] tabular-nums leading-tight">
              {formatCurrency(animatedTotal, displayCurrency, numFmt)}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#747B8A] dark:text-[#9CA3AF]">
              <span>{summary.peopleCount} people</span>
              <span aria-hidden="true">·</span>
              <span>{summary.activeEmiPlansCount} active EMI plans</span>
              <span className="text-[#16A34A] font-medium inline-flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Consolidated at live rate
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#E7EAF0] dark:border-[#30343D] grid grid-cols-2 sm:grid-cols-3 gap-4 items-center text-xs">
            <div>
              <p className="text-[#747B8A] dark:text-[#9CA3AF]">INR Receivables</p>
              <p className="mt-0.5 text-base font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
                {formatCurrency(summary.inrReceivablesNative, 'INR', numFmt)}
              </p>
            </div>
            <div>
              <p className="text-[#747B8A] dark:text-[#9CA3AF]">USD Receivables</p>
              <p className="mt-0.5 text-base font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
                {formatCurrency(summary.usdReceivablesNative, 'USD', 'en-US')}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <button
                type="button"
                onClick={onOpenAddTransaction}
                className="w-full h-11 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-gradient px-4 text-xs font-semibold text-white shadow-xs hover:opacity-95 active:scale-[0.98] transition whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Add New Entry</span>
              </button>
            </div>
          </div>
        </div>

        {/* Person Receivables Distribution Chart */}
        <div className="lg:col-span-5 rounded-[20px] bg-gradient-to-br from-white via-[#F9FCFF] to-[#F2F9FF] dark:from-[#1A1D24] dark:via-[#1B2029] dark:to-[#18222F] border border-[#E7EAF0] dark:border-[#30343D] p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC]">
              Receivables by Person
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('people')}
              className="text-xs font-medium text-[#1677FF] hover:underline"
            >
              View all
            </button>
          </div>

          {chartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-8 text-xs text-[#747B8A]">
              No outstanding balances yet.
            </div>
          ) : (
            <div className="h-48 w-full overflow-x-auto">
              <div
                className="h-full"
                style={{
                  minWidth: chartData.length > 4 ? `${chartData.length * 72}px` : '100%',
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                    <XAxis
                      dataKey="keyId"
                      interval={0}
                      tickMargin={8}
                      padding={{ left: 8, right: 8 }}
                      tickFormatter={(val) => {
                        const full = chartNameByKey.get(String(val)) || String(val);
                        if (full.length <= 10) return full;
                        const first = full.split(/\s+/)[0] || full;
                        return first.length <= 10 ? first : `${first.slice(0, 9)}…`;
                      }}
                      tick={{ fontSize: 11, fill: '#747B8A' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#747B8A' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                    />
                    <Tooltip
                      labelFormatter={(val) => chartNameByKey.get(String(val)) || String(val)}
                      formatter={(val: unknown) => [
                        formatCurrency(Number(val) || 0, displayCurrency, numFmt),
                        'Outstanding',
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E7EAF0',
                        fontSize: '12px',
                      }}
                    />
                    <Bar
                      dataKey="outstanding"
                      fill="#1677FF"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={38}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('investments')}
          className="text-left rounded-2xl bg-gradient-to-br from-white via-[#F9FDFB] to-[#F2FBF5] dark:from-[#1A1D24] dark:via-[#1A211F] dark:to-[#172520] border border-[#E7EAF0] dark:border-[#30343D] p-4 shadow-xs hover:border-[#1677FF]/50 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#747B8A] dark:text-[#9CA3AF]">
              Investments
            </span>
            <ChartNoAxesCombined className="w-4 h-4 text-[#16A34A]" />
          </div>
          <p className="mt-2 text-xl font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
            {formatCurrency(summary.investmentMetrics.totalCurrentValue, displayCurrency, numFmt)}
          </p>
          <p className="mt-1 text-xs text-[#747B8A] dark:text-[#9CA3AF]">
            {summary.investmentMetrics.count} holdings · P/L{' '}
            <span
              className={
                summary.investmentMetrics.profitLoss >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
              }
            >
              {formatCurrency(summary.investmentMetrics.profitLoss, displayCurrency, numFmt)}
            </span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('debts')}
          className="text-left rounded-2xl bg-gradient-to-br from-white via-[#FFFBFB] to-[#FEF4F4] dark:from-[#1A1D24] dark:via-[#211C1E] dark:to-[#271C1E] border border-[#E7EAF0] dark:border-[#30343D] p-4 shadow-xs hover:border-[#1677FF]/50 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#747B8A] dark:text-[#9CA3AF]">
              Outstanding Debts
            </span>
            <Landmark className="w-4 h-4 text-[#DC2626]" />
          </div>
          <p className="mt-2 text-xl font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
            {formatCurrency(summary.debtMetrics.remainingLiabilities, displayCurrency, numFmt)}
          </p>
          <p className="mt-1 text-xs text-[#747B8A] dark:text-[#9CA3AF]">
            {summary.debtMetrics.count} active liabilities
          </p>
        </button>
      </div>

      {/* EMI Collections Summary + Upcoming Collections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 rounded-[20px] bg-gradient-to-br from-white via-[#F8FCFF] to-[#F1F8FF] dark:from-[#1A1D24] dark:via-[#1B202A] dark:to-[#182330] border border-[#E7EAF0] dark:border-[#30343D] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#171A22] dark:text-[#F8FAFC]">
                EMI Collections ({summary.emiSummary.month})
              </h3>
              <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF]">
                {summary.emiSummary.collectionPercentage}% collected this month
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('emi')}
              className="text-xs font-medium text-[#1677FF] hover:underline"
            >
              Tracker
            </button>
          </div>

          <div className="h-2.5 w-full rounded-full bg-[#F7F8FA] dark:bg-[#101216] overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all duration-300"
              style={{ width: `${Math.min(100, summary.emiSummary.collectionPercentage)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="py-1.5">
              <p className="text-[#747B8A]">Expected This Month</p>
              <p className="mt-0.5 text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
                {formatCurrency(summary.emiSummary.expected, displayCurrency, numFmt)}
              </p>
            </div>
            <div className="py-1.5">
              <p className="text-[#747B8A]">Collected</p>
              <p className="mt-0.5 text-sm font-semibold text-[#16A34A] tabular-nums">
                {formatCurrency(summary.emiSummary.collected, displayCurrency, numFmt)}
              </p>
            </div>
            <div className="py-1.5">
              <p className="text-[#747B8A]">Partially Collected</p>
              <p className="mt-0.5 text-sm font-semibold text-[#F59E0B] tabular-nums">
                {formatCurrency(summary.emiSummary.partiallyCollected, displayCurrency, numFmt)}
              </p>
            </div>
            <div className="py-1.5">
              <p className="text-[#747B8A]">Pending / Overdue</p>
              <p className="mt-0.5 text-sm font-semibold text-[#DC2626] tabular-nums">
                {formatCurrency(
                  summary.emiSummary.pending + summary.emiSummary.overdue,
                  displayCurrency,
                  numFmt
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Upcoming 5 EMI Installments */}
        <div className="lg:col-span-7 rounded-[20px] bg-gradient-to-br from-white via-[#FAFBFD] to-[#F4F7FC] dark:from-[#1A1D24] dark:via-[#1B1F27] dark:to-[#19202B] border border-[#E7EAF0] dark:border-[#30343D] p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#171A22] dark:text-[#F8FAFC]">
              Upcoming Collections
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('emi')}
              className="text-xs font-medium text-[#1677FF] hover:underline"
            >
              Open Calendar
            </button>
          </div>

          {summary.upcomingInstallments.length === 0 ? (
            <div className="py-10 text-center">
              <CalendarDays className="w-8 h-8 text-[#747B8A]/50 mx-auto mb-2" />
              <p className="text-sm font-medium text-[#171A22] dark:text-[#F8FAFC]">
                No pending EMI installments
              </p>
              <p className="text-xs text-[#747B8A] mt-1">
                Create an EMI plan in EMI Tracker to schedule installments.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E7EAF0]/80 dark:divide-[#30343D]/80">
              {summary.upcomingInstallments.map((inst, idx) => {
                const plan = dataset.emiPlans.find((p) => p.id === inst.emiPlanId);
                return (
                  <div
                    key={`${inst.id || 'inst'}-${idx}`}
                    className="py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-6"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] truncate">
                        {inst.personName}
                      </p>
                      <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF] truncate">
                        {getEMIPlanDisplayName(plan, dataset.transactions, dataset.emiSchedule)}
                      </p>
                      <p
                        className={`text-[11px] font-medium ${
                          inst.status === 'Overdue'
                            ? 'text-[#DC2626]'
                            : inst.status === 'Partially Paid'
                            ? 'text-[#F59E0B]'
                            : 'text-[#747B8A] dark:text-[#9CA3AF]'
                        }`}
                      >
                        Due {formatDateDisplay(inst.dueDate, dataset.settings.dateFormat)}
                        {inst.status !== 'Pending' ? ` · ${inst.status}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
                        {formatCurrency(inst.remainingAmount, inst.currency, numFmt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onPayInstallment(inst)}
                        className="px-3.5 py-1.5 rounded-xl bg-brand-gradient text-xs font-semibold text-white hover:opacity-95 active:scale-[0.98] transition"
                      >
                        Pay
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-[20px] bg-gradient-to-br from-white via-[#FAFBFD] to-[#F5F7FB] dark:from-[#1A1D24] dark:via-[#1B1E25] dark:to-[#191E28] border border-[#E7EAF0] dark:border-[#30343D] p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#171A22] dark:text-[#F8FAFC]">
            Recent Activity
          </h3>
          <button
            type="button"
            onClick={() => onNavigateTab('transactions')}
            className="text-xs font-medium text-[#1677FF] hover:underline"
          >
            All transactions
          </button>
        </div>

        {summary.recentActivity.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#747B8A]">
            No transactions match this filter.
          </p>
        ) : (
          <div className="divide-y divide-[#E7EAF0]/80 dark:divide-[#30343D]/80">
            {summary.recentActivity.map((tx, idx) => {
              const vis = txVisual(tx);
              const txTitle = getTransactionDisplayTitle(
                tx,
                dataset.emiPlans,
                dataset.emiSchedule,
                dataset.transactions
              );
              return (
                <button
                  key={`${tx.id || 'tx'}-${idx}`}
                  type="button"
                  onClick={() => onOpenPerson(tx.personId)}
                  className="w-full py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-6 text-left hover:bg-[#F7F8FA]/60 dark:hover:bg-[#101216]/40 px-3 -mx-3 rounded-2xl transition"
                >
                  <div className="flex items-center gap-4 min-w-0">
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
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <p className={`text-sm font-semibold tabular-nums ${vis.color}`}>
                      {vis.sign}
                      {formatCurrency(tx.amount, tx.currency, numFmt)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
