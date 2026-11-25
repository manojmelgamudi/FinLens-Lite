/**
 * DebtService.gs — Independent liabilities management (initial workbook value 0).
 */
function getDebts() {
  return readRecords_(CONFIG.SHEETS.DEBTS).map(mapDebtRow_);
}

function addDebt(params) {
  return withScriptLock_(function() {
    if (isOperationProcessed_(params.operationId)) return { duplicate: true };
    var now = new Date().toISOString();
    var id = generateNextId_(CONFIG.SHEETS.DEBTS, 'Debt ID', 'DBT', 3);
    var amount = validatePositiveAmount_(params.amount, false);
    var paid = validatePositiveAmount_(params.amountPaid || 0, true);
    var outstanding = Math.max(0, Math.round((amount - paid) * 100) / 100);
    var record = {
      'Debt ID': id,
      'Creditor': String(params.creditor || '').trim(),
      'Description': String(params.description || '').trim(),
      'Date': validateIsoDate_(params.date, false),
      'Amount': amount,
      'Currency': validateCurrency_(params.currency || 'INR'),
      'Amount Paid': paid,
      'Outstanding Amount': outstanding,
      'Status': outstanding <= 0.01 ? 'Settled' : 'Active',
      'Notes': String(params.notes || ''),
      'Custom Fields JSON': JSON.stringify(params.customFields || {}),
      'Created At': now,
      'Updated At': now
    };
    appendRecordRow_(CONFIG.SHEETS.DEBTS, record);
    logActivity_(params.operationId, 'Owner', 'Debt', id, 'CREATE', 'Added debt ' + record['Creditor'], record);
    return mapDebtRow_(record);
  });
}

function updateDebt(params) {
  return withScriptLock_(function() {
    var id = String(params.id || '').trim();
    var amount = validatePositiveAmount_(params.amount, false);
    var paid = validatePositiveAmount_(params.amountPaid || 0, true);
    var outstanding = Math.max(0, Math.round((amount - paid) * 100) / 100);
    var updates = {
      'Creditor': String(params.creditor || '').trim(),
      'Description': String(params.description || '').trim(),
      'Date': validateIsoDate_(params.date, false),
      'Amount': amount,
      'Currency': validateCurrency_(params.currency || 'INR'),
      'Amount Paid': paid,
      'Outstanding Amount': outstanding,
      'Status': params.status || (outstanding <= 0.01 ? 'Settled' : 'Active'),
      'Notes': String(params.notes || ''),
      'Custom Fields JSON': JSON.stringify(params.customFields || {}),
      'Updated At': new Date().toISOString()
    };
    updateRecordRowById_(CONFIG.SHEETS.DEBTS, 'Debt ID', id, updates);
    logActivity_(params.operationId, 'Owner', 'Debt', id, 'UPDATE', 'Updated debt ' + id, updates);
    return { success: true };
  });
}

function settleDebt(params) {
  return withScriptLock_(function() {
    var id = String(params.id || '').trim();
    var debts = getDebts();
    var target = null;
    for (var i = 0; i < debts.length; i++) {
      if (debts[i].id === id) { target = debts[i]; break; }
    }
    if (!target) throw new Error('Debt not found.');
    updateRecordRowById_(CONFIG.SHEETS.DEBTS, 'Debt ID', id, {
      'Amount Paid': target.amount,
      'Outstanding Amount': 0,
      'Status': 'Settled',
      'Updated At': new Date().toISOString()
    });
    logActivity_(params.operationId, 'Owner', 'Debt', id, 'SETTLE', 'Settled debt ' + id, null);
    return { success: true };
  });
}

function archiveDebt(params) {
  return withScriptLock_(function() {
    var id = String(params.id || '').trim();
    updateRecordRowById_(CONFIG.SHEETS.DEBTS, 'Debt ID', id, {
      'Status': 'Archived',
      'Updated At': new Date().toISOString()
    });
    logActivity_(params.operationId, 'Owner', 'Debt', id, 'ARCHIVE', 'Archived debt ' + id, null);
    return { success: true };
  });
}

function mapDebtRow_(row) {
  var amt = Number(row['Amount']) || 0;
  var paid = Number(row['Amount Paid']) || 0;
  return {
    id: String(row['Debt ID'] || '').trim(),
    creditor: String(row['Creditor'] || '').trim(),
    description: String(row['Description'] || '').trim(),
    date: formatDateCell_(row['Date']),
    amount: amt,
    currency: String(row['Currency'] || 'INR').trim() || 'INR',
    amountPaid: paid,
    outstandingAmount: Math.max(0, Math.round((amt - paid) * 100) / 100),
    status: String(row['Status'] || 'Active').trim() || 'Active',
    notes: String(row['Notes'] || '').trim(),
    customFields: parseJsonSafe_(row['Custom Fields JSON'], {}),
    createdAt: String(row['Created At'] || ''),
    updatedAt: String(row['Updated At'] || '')
  };
}
