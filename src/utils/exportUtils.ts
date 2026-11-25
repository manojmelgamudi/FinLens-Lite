import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FinanceDataset } from '../types/finance';

export function downloadCSV(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const escape = (val: string | number | boolean | null | undefined) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

export function exportFullWorkbookXLSX(dataset: FinanceDataset, filename = 'Personal_Finance_Export.xlsx') {
  const wb = XLSX.utils.book_new();

  const peopleSheet = XLSX.utils.json_to_sheet(
    dataset.people.map((p) => ({
      'Person ID': p.id,
      Name: p.name,
      Relationship: p.relationship,
      'Default Currency': p.defaultCurrency,
      Phone: p.phone,
      Email: p.email,
      Status: p.status,
      Notes: p.notes,
      'Created At': p.createdAt,
    }))
  );
  XLSX.utils.book_append_sheet(wb, peopleSheet, 'People');

  const txSheet = XLSX.utils.json_to_sheet(
    dataset.transactions.map((t) => ({
      'Transaction ID': t.id,
      Date: t.date,
      'Person ID': t.personId,
      'Person Name': t.personName,
      'Transaction Type': t.transactionType,
      'Transaction Mode': t.transactionMode,
      Description: t.description,
      Amount: t.amount,
      Currency: t.currency,
      'INR Equivalent': t.inrEquivalent ?? '',
      Category: t.category,
      'Payment Method': t.paymentMethod,
      'Reference / Notes': t.notes,
      'EMI Plan ID': t.emiPlanId || '',
      'EMI Installment ID': t.emiInstallmentId || '',
      Status: t.status,
    }))
  );
  XLSX.utils.book_append_sheet(wb, txSheet, 'Transactions');

  const emiPlansSheet = XLSX.utils.json_to_sheet(
    dataset.emiPlans.map((e) => ({
      'EMI Plan ID': e.id,
      'Person ID': e.personId,
      'Person Name': e.personName,
      'Plan Name': e.planName,
      'Plan Type': e.planType,
      'Total Principal': e.totalPrincipal,
      'Installment Amount': e.installmentAmount,
      Currency: e.currency,
      Frequency: e.frequency,
      'Start Date': e.startDate,
      'First Due Date': e.firstDueDate,
      'Number of Installments': e.numberOfInstallments,
      Status: e.status,
    }))
  );
  XLSX.utils.book_append_sheet(wb, emiPlansSheet, 'EMI Plans');

  const emiSchedSheet = XLSX.utils.json_to_sheet(
    dataset.emiSchedule.map((i) => ({
      'Installment ID': i.id,
      'EMI Plan ID': i.emiPlanId,
      'Person Name': i.personName,
      'Installment #': i.installmentNumber,
      'Due Date': i.dueDate,
      'Scheduled Amount': i.scheduledAmount,
      'Paid Amount': i.paidAmount,
      'Remaining Amount': i.remainingAmount,
      Currency: i.currency,
      Status: i.status,
      'Paid Date': i.paidDate || '',
    }))
  );
  XLSX.utils.book_append_sheet(wb, emiSchedSheet, 'EMI Schedule');

  const invSheet = XLSX.utils.json_to_sheet(
    dataset.investments.map((i) => ({
      'Investment ID': i.id,
      Name: i.name,
      Category: i.category,
      Date: i.investmentDate,
      'Amount Invested': i.amountInvested,
      Currency: i.currency,
      'Current Value': i.currentValue ?? '',
      'Current Value Currency': i.currentValueCurrency,
      Status: i.status,
      Notes: i.notes,
    }))
  );
  XLSX.utils.book_append_sheet(wb, invSheet, 'Investments');

  const debtSheet = XLSX.utils.json_to_sheet(
    dataset.debts.map((d) => ({
      'Debt ID': d.id,
      Creditor: d.creditor,
      Description: d.description,
      Date: d.date,
      Amount: d.amount,
      Currency: d.currency,
      'Amount Paid': d.amountPaid,
      'Outstanding Amount': d.outstandingAmount,
      Status: d.status,
      Notes: d.notes,
    }))
  );
  XLSX.utils.book_append_sheet(wb, debtSheet, 'Debts');

  const rateSheet = XLSX.utils.json_to_sheet(
    Object.entries(dataset.settings.exchangeRatesToINR).map(([currency, rate]) => ({
      Currency: currency,
      'Rate to INR (Assumption)': rate,
    }))
  );
  XLSX.utils.book_append_sheet(wb, rateSheet, 'Exchange Rates');

  XLSX.writeFile(wb, filename);
}

export function exportJSONBackup(dataset: FinanceDataset) {
  const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `Personal_Finance_Backup_${new Date().toISOString().slice(0, 10)}.json`);
}

