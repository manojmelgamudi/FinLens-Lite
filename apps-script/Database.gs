/**
 * Database.gs — Batch spreadsheet access, header-mapped reads/writes, LockService, and ID generation.
 * Uses the deploying spreadsheet owner's SpreadsheetApp authorization.
 */
function normalizeSpreadsheetId_(raw) {
  var value = String(raw || '').trim();
  if (!value) return '';
  var match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return value;
}

function getSpreadsheet_() {
  var propId = normalizeSpreadsheetId_(
    PropertiesService.getScriptProperties().getProperty(CONFIG.PROP_KEYS.SPREADSHEET_ID)
  );
  if (propId) {
    return SpreadsheetApp.openById(propId);
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('BACKEND_CONFIG_ERROR|No spreadsheet bound. Set SPREADSHEET_ID in Apps Script ScriptProperties or bind this script to your Google Sheet.');
  }
  return active;
}

function withScriptLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function getSheetNames_(ss) {
  return ss.getSheets().map(function(s) {
    return s.getName();
  });
}

function ensureSheetWithSchema_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  var expectedHeaders = SCHEMAS[sheetName] || [];
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (expectedHeaders.length > 0) {
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  // Non-destructive migration: append missing columns without overwriting existing data
  if (expectedHeaders.length > 0) {
    var lastCol = Math.max(1, sheet.getLastColumn());
    var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var headerSet = {};
    for (var i = 0; i < currentHeaders.length; i++) {
      headerSet[String(currentHeaders[i]).trim()] = true;
    }
    var missing = [];
    for (var j = 0; j < expectedHeaders.length; j++) {
      if (!headerSet[expectedHeaders[j]]) {
        missing.push(expectedHeaders[j]);
      }
    }
    if (missing.length > 0) {
      sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
    }
  }
  return sheet;
}

function findHeaderRowIndex_(values, expectedFirstCol) {
  for (var r = 0; r < Math.min(values.length, 10); r++) {
    if (String(values[r][0]).trim() === expectedFirstCol) {
      return r;
    }
  }
  return 0;
}

function readRecords_(sheetName) {
  var ss = getSpreadsheet_();
  var sheet = ensureSheetWithSchema_(ss, sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return [];

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var expectedFirst = (SCHEMAS[sheetName] && SCHEMAS[sheetName][0]) || '';
  var headerIdx = expectedFirst ? findHeaderRowIndex_(values, expectedFirst) : 0;
  var headers = values[headerIdx].map(function(h) { return String(h).trim(); });

  var records = [];
  for (var r = headerIdx + 1; r < values.length; r++) {
    var row = values[r];
    var hasAny = row.some(function(cell) { return cell !== '' && cell !== null; });
    if (!hasAny) continue;
    var obj = { _rowNumber: r + 1 };
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) {
        obj[headers[c]] = row[c];
      }
    }
    records.push(obj);
  }
  return records;
}

function appendRecordRow_(sheetName, recordObj) {
  var ss = getSpreadsheet_();
  var sheet = ensureSheetWithSchema_(ss, sheetName);
  var lastRow = Math.max(1, sheet.getLastRow());
  var lastCol = Math.max(1, sheet.getLastColumn());
  var values = sheet.getRange(1, 1, Math.min(lastRow, 10), lastCol).getValues();
  var expectedFirst = (SCHEMAS[sheetName] && SCHEMAS[sheetName][0]) || '';
  var headerIdx = expectedFirst ? findHeaderRowIndex_(values, expectedFirst) : 0;
  var headers = values[headerIdx].map(function(h) { return String(h).trim(); });

  var row = headers.map(function(h) {
    return recordObj.hasOwnProperty(h) ? recordObj[h] : '';
  });
  sheet.appendRow(row);
}

function updateRecordRowById_(sheetName, idHeader, idValue, updatesObj) {
  var ss = getSpreadsheet_();
  var sheet = ensureSheetWithSchema_(ss, sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return false;

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headerIdx = findHeaderRowIndex_(values, idHeader);
  var headers = values[headerIdx].map(function(h) { return String(h).trim(); });
  var idColIdx = headers.indexOf(idHeader);
  if (idColIdx === -1) return false;

  for (var r = headerIdx + 1; r < values.length; r++) {
    if (String(values[r][idColIdx]).trim() === String(idValue).trim()) {
      var updatedRow = values[r].slice();
      for (var key in updatesObj) {
        if (updatesObj.hasOwnProperty(key)) {
          var colIdx = headers.indexOf(key);
          if (colIdx !== -1) {
            updatedRow[colIdx] = updatesObj[key];
          }
        }
      }
      sheet.getRange(r + 1, 1, 1, headers.length).setValues([updatedRow]);
      return true;
    }
  }
  return false;
}

function generateNextId_(sheetName, idHeader, prefix, padLength) {
  var records = readRecords_(sheetName);
  var maxNum = 0;
  var re = new RegExp('^' + prefix + '(\\d+)$');
  records.forEach(function(rec) {
    var val = String(rec[idHeader] || '').trim();
    var m = val.match(re);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });
  var next = String(maxNum + 1);
  while (next.length < (padLength || 3)) {
    next = '0' + next;
  }
  return prefix + next;
}

function parseJsonSafe_(str, fallback) {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(String(str));
  } catch (e) {
    return fallback;
  }
}

function formatDateCell_(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(val).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return s;
}
