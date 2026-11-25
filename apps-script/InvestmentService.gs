/**
 * InvestmentService.gs — Independent portfolio tracking in INR, USD, and other currencies.
 */
function getInvestments() {
  return readRecords_(CONFIG.SHEETS.INVESTMENTS).map(mapInvestmentRow_);
}

function addInvestment(params) {
  return withScriptLock_(function() {
    if (isOperationProcessed_(params.operationId)) return { duplicate: true };
    var now = new Date().toISOString();
    var id = generateNextId_(CONFIG.SHEETS.INVESTMENTS, 'Investment ID', 'INV', 3);
    var cur = validateCurrency_(params.currency || 'INR');
    var record = {
      'Investment ID': id,
      'Name': String(params.name || '').trim(),
      'Category': String(params.category || 'Other').trim(),
      'Investment Date': validateIsoDate_(params.investmentDate, false),
      'Amount Invested': validatePositiveAmount_(params.amountInvested, false),
      'Currency': cur,
      'Current Value': params.currentValue !== null && params.currentValue !== '' && params.currentValue !== undefined
        ? validatePositiveAmount_(params.currentValue, true)
        : '',
      'Current Value Currency': validateCurrency_(params.currentValueCurrency || cur),
      'Status': String(params.status || 'Active'),
      'Notes': String(params.notes || ''),
      'Custom Fields JSON': JSON.stringify(params.customFields || {}),
      'Created At': now,
      'Updated At': now
    };
    appendRecordRow_(CONFIG.SHEETS.INVESTMENTS, record);
    logActivity_(params.operationId, 'Owner', 'Investment', id, 'CREATE', 'Added investment ' + record['Name'], record);
    return mapInvestmentRow_(record);
  });
}

function updateInvestment(params) {
  return withScriptLock_(function() {
    var id = String(params.id || '').trim();
    var cur = validateCurrency_(params.currency || 'INR');
    var updates = {
      'Name': String(params.name || '').trim(),
      'Category': String(params.category || 'Other').trim(),
      'Investment Date': validateIsoDate_(params.investmentDate, false),
      'Amount Invested': validatePositiveAmount_(params.amountInvested, false),
      'Currency': cur,
      'Current Value': params.currentValue !== null && params.currentValue !== '' && params.currentValue !== undefined
        ? validatePositiveAmount_(params.currentValue, true)
        : '',
      'Current Value Currency': validateCurrency_(params.currentValueCurrency || cur),
      'Status': String(params.status || 'Active'),
      'Notes': String(params.notes || ''),
      'Custom Fields JSON': JSON.stringify(params.customFields || {}),
      'Updated At': new Date().toISOString()
    };
    updateRecordRowById_(CONFIG.SHEETS.INVESTMENTS, 'Investment ID', id, updates);
    logActivity_(params.operationId, 'Owner', 'Investment', id, 'UPDATE', 'Updated investment ' + id, updates);
    return { success: true };
  });
}

function archiveInvestment(params) {
  return withScriptLock_(function() {
    var id = String(params.id || '').trim();
    updateRecordRowById_(CONFIG.SHEETS.INVESTMENTS, 'Investment ID', id, {
      'Status': 'Archived',
      'Updated At': new Date().toISOString()
    });
    logActivity_(params.operationId, 'Owner', 'Investment', id, 'ARCHIVE', 'Archived investment ' + id, null);
    return { success: true };
  });
}

function mapInvestmentRow_(row) {
  var cvRaw = row['Current Value'];
  return {
    id: String(row['Investment ID'] || '').trim(),
    name: String(row['Name'] || '').trim(),
    category: String(row['Category'] || 'Other').trim() || 'Other',
    investmentDate: formatDateCell_(row['Investment Date']),
    amountInvested: Number(row['Amount Invested']) || 0,
    currency: String(row['Currency'] || 'INR').trim() || 'INR',
    currentValue: cvRaw === '' || cvRaw === null || cvRaw === undefined ? null : Number(cvRaw),
    currentValueCurrency: String(row['Current Value Currency'] || row['Currency'] || 'INR').trim() || 'INR',
    status: String(row['Status'] || 'Active').trim() || 'Active',
    notes: String(row['Notes'] || '').trim(),
    customFields: parseJsonSafe_(row['Custom Fields JSON'], {}),
    createdAt: String(row['Created At'] || ''),
    updatedAt: String(row['Updated At'] || '')
  };
}
