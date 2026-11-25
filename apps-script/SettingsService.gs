/**
 * SettingsService.gs — Settings, dynamic Custom Fields, and configurable Lists.
 */
function getExchangeRatesMap_() {
  var settings = getSettings();
  return settings.exchangeRatesToINR || { INR: 1, USD: 84.5, EUR: 91.2, GBP: 107.4, AED: 23.0 };
}

function getSettings() {
  var rows = readRecords_(CONFIG.SHEETS.SETTINGS);
  var defaults = {
    appName: 'Personal Finance',
    defaultCurrency: 'INR',
    supportedCurrencies: ['INR', 'USD', 'EUR', 'GBP', 'AED'],
    exchangeRatesToINR: { INR: 1, USD: 84.5, EUR: 91.2, GBP: 107.4, AED: 23.0 },
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'en-IN',
    theme: 'light',
    language: 'English',
    sessionTimeoutMinutes: 15,
    pinLength: 4,
    treatInterestAdjustmentAsBalanceReductionDefault: true,
    biometricEnabled: false
  };
  rows.forEach(function(r) {
    var k = String(r['Key'] || '').trim();
    var v = r['Value'];
    if (!k) return;
    if (k === 'supportedCurrencies' || k === 'exchangeRatesToINR') {
      defaults[k] = parseJsonSafe_(v, defaults[k]);
    } else if (k === 'sessionTimeoutMinutes' || k === 'pinLength') {
      defaults[k] = Number(v) || defaults[k];
    } else if (k === 'treatInterestAdjustmentAsBalanceReductionDefault' || k === 'biometricEnabled') {
      defaults[k] = String(v).toUpperCase() === 'TRUE' || v === true;
    } else {
      defaults[k] = String(v);
    }
  });
  return defaults;
}

function updateSettings(params) {
  return withScriptLock_(function() {
    var ss = getSpreadsheet_();
    var sheet = ensureSheetWithSchema_(ss, CONFIG.SHEETS.SETTINGS);
    var settingsObj = params.settings || {};
    var keys = Object.keys(settingsObj);
    var rows = [['Key', 'Value']];
    keys.forEach(function(k) {
      var val = settingsObj[k];
      rows.push([k, typeof val === 'object' ? JSON.stringify(val) : String(val)]);
    });
    sheet.clearContents();
    sheet.getRange(1, 1, rows.length, 2).setValues(rows);
    if (settingsObj.sessionTimeoutMinutes) {
      PropertiesService.getScriptProperties().setProperty(
        CONFIG.PROP_KEYS.SESSION_TIMEOUT_MINUTES,
        String(settingsObj.sessionTimeoutMinutes)
      );
    }
    logActivity_(params.operationId, 'Owner', 'Settings', 'SETTINGS', 'UPDATE', 'Updated application settings', null);
    return getSettings();
  });
}

function getCustomFields() {
  return readRecords_(CONFIG.SHEETS.CUSTOM_FIELDS).map(function(row) {
    return {
      id: String(row['Field ID'] || '').trim(),
      entity: String(row['Entity'] || '').trim(),
      label: String(row['Label'] || '').trim(),
      key: String(row['Key'] || '').trim(),
      fieldType: String(row['Field Type'] || 'Short text').trim(),
      options: parseJsonSafe_(row['Options JSON'], []),
      required: String(row['Required'] || '').toUpperCase() === 'TRUE',
      visible: String(row['Visible'] || 'TRUE').toUpperCase() !== 'FALSE',
      order: Number(row['Order']) || 0,
      archived: String(row['Archived'] || '').toUpperCase() === 'TRUE',
      createdAt: String(row['Created At'] || ''),
      updatedAt: String(row['Updated At'] || '')
    };
  });
}

