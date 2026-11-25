/**
 * DashboardService.gs — Consolidated live spreadsheet payload & financial summaries.
 */
function getDashboardSummary() {
  var ss = getSpreadsheet_();
  var people = getPeople();
  var transactions = getTransactions({});

  // Derive People if People sheet is empty while Transactions exist
  if (people.length === 0 && transactions.length > 0) {
    var seen = {};
    transactions.forEach(function(t) {
      if (t.personId && !seen[t.personId]) {
        seen[t.personId] = true;
        people.push({
          id: t.personId,
          name: t.personName || t.personId,
          relationship: 'Friend',
          defaultCurrency: t.currency || 'INR',
          phone: '',
          email: '',
          notes: '',
          status: 'Active',
          customFields: {},
          createdAt: t.createdAt || '',
          updatedAt: t.updatedAt || ''
        });
      }
    });
  }

  var settings = getSettings();
  settings.lastSyncedAt = new Date().toISOString();

  var rawLogs = getAuditLog(100);
  var activityLog = rawLogs.map(function(r) {
    return {
      id: String(r['Log ID'] || '').trim(),
      operationId: String(r['Operation ID'] || '').trim(),
      timestamp: String(r['Timestamp'] || ''),
      actor: String(r['Actor'] || 'Owner'),
      entityType: String(r['Entity Type'] || ''),
      entityId: String(r['Entity ID'] || ''),
      action: String(r['Action'] || ''),
      summary: String(r['Summary'] || ''),
      details: String(r['Details'] || '')
    };
  });

  return {
    spreadsheetId: ss.getId(),
    title: ss.getName(),
    sheetNames: getSheetNames_(ss),
    dataset: {
      people: people,
      transactions: transactions,
      emiPlans: getEMIPlans(),
      emiSchedule: getEMISchedule({}),
      investments: getInvestments(),
      debts: getDebts(),
      customFields: getCustomFields(),
      settings: settings,
      lists: getLists(),
      activityLog: activityLog
    }
  };
}

function getCollectionSummary(params) {
  var month = (params && params.month) || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  var schedule = getEMISchedule({}).filter(function(i) {
    return i.dueDate && i.dueDate.indexOf(month) === 0;
  });
  return { month: month, installments: schedule };
}

function getReceivables() {
  var people = getPeople();
  var tx = getTransactions({});
  return { people: people, transactions: tx };
}

function getFinancialHistory(params) {
  return getTransactions(params || {});
}
