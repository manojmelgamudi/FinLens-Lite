/**
 * Code.gs — Web App entry point & secure action router.
 * Executes as the deploying spreadsheet owner (Execute as: Me, Access: Anyone).
 * Visitors never sign in with Google; all protected actions require valid PIN session token.
 */
function doGet(e) {
  return jsonResponse_({
    ok: true,
    service: 'Personal Finance Apps Script API',
    authStatus: getAuthStatus()
  });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var expectedSecret = PropertiesService.getScriptProperties().getProperty(CONFIG.PROP_KEYS.API_SECRET);
    if (expectedSecret && body.apiSecret !== expectedSecret) {
      return jsonResponse_({ ok: false, code: 'UNAUTHORIZED_SECRET', error: 'Unauthorized backend API secret.' });
    }

    var action = String(body.action || '').trim();
    var params = body.params || {};
    var sessionToken = String(body.sessionToken || '').trim();

    // Public PIN authentication endpoints (no financial data exposed)
    if (action === 'getAuthStatus') return jsonResponse_({ ok: true, data: getAuthStatus() });
    if (action === 'setupPin') return jsonResponse_({ ok: true, data: setupPin(params) });
    if (action === 'verifyPin') return jsonResponse_({ ok: true, data: verifyPin(params) });
    if (action === 'logout') return jsonResponse_({ ok: true, data: logout({ sessionToken: sessionToken }) });

    // All remaining endpoints require valid server-side session authentication
    var sessionInfo = validateSession({ sessionToken: sessionToken });

    if (action === 'validateSession') {
      return jsonResponse_({ ok: true, data: sessionInfo });
    }
    if (action === 'changePin') {
      return jsonResponse_({ ok: true, data: changePin(params, sessionToken) });
    }

    // Unified syncAction wrapper: performs mutation and returns fresh dataset in one round-trip
    if (action === 'syncAction') {
      var subAction = String(params.subAction || '').trim();
      dispatchFinanceAction_(subAction, params);
      return jsonResponse_({ ok: true, data: getDashboardSummary() });
    }

    var directResult = dispatchFinanceAction_(action, params);
    return jsonResponse_({ ok: true, data: directResult });
  } catch (err) {
    return jsonResponse_(formatErrorPayload_(err));
  }
}

function dispatchFinanceAction_(action, params) {
  var routes = {
    getPeople: function() { return getPeople(); },
    getPerson: function() { return getPerson(params); },
    addPerson: function() { return addPerson(params); },
    updatePerson: function() { return updatePerson(params); },
    archivePerson: function() { return archivePerson(params); },
    restorePerson: function() { return restorePerson(params); },
    getTransactions: function() { return getTransactions(params); },
    getTransaction: function() { return getTransaction(params); },
    addTransaction: function() { return addTransaction(params); },
    updateTransaction: function() { return updateTransaction(params); },
    reverseTransaction: function() { return reverseTransaction(params); },
    archiveTransaction: function() { return archiveTransaction(params); },
    getEMIPlans: function() { return getEMIPlans(); },
    createEMIPlan: function() { return createEMIPlan(params); },
    getEMISchedule: function() { return getEMISchedule(params); },
    recordEMIPayment: function() { return recordEMIPayment(params); },
    updateInstallment: function() { return updateInstallment(params); },
    pauseEMIPlan: function() { return pauseEMIPlan(params); },
    resumeEMIPlan: function() { return resumeEMIPlan(params); },
    cancelEMIPlan: function() { return cancelEMIPlan(params); },
    completeEMIPlan: function() { return completeEMIPlan(params); },
    getInvestments: function() { return getInvestments(); },
    addInvestment: function() { return addInvestment(params); },
    updateInvestment: function() { return updateInvestment(params); },
    archiveInvestment: function() { return archiveInvestment(params); },
    getDebts: function() { return getDebts(); },
    addDebt: function() { return addDebt(params); },
    updateDebt: function() { return updateDebt(params); },
    settleDebt: function() { return settleDebt(params); },
    archiveDebt: function() { return archiveDebt(params); },
    getDashboardSummary: function() { return getDashboardSummary(); },
    getCollectionSummary: function() { return getCollectionSummary(params); },
    getReceivables: function() { return getReceivables(); },
    getFinancialHistory: function() { return getFinancialHistory(params); },
    getSettings: function() { return getSettings(); },
    updateSettings: function() { return updateSettings(params); },
    getCustomFields: function() { return getCustomFields(); },
    addCustomField: function() { return addCustomField(params); },
    updateCustomField: function() { return updateCustomField(params); },
    archiveCustomField: function() { return archiveCustomField(params); },
    getLists: function() { return getLists(); },
    updateLists: function() { return updateLists(params); },
    importWorkbookSeed: function() { return importWorkbookSeed_(params); }
  };

  if (!routes[action]) {
    throw new Error('Unsupported action: ' + action);
  }
  return routes[action]();
}