function addCustomField(params) {
  return withScriptLock_(function() {
    var now = new Date().toISOString();
    var id = generateNextId_(CONFIG.SHEETS.CUSTOM_FIELDS, 'Field ID', 'CF', 3);
    var record = {
      'Field ID': id,
      'Entity': String(params.entity || 'Transactions'),
      'Label': String(params.label || '').trim(),
      'Key': String(params.key || '').trim(),
      'Field Type': String(params.fieldType || 'Short text'),
      'Options JSON': JSON.stringify(params.options || []),
      'Required': params.required ? 'TRUE' : 'FALSE',
      'Visible': params.visible !== false ? 'TRUE' : 'FALSE',
      'Order': Number(params.order || 0),
      'Archived': 'FALSE',
      'Created At': now,
      'Updated At': now
    };
    appendRecordRow_(CONFIG.SHEETS.CUSTOM_FIELDS, record);
    logActivity_(params.operationId, 'Owner', 'CustomField', id, 'CREATE', 'Added custom field ' + record['Label'], record);
    return { id: id };
  });
}

function updateCustomField(params) {
  return withScriptLock_(function() {
    var id = String(params.id || '').trim();
    var all = getCustomFields();
    var existing = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        existing = all[i];
        break;
      }
    }
    if (!existing) throw new Error('Custom field not found: ' + id);

    updateRecordRowById_(CONFIG.SHEETS.CUSTOM_FIELDS, 'Field ID', id, {
      'Label': params.label !== undefined ? String(params.label).trim() : existing.label,
      'Field Type': params.fieldType !== undefined ? String(params.fieldType) : existing.fieldType,
      'Options JSON': JSON.stringify(params.options !== undefined ? params.options : existing.options),
      'Required': (params.required !== undefined ? Boolean(params.required) : existing.required) ? 'TRUE' : 'FALSE',
      'Visible': (params.visible !== undefined ? Boolean(params.visible) : existing.visible) ? 'TRUE' : 'FALSE',
      'Order': params.order !== undefined ? Number(params.order) : existing.order,
      'Updated At': new Date().toISOString()
    });
    return { success: true };
  });
}

function archiveCustomField(params) {
  return withScriptLock_(function() {
    var id = String(params.id || '').trim();
    updateRecordRowById_(CONFIG.SHEETS.CUSTOM_FIELDS, 'Field ID', id, {
      'Archived': 'TRUE',
      'Updated At': new Date().toISOString()
    });
    return { success: true };
  });
}

function getLists() {
  var rows = readRecords_(CONFIG.SHEETS.LISTS);
  var defaults = {
    transactionTypes: ['Lending', 'Repayment', 'Interest Earned', 'Interest Adjustment', 'Fee', 'Other Adjustment'],
    categories: ['Personal Loan', 'Family Support', 'Emergency', 'Business Advance', 'EMI Repayment', 'Interest', 'Fee', 'Other'],
    paymentMethods: ['UPI', 'Bank Transfer', 'IMPS / NEFT', 'Cash', 'Card', 'Zelle / Wire', 'Other'],
    emiFrequencies: ['Monthly', 'Weekly', 'Biweekly', 'Quarterly', 'Custom'],
    currencies: ['INR', 'USD', 'EUR', 'GBP', 'AED'],
    relationshipTypes: ['Friend', 'Family', 'Colleague', 'Business Partner', 'Relative', 'Other'],
    investmentCategories: ['Business', 'Store', 'Fixed Deposit', 'Stocks', 'Mutual Funds', 'Gold', 'Real Estate', 'Other'],
    paymentStatuses: ['Pending', 'Paid', 'Partially Paid', 'Overdue', 'Skipped', 'Rescheduled']
  };
  rows.forEach(function(r) {
    var name = String(r['List Name'] || '').trim();
    if (name && defaults.hasOwnProperty(name)) {
      defaults[name] = parseJsonSafe_(r['Values JSON'], defaults[name]);
    }
  });
  return defaults;
}

function updateLists(params) {
  return withScriptLock_(function() {
    var ss = getSpreadsheet_();
    var sheet = ensureSheetWithSchema_(ss, CONFIG.SHEETS.LISTS);
    var listsObj = params.lists || {};
    var rows = [['List Name', 'Values JSON']];
    Object.keys(listsObj).forEach(function(k) {
      rows.push([k, JSON.stringify(listsObj[k])]);
    });
    sheet.clearContents();
    sheet.getRange(1, 1, rows.length, 2).setValues(rows);
    logActivity_(params.operationId, 'Owner', 'Lists', 'LISTS', 'UPDATE', 'Updated configurable lists', null);
    return getLists();
  });
}
