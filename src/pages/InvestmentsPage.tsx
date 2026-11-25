import React, { useMemo, useState } from 'react';
import { Archive, ChartNoAxesCombined, Edit3, Plus } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useFinance } from '../context/FinanceContext';
import { Investment } from '../types/finance';
import {
  computeInvestmentMetrics,
  convertCurrency,
  formatCurrency,
  formatDateDisplay,
  getTodayISO,
} from '../utils/calculations';
import { BottomSheet } from '../components/common/BottomSheet';
import { CustomFieldsRenderer } from '../components/common/CustomFieldsRenderer';

const CHART_COLORS = ['#1677FF', '#38BDF8', '#16A34A', '#F59E0B', '#6366F1', '#EC4899'];

export const InvestmentsPage: React.FC = () => {
  const { dataset, displayCurrency, performSyncAction } = useFinance();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState(dataset.lists.investmentCategories[0] || 'Business');
  const [investmentDate, setInvestmentDate] = useState(getTodayISO());
  const [amountInvested, setAmountInvested] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [currentValue, setCurrentValue] = useState('');
  const [currentValueCurrency, setCurrentValueCurrency] = useState('INR');
  const [notes, setNotes] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string | number | boolean>>({});
  const [saving, setSaving] = useState(false);

  const rates = dataset.settings.exchangeRatesToINR;
  const numFmt = dataset.settings.numberFormat;

  const metrics = useMemo(
    () => computeInvestmentMetrics(dataset.investments, displayCurrency, rates),
    [dataset.investments, displayCurrency, rates]
  );

  const activeInvestments = dataset.investments.filter((i) => i.status !== 'Archived');

  const allocationData = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const inv of activeInvestments) {
      const val =
        inv.currentValue !== null
          ? convertCurrency(inv.currentValue, inv.currentValueCurrency || inv.currency, displayCurrency, rates)
          : convertCurrency(inv.amountInvested, inv.currency, displayCurrency, rates);
      byCat.set(inv.category, (byCat.get(inv.category) || 0) + val);
    }
    return Array.from(byCat.entries()).map(([cat, value]) => ({ name: cat, value: Math.round(value) }));
  }, [activeInvestments, displayCurrency, rates]);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setCategory(dataset.lists.investmentCategories[0] || 'Business');
    setInvestmentDate(getTodayISO());
    setAmountInvested('');
    setCurrency(dataset.settings.defaultCurrency || 'INR');
    setCurrentValue('');
    setCurrentValueCurrency(dataset.settings.defaultCurrency || 'INR');
    setNotes('');
    setCustomFields({});
    setModalOpen(true);
  };

  const openEdit = (inv: Investment) => {
    setEditing(inv);
    setName(inv.name);
    setCategory(inv.category);
    setInvestmentDate(inv.investmentDate);
    setAmountInvested(String(inv.amountInvested));
    setCurrency(inv.currency);
    setCurrentValue(inv.currentValue !== null ? String(inv.currentValue) : '');
    setCurrentValueCurrency(inv.currentValueCurrency || inv.currency);
    setNotes(inv.notes);
    setCustomFields(inv.customFields || {});
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || Number(amountInvested) <= 0) return;
    setSaving(true);
    const ok = await performSyncAction(
      editing ? 'updateInvestment' : 'addInvestment',
      {
        id: editing?.id,
        name: name.trim(),
        category,
        investmentDate,
        amountInvested: Number(amountInvested),
        currency,
        currentValue: currentValue === '' ? null : Number(currentValue),
        currentValueCurrency,
        notes: notes.trim(),
        customFields,
      },
      editing ? `Updated investment ${name.trim()}` : `Added investment ${name.trim()}`
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
            Investments
          </h2>
          <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF]">
            Tracked independently from lending receivables · Supports INR, USD & custom categories
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-xs whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Investment</span>
        </button>
      </div>

      {/* Summary Cards + Allocation Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5">
            <p className="text-xs text-[#747B8A]">Total Invested</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums">
              {formatCurrency(metrics.totalInvested, displayCurrency, numFmt)}
            </p>
            <p className="mt-1 text-xs text-[#747B8A]">{metrics.count} holdings</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5">
            <p className="text-xs text-[#747B8A]">Current Portfolio Value</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums">
              {formatCurrency(metrics.totalCurrentValue, displayCurrency, numFmt)}
            </p>
            <p className="mt-1 text-xs text-[#747B8A]">{metrics.valuedCount} with updated value</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5">
            <p className="text-xs text-[#747B8A]">Profit / Loss</p>
            <p
              className={`mt-1.5 text-2xl font-semibold tabular-nums ${
                metrics.profitLoss >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
              }`}
            >
              {metrics.profitLoss >= 0 ? '+' : ''}
              {formatCurrency(metrics.profitLoss, displayCurrency, numFmt)}
            </p>
            <p className="mt-1 text-xs text-[#747B8A] tabular-nums">{metrics.returnPct}% return</p>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5">
          <h3 className="text-sm font-semibold mb-2">Category Allocation</h3>
          {allocationData.length === 0 ? (
            <p className="text-xs text-[#747B8A] py-6 text-center">Add an investment to see allocation.</p>
          ) : (
            <div className="h-36 flex items-center">
              <ResponsiveContainer width="55%" height="100%">
                <PieChart>
                  <Pie data={allocationData} dataKey="value" innerRadius={32} outerRadius={54} paddingAngle={2}>
                    {allocationData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => formatCurrency(Number(v) || 0, displayCurrency, numFmt)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1 text-xs">
                {allocationData.map((d, i) => (
                  <div key={`${d.name}-${i}`} className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(d.value, displayCurrency, numFmt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Investment List */}
      <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-6 shadow-xs">
        {activeInvestments.length === 0 ? (
          <div className="py-10 text-center">
            <ChartNoAxesCombined className="w-8 h-8 text-[#747B8A]/50 mx-auto mb-2" />
            <p className="text-sm font-medium">No investments recorded yet</p>
            <p className="text-xs text-[#747B8A] mt-0.5">
              Track Business, Store, Fixed Deposits, Stocks, Mutual Funds, Gold, or Real Estate here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E7EAF0]/80 dark:divide-[#30343D]/80">
            {activeInvestments.map((inv, idx) => {
              const currentConv =
                inv.currentValue !== null
                  ? convertCurrency(inv.currentValue, inv.currentValueCurrency || inv.currency, inv.currency, rates)
                  : inv.amountInvested;
              const pl = currentConv - inv.amountInvested;
              return (
                <div key={`${inv.id || 'inv'}-${idx}`} className="py-4 first:pt-1 last:pb-1 flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-2xl bg-[#16A34A]/10 flex items-center justify-center shrink-0">
                      <ChartNoAxesCombined className="w-4 h-4 text-[#16A34A]" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] truncate">
                        {inv.name}
                      </p>
                      <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF] truncate">
                        {inv.category}
                      </p>
                      <p className="text-[11px] font-medium text-[#747B8A]/90 dark:text-[#9CA3AF]/80">
                        {formatDateDisplay(inv.investmentDate, dataset.settings.dateFormat)}
                        {inv.currentValue !== null && (
                          <span className={`ml-2 ${pl >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                            {pl >= 0 ? '+' : ''}
                            {formatCurrency(pl, inv.currency, numFmt)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 pl-2">
                    <span className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
                      {inv.currentValue !== null
                        ? formatCurrency(inv.currentValue, inv.currentValueCurrency || inv.currency, numFmt)
                        : formatCurrency(inv.amountInvested, inv.currency, numFmt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEdit(inv)}
                      className="p-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-[#747B8A] hover:text-[#171A22] dark:hover:text-white transition"
                      aria-label="Edit investment"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => performSyncAction('archiveInvestment', { id: inv.id }, `Archived ${inv.name}`)}
                      className="p-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-[#747B8A] hover:text-[#DC2626] transition"
                      aria-label="Archive investment"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomSheet
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add Investment'}
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
              form="inv-form"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-brand-gradient text-sm font-semibold text-white"
            >
              {saving ? 'Saving...' : 'Save Investment'}
            </button>
          </div>
        }
      >
        <form id="inv-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Investment Name *</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {dataset.lists.investmentCategories.map((c, idx) => (
                  <option key={`${c}-${idx}`} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Amount Invested *</label>
              <input type="number" step="0.01" min="0.01" required value={amountInvested} onChange={(e) => setAmountInvested(e.target.value)} className={`${inputClass} tabular-nums`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Currency</label>
              <select value={currency} onChange={(e) => { setCurrency(e.target.value); setCurrentValueCurrency(e.target.value); }} className={inputClass}>
                {dataset.lists.currencies.map((c, idx) => <option key={`${c}-${idx}`} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Date *</label>
              <input type="date" required value={investmentDate} onChange={(e) => setInvestmentDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Current Value (Optional)</label>
              <input type="number" step="0.01" min="0" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} placeholder="Leave blank if unvalued" className={`${inputClass} tabular-nums`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Valuation Currency</label>
              <select value={currentValueCurrency} onChange={(e) => setCurrentValueCurrency(e.target.value)} className={inputClass}>
                {dataset.lists.currencies.map((c, idx) => <option key={`${c}-${idx}`} value={c}>{c}</option>)}
              </select>
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
            entity="Investments"
            definitions={dataset.customFields}
            values={customFields}
            onChange={setCustomFields}
          />
        </form>
      </BottomSheet>
    </div>
  );
};
