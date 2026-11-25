import React, { useMemo, useState } from 'react';
import {
  BellRing,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  List,
  PieChart,
  Plus,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { EMIInstallment, EMIPlan } from '../types/finance';
import {
  computeInstallmentStatus,
  computeMonthlyEMISummary,
  formatCurrency,
  formatDateDisplay,
  getEMIPlanDisplayName,
  getTodayISO,
} from '../utils/calculations';

interface EMITrackerPageProps {
  onCreatePlan: () => void;
  onPayInstallment: (inst: EMIInstallment) => void;
  onViewSchedule: (plan: EMIPlan) => void;
}

type TrackerView = 'calendar' | 'list' | 'summary';
type ListFilter = 'all' | 'upcoming' | 'due_today' | 'Pending' | 'Partially Paid' | 'Overdue' | 'Paid';

export const EMITrackerPage: React.FC<EMITrackerPageProps> = ({
  onCreatePlan,
  onPayInstallment,
  onViewSchedule,
}) => {
  const { dataset, displayCurrency } = useFinance();
  const todayISO = getTodayISO();

  const [view, setView] = useState<TrackerView>('calendar');
  const [monthCursor, setMonthCursor] = useState(() => todayISO.slice(0, 7)); // YYYY-MM
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const allInstallments = useMemo(
    () =>
      dataset.emiSchedule
        .map((i) => ({ ...i, status: computeInstallmentStatus(i, todayISO) }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [dataset.emiSchedule, todayISO]
  );

  const monthSummary = useMemo(
    () =>
      computeMonthlyEMISummary(
        dataset.emiSchedule,
        monthCursor,
        displayCurrency,
        dataset.settings.exchangeRatesToINR,
        todayISO
      ),
    [dataset.emiSchedule, monthCursor, displayCurrency, dataset.settings.exchangeRatesToINR, todayISO]
  );

  const reminders = useMemo(() => {
    const overdue = allInstallments.filter((i) => i.status === 'Overdue');
    const dueToday = allInstallments.filter(
      (i) => i.dueDate === todayISO && i.remainingAmount > 0.01
    );
    const upcomingSoon = allInstallments.filter((i) => {
      if (i.remainingAmount <= 0.01 || i.dueDate <= todayISO) return false;
      const diff =
        (new Date(`${i.dueDate}T00:00:00`).getTime() -
          new Date(`${todayISO}T00:00:00`).getTime()) /
        (1000 * 3600 * 24);
      return diff <= 7;
    });
    return { overdue, dueToday, upcomingSoon };
  }, [allInstallments, todayISO]);

  // Calendar grid computation
  const [yearNum, monthNum] = monthCursor.split('-').map(Number);
  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(yearNum, monthNum - 1, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${monthCursor}-${String(d).padStart(2, '0')}`);
    }
    return cells;
  }, [yearNum, monthNum, monthCursor]);

  const byDateMap = useMemo(() => {
    const map = new Map<string, EMIInstallment[]>();
    for (const inst of allInstallments) {
      if (!inst.dueDate) continue;
      const list = map.get(inst.dueDate) || [];
      list.push(inst);
      map.set(inst.dueDate, list);
    }
    return map;
  }, [allInstallments]);

  const selectedDateInstallments = byDateMap.get(selectedDate) || [];

  const listFiltered = useMemo(() => {
    return allInstallments.filter((i) => {
      if (dateFrom && i.dueDate < dateFrom) return false;
      if (dateTo && i.dueDate > dateTo) return false;
      switch (listFilter) {
        case 'upcoming':
          return i.dueDate >= todayISO && i.remainingAmount > 0.01;
        case 'due_today':
          return i.dueDate === todayISO && i.remainingAmount > 0.01;
        case 'Pending':
        case 'Partially Paid':
        case 'Overdue':
        case 'Paid':
          return i.status === listFilter;
        default:
          return true;
      }
    });
  }, [allInstallments, listFilter, dateFrom, dateTo, todayISO]);

  const shiftMonth = (delta: number) => {
    const d = new Date(yearNum, monthNum - 1 + delta, 1);
    setMonthCursor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthLabel = new Date(yearNum, monthNum - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const numFmt = dataset.settings.numberFormat;

  const statusColorDot: Record<string, string> = {
    Paid: 'bg-[#16A34A]',
    Pending: 'bg-[#3B82F6]',
    'Partially Paid': 'bg-[#F59E0B]',
    Overdue: 'bg-[#DC2626]',
    Skipped: 'bg-[#747B8A]',
    Rescheduled: 'bg-[#747B8A]',
  };

  const statusTextColor: Record<string, string> = {
    Paid: 'text-[#16A34A]',
    Pending: 'text-[#3B82F6]',
    'Partially Paid': 'text-[#F59E0B]',
    Overdue: 'text-[#DC2626]',
    Skipped: 'text-[#747B8A]',
    Rescheduled: 'text-[#747B8A]',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-[#171A22] dark:text-[#F8FAFC]">
              EMI Tracker
            </h2>
            <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF]">
              {dataset.emiPlans.filter((p) => p.status === 'Active').length} active plans ·{' '}
              {allInstallments.length} scheduled installments
            </p>
          </div>

          <div className="inline-flex self-start sm:self-auto p-1 rounded-full bg-[#EEF1F6]/90 dark:bg-[#161920] border border-[#E7EAF0] dark:border-[#30343D]">
            {(
              [
                { id: 'calendar', label: 'Calendar', icon: <CalendarDays className="w-3.5 h-3.5" /> },
                { id: 'list', label: 'List', icon: <List className="w-3.5 h-3.5" /> },
                { id: 'summary', label: 'Summary', icon: <PieChart className="w-3.5 h-3.5" /> },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setView(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition ${
                  view === t.id
                    ? 'bg-white dark:bg-[#232732] text-[#171A22] dark:text-[#F8FAFC] font-semibold shadow-xs'
                    : 'text-[#747B8A] dark:text-[#9CA3AF] font-medium hover:text-[#171A22] dark:hover:text-[#F8FAFC]'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onCreatePlan}
          className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-semibold text-white shadow-xs hover:opacity-95 active:scale-[0.99] transition"
        >
          <Plus className="w-4 h-4" />
          <span>New EMI Plan</span>
        </button>
      </div>

      {/* In-app EMI Reminders Banner (only when real overdue/due today exist) */}
      {(reminders.overdue.length > 0 || reminders.dueToday.length > 0 || reminders.upcomingSoon.length > 0) && (
        <div className="rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <BellRing className="w-4 h-4 text-[#1677FF] shrink-0" />
            <span className="font-medium text-[#171A22] dark:text-[#F8FAFC]">
              In-app EMI reminders:
            </span>
            {reminders.overdue.length > 0 && (
              <span className="font-semibold text-[#DC2626]">
                {reminders.overdue.length} overdue
              </span>
            )}
            {reminders.dueToday.length > 0 && (
              <span className="font-semibold text-[#F59E0B]">
                {reminders.dueToday.length} due today
              </span>
            )}
            {reminders.upcomingSoon.length > 0 && (
              <span className="font-semibold text-[#3B82F6]">
                {reminders.upcomingSoon.length} due in next 7 days
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setView('list');
              setListFilter(reminders.overdue.length > 0 ? 'Overdue' : 'upcoming');
            }}
            className="text-xs font-semibold text-[#1677FF] hover:underline"
          >
            Review due installments
          </button>
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="p-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-[#747B8A] hover:text-[#171A22] dark:hover:text-white"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="text-base font-semibold text-[#171A22] dark:text-[#F8FAFC]">
                {monthLabel}
              </h3>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="p-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-[#747B8A] hover:text-[#171A22] dark:hover:text-white"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#747B8A]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((iso, idx) => {
                if (!iso) return <div key={`empty-${idx}`} className="h-12" />;
                const dayNum = Number(iso.slice(8, 10));
                const dayInsts = byDateMap.get(iso) || [];
                const isSelected = iso === selectedDate;
                const isToday = iso === todayISO;

                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelectedDate(iso)}
                    className={`h-12 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                      isSelected
                        ? 'border-[#1677FF] bg-[#1677FF]/10 text-[#1677FF]'
                        : isToday
                        ? 'border-[#38BDF8] bg-[#F7F8FA] dark:bg-[#101216]'
                        : 'border-transparent hover:bg-[#F7F8FA] dark:hover:bg-[#101216]'
                    }`}
                  >
                    <span className="text-xs font-semibold tabular-nums">{dayNum}</span>
                    {dayInsts.length > 0 && (
                      <div className="flex items-center gap-0.5">
                        {dayInsts.slice(0, 4).map((inst, idx) => (
                          <span
                            key={`${inst.id || 'inst'}-${idx}`}
                            className={`h-1.5 w-1.5 rounded-full ${
                              statusColorDot[inst.status] || 'bg-[#3B82F6]'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-[#E7EAF0] dark:border-[#30343D] flex flex-wrap items-center gap-4 text-[11px] text-[#747B8A]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#16A34A]" /> Paid
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#3B82F6]" /> Pending
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> Partially Paid
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#DC2626]" /> Overdue
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#747B8A]" /> Skipped
              </span>
            </div>
          </div>

          {/* Selected Date Details */}
          <div className="lg:col-span-5 rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-semibold text-[#171A22] dark:text-[#F8FAFC]">
                Due on {formatDateDisplay(selectedDate, dataset.settings.dateFormat)}
              </h3>
              <p className="text-xs text-[#747B8A]">
                {selectedDateInstallments.length} installment(s)
              </p>
            </div>

            {selectedDateInstallments.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#747B8A]">
                No EMI installments scheduled on this date.
              </div>
            ) : (
              <div className="divide-y divide-[#E7EAF0]/80 dark:divide-[#30343D]/80">
                {selectedDateInstallments.map((inst, idx) => {
                  const plan = dataset.emiPlans.find((p) => p.id === inst.emiPlanId);
                  return (
                    <div key={`${inst.id || 'inst'}-${idx}`} className="py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-6">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="h-10 w-10 rounded-2xl bg-[#1677FF]/10 flex items-center justify-center shrink-0">
                          <CalendarDays className="w-4 h-4 text-[#1677FF]" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] truncate">
                            {inst.personName}
                          </p>
                          <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF] truncate">
                            {getEMIPlanDisplayName(plan, dataset.transactions, dataset.emiSchedule)} · Installment #{inst.installmentNumber}
                          </p>
                          <p className={`text-[11px] font-medium ${statusTextColor[inst.status] || 'text-[#747B8A]'}`}>
                            {inst.status}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 pl-2">
                        <span className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
                          {formatCurrency(inst.remainingAmount || inst.scheduledAmount, inst.currency, numFmt)}
                        </span>
                        {inst.status !== 'Paid' && inst.status !== 'Skipped' && (
                          <button
                            type="button"
                            onClick={() => onPayInstallment(inst)}
                            className="inline-flex items-center gap-1 rounded-xl bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            Pay
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#EEF1F6]/90 dark:bg-[#161920] p-1 border border-[#E7EAF0] dark:border-[#30343D] overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'upcoming', label: 'Upcoming' },
                  { id: 'due_today', label: 'Due Today' },
                  { id: 'Pending', label: 'Pending' },
                  { id: 'Partially Paid', label: 'Partially Paid' },
                  { id: 'Overdue', label: 'Overdue' },
                  { id: 'Paid', label: 'Paid' },
                ] as { id: ListFilter; label: string }[]
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setListFilter(btn.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs transition whitespace-nowrap shrink-0 ${
                    listFilter === btn.id
                      ? 'bg-white dark:bg-[#232732] text-[#171A22] dark:text-[#F8FAFC] font-semibold shadow-xs'
                      : 'text-[#747B8A] dark:text-[#9CA3AF] font-medium hover:text-[#171A22] dark:hover:text-[#F8FAFC]'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-full bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30"
              />
              <span className="text-[#747B8A]">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-full bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30"
              />
            </div>
          </div>

          <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-6 shadow-xs">
            {listFiltered.length === 0 ? (
              <p className="py-10 text-center text-xs text-[#747B8A]">
                No EMI installments match this filter.
              </p>
            ) : (
              <div className="divide-y divide-[#E7EAF0]/80 dark:divide-[#30343D]/80">
                {listFiltered.map((inst, idx) => {
                  const plan = dataset.emiPlans.find((p) => p.id === inst.emiPlanId);
                  return (
                    <div
                      key={`${inst.id || 'inst'}-${idx}`}
                      className="py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-6"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                            inst.status === 'Overdue'
                              ? 'bg-[#DC2626]/10'
                              : inst.status === 'Paid'
                              ? 'bg-[#16A34A]/10'
                              : inst.status === 'Partially Paid'
                              ? 'bg-[#F59E0B]/12'
                              : 'bg-[#1677FF]/10'
                          }`}
                        >
                          <CalendarDays
                            className={`w-4 h-4 ${statusTextColor[inst.status] || 'text-[#1677FF]'}`}
                          />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] truncate">
                            {inst.personName}
                          </p>
                          <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF] truncate">
                            {getEMIPlanDisplayName(plan, dataset.transactions, dataset.emiSchedule)} · Installment #{inst.installmentNumber}
                          </p>
                          <p
                            className={`text-[11px] font-medium ${
                              inst.status === 'Overdue'
                                ? 'text-[#DC2626]'
                                : inst.status === 'Partially Paid'
                                ? 'text-[#F59E0B]'
                                : inst.status === 'Paid'
                                ? 'text-[#16A34A]'
                                : 'text-[#747B8A]/90 dark:text-[#9CA3AF]/80'
                            }`}
                          >
                            Due {formatDateDisplay(inst.dueDate, dataset.settings.dateFormat)}
                            {inst.status !== 'Pending' ? ` · ${inst.status}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 pl-2">
                        <span className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
                          {formatCurrency(
                            inst.remainingAmount > 0 ? inst.remainingAmount : inst.scheduledAmount,
                            inst.currency,
                            numFmt
                          )}
                        </span>
                        {inst.status !== 'Paid' && inst.status !== 'Skipped' && (
                          <button
                            type="button"
                            onClick={() => onPayInstallment(inst)}
                            className="px-3.5 py-1.5 rounded-xl bg-brand-gradient text-xs font-semibold text-white hover:opacity-95 transition"
                          >
                            Pay
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary View */}
      {view === 'summary' && (
        <div className="space-y-4">
          <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#171A22] dark:text-[#F8FAFC]">
                  Monthly Collection Summary ({monthLabel})
                </h3>
                <p className="text-xs text-[#747B8A]">
                  Calculated in {displayCurrency} using configured exchange rates
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="p-1.5 rounded-lg border border-[#E7EAF0] dark:border-[#30343D]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="p-1.5 rounded-lg border border-[#E7EAF0] dark:border-[#30343D]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="h-3 rounded-full bg-[#F7F8FA] dark:bg-[#101216] overflow-hidden">
              <div
                className="h-full bg-brand-gradient rounded-full transition-all"
                style={{ width: `${Math.min(100, monthSummary.collectionPercentage)}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div>
                <p className="text-[#747B8A]">Total Expected</p>
                <p className="mt-0.5 text-base font-semibold tabular-nums">
                  {formatCurrency(monthSummary.expected, displayCurrency, numFmt)}
                </p>
              </div>
              <div>
                <p className="text-[#747B8A]">Total Collected</p>
                <p className="mt-0.5 text-base font-semibold text-[#16A34A] tabular-nums">
                  {formatCurrency(monthSummary.collected, displayCurrency, numFmt)}
                </p>
              </div>
              <div>
                <p className="text-[#747B8A]">Partially Collected</p>
                <p className="mt-0.5 text-base font-semibold text-[#F59E0B] tabular-nums">
                  {formatCurrency(monthSummary.partiallyCollected, displayCurrency, numFmt)}
                </p>
              </div>
              <div>
                <p className="text-[#747B8A]">Pending</p>
                <p className="mt-0.5 text-base font-semibold text-[#3B82F6] tabular-nums">
                  {formatCurrency(monthSummary.pending, displayCurrency, numFmt)}
                </p>
              </div>
              <div>
                <p className="text-[#747B8A]">Overdue</p>
                <p className="mt-0.5 text-base font-semibold text-[#DC2626] tabular-nums">
                  {formatCurrency(monthSummary.overdue, displayCurrency, numFmt)}
                </p>
              </div>
              <div>
                <p className="text-[#747B8A]">Collection %</p>
                <p className="mt-0.5 text-base font-semibold text-[#1677FF] tabular-nums">
                  {monthSummary.collectionPercentage}%
                </p>
              </div>
            </div>
          </div>

          {/* All EMI Plans Overview */}
          <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-6 shadow-xs">
            <h3 className="text-base font-semibold text-[#171A22] dark:text-[#F8FAFC] mb-4">
              All EMI Plans
            </h3>
            {dataset.emiPlans.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#747B8A]">
                No EMI plans created yet.
              </p>
            ) : (
              <div className="divide-y divide-[#E7EAF0]/80 dark:divide-[#30343D]/80">
                {dataset.emiPlans.map((plan, idx) => (
                  <div
                    key={`${plan.id || 'plan'}-${idx}`}
                    className="py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-6"
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
                          {plan.personName} · {plan.frequency}
                        </p>
                        <p className="text-[11px] font-medium text-[#747B8A]/90 dark:text-[#9CA3AF]/80">
                          {plan.planType} · {plan.status}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 pl-2">
                      <span className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
                        {formatCurrency(plan.totalPrincipal, plan.currency, numFmt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onViewSchedule(plan)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#1677FF]/10 text-[#1677FF] text-xs font-semibold shrink-0 hover:bg-[#1677FF]/15 transition"
                      >
                        Schedule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
