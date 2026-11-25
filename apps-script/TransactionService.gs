/**
 * TransactionService.gs — Actual financial movement ledger preserving original currency & audit trail.
 */
function getTransactions(params) {
  var list = readRecords_(CONFIG.SHEETS.TRANSACTIONS).map(mapTransactionRow_);
  if (params && params.personId) {
    list = list.filter(function(t) { return t.personId === params.personId; });
  }
  return list;
}

function getTransaction(params) {
  var id = String(params.id || '').trim();
  var list = getTransactions({});
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
  }
  throw new Error('Transaction not found.');
}

function addTransaction(params) {
  return withScriptLock_(function() {
    if (isOperationProcessed_(params.operationId)) {
      return { duplicate: true };
    }
    var person = assertPersonExists_(params.personId);
    var amount = validatePositiveAmount_(params.amount, false);
    var currency = validateCurrency_(params.currency || 'INR');
    var date = validateIsoDate_(params.date, true);
    var now = new Date().toISOString();
    var id = generateNextId_(CONFIG.SHEETS.TRANSACTIONS, 'Transaction ID', 'T', 3);

    var rates = getExchangeRatesMap_();
    var rate = rates[currency] || 1;
    var inrEquiv = currency === 'INR' ? amount : Math.round((amount * rate) * 100) / 100;

    var record = {
      'Transaction ID': id,
      'Date': date,
      'Person ID': person['Person ID'],
      'Person Name': person['Name'],
      'Transaction Type': String(params.transactionType || 'Lending'),
      'Transaction Mode': String(params.transactionMode || 'One-time'),
      'Description': String(params.description || '').trim(),
      'Amount': amount,
      'Currency': currency,
      'INR Equivalent': inrEquiv,
      'Category': String(params.category || 'Personal Loan'),
      'Payment Method': String(params.paymentMethod || ''),
      'Reference / Notes': String(params.notes || params.referenceNumber || ''),
      'EMI Plan ID': String(params.emiPlanId || ''),
      'EMI Installment ID': String(params.emiInstallmentId || ''),
      'Reduces Principal': params.reducesPrincipal ? 'TRUE' : 'FALSE',
      'Status': 'Active',
      'Reversed Transaction ID': '',
      'Custom Fields JSON': JSON.stringify(params.customFields || {}),
      'Created At': now,
      'Updated At': now
    };
    appendRecordRow_(CONFIG.SHEETS.TRANSACTIONS, record);
    logActivity_(params.operationId, 'Owner', 'Transaction', id, 'CREATE', record['Transaction Type'] + ' ' + amount + ' ' + currency, record);
    return mapTransactionRow_(record);
  });
}

function updateTransaction(params) {
  return withScriptLock_(function() {
    if (isOperationProcessed_(params.operationId)) {
      return { duplicate: true };
    }
    var id = String(params.id || '').trim();
    var existing = getTransaction({ id: id });
    var amount = validatePositiveAmount_(params.amount, false);
    var currency = validateCurrency_(params.currency || existing.currency);
    var date = validateIsoDate_(params.date, true);
    var rates = getExchangeRatesMap_();
    var inrEquiv = currency === 'INR' ? amount : Math.round((amount * (rates[currency] || 1)) * 100) / 100;

    var updates = {
      'Date': date,
      'Transaction Type': String(params.transactionType || existing.transactionType),
      'Description': String(params.description || ''),
      'Amount': amount,
      'Currency': currency,
      'INR Equivalent': inrEquiv,
      'Category': String(params.category || existing.category),
      'Payment Method': String(params.paymentMethod || ''),
      'Reference / Notes': String(params.notes || ''),
      'Reduces Principal': params.reducesPrincipal ? 'TRUE' : 'FALSE',
      'Custom Fields JSON': JSON.stringify(params.customFields || existing.customFields || {}),
      'Updated At': new Date().toISOString()
    };
    updateRecordRowById_(CONFIG.SHEETS.TRANSACTIONS, 'Transaction ID', id, updates);
    logActivity_(params.operationId, 'Owner', 'Transaction', id, 'UPDATE', 'Edited transaction ' + id, { before: existing, after: updates });
    return getTransaction({ id: id });
  });
}

function reverseTransaction(params) {
  return withScriptLock_(function() {
    if (isOperationProcessed_(params.operationId)) {
      return { duplicate: true };
    }
    var id = String(params.id || '').trim();
    var existing = getTransaction({ id: id });
    if (existing.emiInstallmentId) {
      throw new Error('This transaction is linked to an EMI installment. Reverse or adjust from the EMI schedule.');
    }
    updateRecordRowById_(CONFIG.SHEETS.TRANSACTIONS, 'Transaction ID', id, {
      'Status': 'Reversed',
      'Updated At': new Date().toISOString()
    });
    logActivity_(params.operationId, 'Owner', 'Transaction', id, 'REVERSE', 'Reversed transaction ' + id, existing);
    return { success: true, id: id };
  });
}

function archiveTransaction(params) {
  return withScriptLock_(function() {
    var id = String(params.id || '').trim();
    var existing = getTransaction({ id: id });
    if (existing.emiInstallmentId) {
      throw new Error('Cannot silently remove a transaction linked to an EMI installment.');
    }
    updateRecordRowById_(CONFIG.SHEETS.TRANSACTIONS, 'Transaction ID', id, {
      'Status': 'Archived',
      'Updated At': new Date().toISOString()
    });
    logActivity_(params.operationId, 'Owner', 'Transaction', id, 'ARCHIVE', 'Archived transaction ' + id, null);
    return { success: true, id: id };
  });
}

function mapTransactionRow_(row) {
  var amtRaw = String(row['Amount'] !== undefined && row['Amount'] !== null ? row['Amount'] : '0').replace(/,/g, '');
  var inrRaw = String(row['INR Equivalent'] !== undefined && row['INR Equivalent'] !== null ? row['INR Equivalent'] : '').replace(/,/g, '');
  var notesText = String(row['Reference / Notes'] || row['Notes'] || '').trim();
  var reducesCol = String(row['Reduces Principal'] || '').toUpperCase() === 'TRUE';
  var reducesNote = notesText.toLowerCase().indexOf('reduction in balance') !== -1;

  return {
    id: String(row['Transaction ID'] || '').trim(),
    date: formatDateCell_(row['Date']),
    personId: String(row['Person ID'] || '').trim(),
    personName: String(row['Person Name'] || '').trim(),
    transactionType: String(row['Transaction Type'] || 'Lending').trim() || 'Lending',
    transactionMode: String(row['Transaction Mode'] || 'One-time').trim() || 'One-time',
    description: String(row['Description'] || '').trim(),
    amount: Number(amtRaw) || 0,
    currency: String(row['Currency'] || 'INR').trim() || 'INR',
    inrEquivalent: inrRaw ? Number(inrRaw) : null,
    category: String(row['Category'] || 'Personal Loan').trim() || 'Personal Loan',
    paymentMethod: String(row['Payment Method'] || '').trim(),
    referenceNumber: String(row['Reference Number'] || '').trim(),
    notes: notesText,
    emiPlanId: String(row['EMI Plan ID'] || '').trim(),
    emiInstallmentId: String(row['EMI Installment ID'] || '').trim(),
    reducesPrincipal: reducesCol || reducesNote,
    status: String(row['Status'] || 'Active').trim() || 'Active',
    reversedTransactionId: String(row['Reversed Transaction ID'] || '').trim(),
    customFields: parseJsonSafe_(row['Custom Fields JSON'], {}),
    createdAt: String(row['Created At'] || ''),
    updatedAt: String(row['Updated At'] || '')
  };
}
