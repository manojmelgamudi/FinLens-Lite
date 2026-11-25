import React, { useMemo, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, Printer } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import {
  computeDashboardSummary,
  computeInstallmentStatus,
  formatCurrency,
  formatDateDisplay,
  getTodayISO,
} from '../utils/calculations';
import { downloadCSV, exportFullWorkbookXLSX, exportTableReportPDF } from '../utils/exportUtils';

type ReportType =
  | 'complete_summary'
  | 'person_receivables'
  | 'monthly_lending'
  | 'monthly_repayment'
  | 'emi_collection'
  | 'overdue_emi'
  | 'investment_report'
  | 'debt_report';

export const ReportsPage: React.FC = () => {
  const { dataset, displayCurrency } = useFinance();
  const [reportType, setReportType] = useState<ReportType>('person_receivables');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const todayISO = getTodayISO();
  const numFmt = dataset.settings.numberFormat;

  const summary = useMemo(
    () => computeDashboardSummary(dataset, displayCurrency, { preset: 'all' }, todayISO),
    [dataset, displayCurrency, todayISO]
  );

  const reportData = useMemo(() => {
    const inDates = (d: string) => {
      if (!dateFrom && !dateTo) return true;
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    };

    switch (reportType) {
      case 'person_receivables':
        return {
          title: 'Person-Wise Receivables Report',
          headers: ['Person ID', 'Name', 'Original Currency', 'Native Principal Outstanding', `Converted (${displayCurrency})`, 'Active EMI Plans'],
          rows: summary.personSummaries.map((p) => {
            const nat = p.person.defaultCurrency || 'INR';
            const natAmt = p.principalOutstandingByCurrency[nat] ?? p.principalOutstandingDisplay;
            return [
              p.person.id,
              p.person.name,
              nat,
              formatCurrency(natAmt, nat, numFmt),
              formatCurrency(p.principalOutstandingDisplay, displayCurrency, numFmt),
              String(p.activeEmiPlansCount),
            ];
          }),
        };

      case 'monthly_lending': {
        const list = dataset.transactions.filter(
          (t) => t.status === 'Active' && t.transactionType === 'Lending' && inDates(t.date)
        );
        return {
          title: 'Lending Report (Original Currencies Preserved)',
          headers: ['Transaction ID', 'Date', 'Person', 'Description', 'Original Amount', 'Currency'],
          rows: list.map((t) => [
            t.id,
            t.date ? formatDateDisplay(t.date, dataset.settings.dateFormat) : 'Opening',
            t.personName,
            t.description,
            String(t.amount),
            t.currency,
          ]),
        };
      }

      case 'monthly_repayment': {
        const list = dataset.transactions.filter(
          (t) => t.status === 'Active' && t.transactionType === 'Repayment' && inDates(t.date)
        );
        return {
          title: 'Repayment Report',
          headers: ['Transaction ID', 'Date', 'Person', 'Mode', 'Amount', 'Currency', 'Notes'],
          rows: list.map((t) => [
            t.id,
            t.date ? formatDateDisplay(t.date, dataset.settings.dateFormat) : 'Opening',
            t.personName,
            t.transactionMode,
            String(t.amount),
            t.currency,
            t.notes,
          ]),
        };
      }

      case 'emi_collection':
      case 'overdue_emi': {
        const list = dataset.emiSchedule
          .map((i) => ({ ...i, status: computeInstallmentStatus(i, todayISO) }))
          .filter((i) => inDates(i.dueDate))
          .filter((i) => (reportType === 'overdue_emi' ? i.status === 'Overdue' : true));
        return {
          title: reportType === 'overdue_emi' ? 'Overdue EMI Report' : 'EMI Collection Report',
          headers: ['Installment ID', 'Person', 'Due Date', 'Scheduled', 'Paid', 'Remaining', 'Currency', 'Status'],
          rows: list.map((i) => [
            i.id,
            i.personName,
            formatDateDisplay(i.dueDate, dataset.settings.dateFormat),
            String(i.scheduledAmount),
            String(i.paidAmount),
            String(i.remainingAmount),
            i.currency,
            i.status,
          ]),
        };
      }

      case 'investment_report':
        return {
          title: 'Investment Portfolio Report',
          headers: ['ID', 'Name', 'Category', 'Date', 'Invested', 'Currency', 'Current Value', 'Val. Currency'],
          rows: dataset.investments
            .filter((i) => i.status !== 'Archived' && inDates(i.investmentDate))
            .map((i) => [
              i.id,
              i.name,
              i.category,
              formatDateDisplay(i.investmentDate, dataset.settings.dateFormat),
              String(i.amountInvested),
              i.currency,
              i.currentValue !== null ? String(i.currentValue) : 'Unvalued',
              i.currentValueCurrency,
            ]),
        };

      case 'debt_report':
        return {
          title: 'Debt & Liabilities Report',
          headers: ['ID', 'Creditor', 'Description', 'Date', 'Original', 'Paid', 'Outstanding', 'Currency', 'Status'],
          rows: dataset.debts
            .filter((d) => d.status !== 'Archived' && inDates(d.date))
            .map((d) => [
              d.id,
              d.creditor,
              d.description,
              formatDateDisplay(d.date, dataset.settings.dateFormat),
              String(d.amount),
              String(d.amountPaid),
              String(d.outstandingAmount),
              d.currency,
              d.status,
            ]),
        };

      default:
        return {
          title: 'Complete Financial Summary',
          headers: ['Metric', 'Value'],
          rows: [
            [`Total Consolidated Receivables (${displayCurrency})`, formatCurrency(summary.totalReceivablesDisplay, displayCurrency, numFmt)],
            ['Native INR Receivables', formatCurrency(summary.inrReceivablesNative, 'INR', numFmt)],
            ['Separate USD Lending', formatCurrency(summary.usdReceivablesNative, 'USD', 'en-US')],
            [`Investments Portfolio (${displayCurrency})`, formatCurrency(summary.investmentMetrics.totalCurrentValue, displayCurrency, numFmt)],
            [`Outstanding Debts (${displayCurrency})`, formatCurrency(summary.debtMetrics.remainingLiabilities, displayCurrency, numFmt)],
            ['Exchange Rate Assumption (USD to INR)', `1 USD = ₹${summary.exchangeRateUSDToINR}`],
          ],
        };
    }
  }, [reportType, dateFrom, dateTo, dataset, summary, displayCurrency, numFmt, todayISO]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h2 className="text-2xl font-semibold text-[#171A22] dark:text-[#F8FAFC]">Reports</h2>
          <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF]">
            Exchange rate assumption: 1 USD = ₹{summary.exchangeRateUSDToINR} · Original currencies preserved
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadCSV(`${reportType}.csv`, reportData.headers, reportData.rows)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] bg-white dark:bg-[#1A1D24] px-3.5 py-2 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => exportFullWorkbookXLSX(dataset)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] bg-white dark:bg-[#1A1D24] px-3.5 py-2 text-xs font-semibold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#16A34A]" />
            Export Excel
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          exportTableReportPDF({
            title: reportData.title,
            subtitle: `Generated ${formatDateDisplay(todayISO, dataset.settings.dateFormat)} - 1 USD = INR ${summary.exchangeRateUSDToINR}`,
            headers: reportData.headers,
            rows: reportData.rows,
            filename: `FinLens_${reportType}.pdf`,
          })
        }
        className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-semibold text-white shadow-xs hover:opacity-95 transition no-print"
      >
        <Printer className="w-4 h-4" />
        <span>Print / PDF</span>
      </button>

      {/* Report Selector & Date Filter */}
      <div className="flex flex-col sm:flex-row gap-3 no-print">
        <div className="relative flex-1">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="no-auto-chevron w-full appearance-none rounded-full bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] pl-4 pr-9 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30 cursor-pointer"
          >
            <option value="person_receivables">Person-wise Receivables</option>
            <option value="complete_summary">Complete Financial Summary</option>
            <option value="monthly_lending">Lending Report</option>
            <option value="monthly_repayment">Repayment Report</option>
            <option value="emi_collection">EMI Collection Report</option>
            <option value="overdue_emi">Overdue EMI Report</option>
            <option value="investment_report">Investment Report</option>
            <option value="debt_report">Debt Report</option>
          </select>
          <ChevronDown className="w-4 h-4 text-[#747B8A] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-full bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30"
          />
          <span className="text-[#747B8A]">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-full bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5 shadow-xs overflow-x-auto">
        <h3 className="text-base font-semibold mb-4">{reportData.title}</h3>
        {reportData.rows.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#747B8A]">No records found for this report.</p>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E7EAF0] dark:border-[#30343D] text-[#747B8A]">
                {reportData.headers.map((h, idx) => (
                  <th key={`${h}-${idx}`} className="py-2.5 pr-4 font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7EAF0] dark:divide-[#30343D]">
              {reportData.rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="py-2.5 pr-4 tabular-nums whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
