/**
 * ValidationService.gs & AuditService.gs
 */
function validatePositiveAmount_(amount, allowZero) {
  var num = Number(amount);
  if (!isFinite(num) || (allowZero ? num < 0 : num <= 0)) {
    throw new Error('Amount must be a valid positive number.');
  }
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function validateCurrency_(currency) {
  var cur = String(currency || 'INR').trim().toUpperCase();
  if (!cur || cur.length > 6) {
    throw new Error('Invalid currency code.');
  }
  return cur;
}

function validateIsoDate_(dateStr, allowEmpty) {
  var s = String(dateStr || '').trim();
  if (!s) {
    if (allowEmpty) return '';
    throw new Error('A valid date is required.');
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) {
    throw new Error('Date must be in ISO YYYY-MM-DD format.');
  }
  return s.slice(0, 10);
}

function assertPersonExists_(personId) {
  var people = readRecords_(CONFIG.SHEETS.PEOPLE);
  for (var i = 0; i < people.length; i++) {
    if (String(people[i]['Person ID']).trim() === String(personId).trim()) {
      return people[i];
    }
  }
  throw new Error('Person ID ' + personId + ' does not exist.');
}

function isOperationProcessed_(operationId) {
  if (!operationId) return false;
  var logs = readRecords_(CONFIG.SHEETS.ACTIVITY_LOG);
  for (var i = 0; i < logs.length; i++) {
    if (String(logs[i]['Operation ID']).trim() === String(operationId).trim()) {
      return true;
    }
  }
  return false;
}

function logActivity_(operationId, actor, entityType, entityId, action, summary, details) {
  var logId = generateNextId_(CONFIG.SHEETS.ACTIVITY_LOG, 'Log ID', 'LOG', 4);
  appendRecordRow_(CONFIG.SHEETS.ACTIVITY_LOG, {
    'Log ID': logId,
    'Operation ID': operationId || Utilities.getUuid(),
    'Timestamp': new Date().toISOString(),
    'Actor': actor || 'Owner',
    'Entity Type': entityType,
    'Entity ID': entityId,
    'Action': action,
    'Summary': summary,
    'Details': details ? JSON.stringify(details) : ''
  });
}