function pdfSafe(value: string): string {
  return value
    .replace(/\u20B9\s*/g, 'INR ')
    .replace(/\u2212/g, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00B7/g, ' - ')
    .replace(/\u2026/g, '...');
}

export interface PersonStatementPDFOptions {
  personName: string;
  subtitle: string;
  generatedDate: string;
  summaryCurrency: string;
  summaryCards: { label: string; value: string }[];
  rows: {
    date: string;
    description: string;
    type: string;
    mode: string;
    status: string;
    amount: string;
  }[];
  filename?: string;
}

export function exportPersonStatementPDF(opts: PersonStatementPDFOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // Minimal clean header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(22, 119, 255);
  doc.text('FINLENS  |  ACCOUNT STATEMENT', margin, 44);

  doc.setFontSize(20);
  doc.setTextColor(23, 26, 34);
  doc.text(pdfSafe(opts.personName), margin, 68);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(116, 123, 138);
  doc.text(
    pdfSafe(`${opts.subtitle}  |  Currency: ${opts.summaryCurrency}`),
    margin,
    84
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(23, 26, 34);
  doc.text(pdfSafe(`Generated ${opts.generatedDate}`), pageWidth - margin, 66, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(116, 123, 138);
  doc.text(`${opts.rows.length} transactions`, pageWidth - margin, 81, {
    align: 'right',
  });

  doc.setDrawColor(231, 234, 240);
  doc.setLineWidth(1);
  doc.line(margin, 98, pageWidth - margin, 98);

  // Summary strip (4 equal aligned boxes)
  const boxY = 112;
  const boxH = 46;
  const cols = Math.max(1, opts.summaryCards.length);
  const colW = contentWidth / cols;
  doc.setDrawColor(231, 234, 240);
  doc.roundedRect(margin, boxY, contentWidth, boxH, 6, 6, 'S');
  opts.summaryCards.forEach((card, idx) => {
    const x = margin + idx * colW;
    if (idx > 0) {
      doc.line(x, boxY, x, boxY + boxH);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(116, 123, 138);
    doc.text(pdfSafe(card.label), x + 10, boxY + 17);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(23, 26, 34);
    doc.text(pdfSafe(card.value), x + 10, boxY + 35);
  });

  autoTable(doc, {
    startY: boxY + boxH + 18,
    margin: { left: margin, right: margin, bottom: 44 },
    head: [['Date', 'Description', 'Type', 'Mode', 'Status', 'Amount']],
    body: opts.rows.map((r) => [
      pdfSafe(r.date),
      pdfSafe(r.description),
      pdfSafe(r.type),
      pdfSafe(r.mode),
      pdfSafe(r.status),
      pdfSafe(r.amount),
    ]),
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: [23, 26, 34],
      cellPadding: { top: 7, right: 6, bottom: 7, left: 4 },
      lineColor: [231, 234, 240],
      lineWidth: { bottom: 0.5 },
      valign: 'top',
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 8.5,
      textColor: [116, 123, 138],
      lineColor: [203, 213, 225],
      lineWidth: { bottom: 1.2 },
    },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 74 },
      3: { cellWidth: 68 },
      4: { cellWidth: 48 },
      5: { cellWidth: 78, halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(116, 123, 138);
      doc.text(
        pdfSafe(`FinLens Account Statement - ${opts.personName}`),
        margin,
        pageH - 22
      );
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth - margin,
        pageH - 22,
        { align: 'right' }
      );
    },
  });

  const safeSlug = opts.personName.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'Person';
  const file = opts.filename || `FinLens_Statement_${safeSlug}.pdf`;
  doc.save(file);
}

export function exportTableReportPDF(opts: {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  filename?: string;
}) {
  const isWide = opts.headers.length >= 6;
  const doc = new jsPDF({
    orientation: isWide ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(22, 119, 255);
  doc.text('FINLENS  |  FINANCIAL REPORT', margin, 40);

  doc.setFontSize(17);
  doc.setTextColor(23, 26, 34);
  doc.text(pdfSafe(opts.title), margin, 62);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(116, 123, 138);
  doc.text(pdfSafe(opts.subtitle), margin, 77);

  autoTable(doc, {
    startY: 94,
    margin: { left: margin, right: margin, bottom: 40 },
    head: [opts.headers.map((h) => pdfSafe(String(h)))],
    body: opts.rows.map((r) => r.map((c) => pdfSafe(c === null || c === undefined ? '' : String(c)))),
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      textColor: [23, 26, 34],
      cellPadding: { top: 6, right: 6, bottom: 6, left: 4 },
      lineColor: [231, 234, 240],
      lineWidth: { bottom: 0.5 },
    },
    headStyles: {
      fontStyle: 'bold',
      textColor: [116, 123, 138],
      lineColor: [203, 213, 225],
      lineWidth: { bottom: 1.2 },
    },
  });

  doc.save(opts.filename || 'FinLens_Report.pdf');
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