function importWorkbookSeed_(params) {
  return withScriptLock_(function() {
    if (isOperationProcessed_(params.operationId)) {
      return { duplicate: true };
    }
    var ss = getSpreadsheet_();
    var allTabs = [
      CONFIG.SHEETS.START_HERE, CONFIG.SHEETS.DASHBOARD, CONFIG.SHEETS.SETTINGS,
      CONFIG.SHEETS.PEOPLE, CONFIG.SHEETS.TRANSACTIONS, CONFIG.SHEETS.EMI_PLANS,
      CONFIG.SHEETS.EMI_SCHEDULE, CONFIG.SHEETS.INVESTMENTS, CONFIG.SHEETS.DEBTS,
      CONFIG.SHEETS.CUSTOM_FIELDS, CONFIG.SHEETS.LISTS, CONFIG.SHEETS.SECURITY,
      CONFIG.SHEETS.ACTIVITY_LOG
    ];
    allTabs.forEach(function(tab) {
      ensureSheetWithSchema_(ss, tab);
    });
    logActivity_(params.operationId, 'Owner', 'System', ss.getId(), 'VERIFY_TABS', 'Verified all workbook tabs and schemas', null);
    return { verified: true };
  });
}

function formatErrorPayload_(err) {
  var raw = (err && err.message) ? String(err.message) : 'Unexpected server error.';
  if (raw.indexOf('PIN_LOCKED|') === 0) {
    var parts = raw.split('|');
    return {
      ok: false,
      code: 'PIN_LOCKED',
      lockedUntil: Number(parts[1] || '0'),
      error: parts.slice(2).join('|')
    };
  }
  if (raw.indexOf('INVALID_PIN|') === 0) {
    var invParts = raw.split('|');
    return {
      ok: false,
      code: 'INVALID_PIN',
      failedAttempts: Number(invParts[1] || '0'),
      error: invParts.slice(2).join('|')
    };
  }
  if (raw.indexOf('PIN_NOT_SET|') === 0) {
    return { ok: false, code: 'PIN_NOT_SET', error: raw.split('|').slice(1).join('|') };
  }
  if (raw.indexOf('AUTH_REQUIRED|') === 0 || raw.indexOf('SESSION_EXPIRED|') === 0) {
    return { ok: false, code: 'SESSION_EXPIRED', error: raw.split('|').slice(1).join('|') };
  }
  if (raw.indexOf('BACKEND_CONFIG_ERROR|') === 0) {
    return { ok: false, code: 'BACKEND_AUTH_REQUIRED', error: raw.split('|').slice(1).join('|') };
  }
  if (raw.toLowerCase().indexOf('permission') !== -1 || raw.toLowerCase().indexOf('authorization') !== -1) {
    return {
      ok: false,
      code: 'BACKEND_AUTH_REQUIRED',
      error: 'Spreadsheet authorization is missing or expired. The owner must open the Apps Script project and authorize permissions once.'
    };
  }
  return { ok: false, error: raw };
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
