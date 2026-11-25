/**
 * AuthenticationService.gs — Salted SHA-256 PIN hashing in ScriptProperties,
 * rate limiting, temporary lockout, short-lived session tokens, and owner recovery.
 * Never stores the actual PIN in Google Sheets or frontend code.
 */
function hashPin_(pin, salt) {
  var input = salt + ':' + String(pin);
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  for (var i = 0; i < 1000; i++) {
    digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytesToHex_(digest) + ':' + salt, Utilities.Charset.UTF_8);
  }
  return bytesToHex_(digest);
}

function bytesToHex_(bytes) {
  return bytes.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function constantTimeEqual_(a, b) {
  var strA = String(a);
  var strB = String(b);
  if (strA.length !== strB.length) return false;
  var diff = 0;
  for (var i = 0; i < strA.length; i++) {
    diff |= strA.charCodeAt(i) ^ strB.charCodeAt(i);
  }
  return diff === 0;
}

function getAuthStatus() {
  var props = PropertiesService.getScriptProperties();
  var pinHash = props.getProperty(CONFIG.PROP_KEYS.PIN_HASH);
  var lockoutUntil = Number(props.getProperty(CONFIG.PROP_KEYS.LOCKOUT_UNTIL) || '0');
  var failedAttempts = Number(props.getProperty(CONFIG.PROP_KEYS.FAILED_ATTEMPTS) || '0');
  var pinLength = Number(props.getProperty(CONFIG.PROP_KEYS.PIN_LENGTH) || '4');
  var timeout = Number(props.getProperty(CONFIG.PROP_KEYS.SESSION_TIMEOUT_MINUTES) || '15');

  var spreadsheetReady = true;
  var adminError = '';
  try {
    getSpreadsheet_().getId();
  } catch (err) {
    spreadsheetReady = false;
    adminError = err && err.message ? err.message.replace(/^BACKEND_CONFIG_ERROR\|/, '') : 'Spreadsheet access is not authorized yet.';
  }

  return {
    backendConfigured: spreadsheetReady,
    spreadsheetReady: spreadsheetReady,
    adminError: adminError,
    pinConfigured: Boolean(pinHash),
    lockedUntil: lockoutUntil > Date.now() ? lockoutUntil : 0,
    failedAttempts: failedAttempts,
    pinLength: pinLength,
    sessionTimeoutMinutes: timeout
  };
}

function setupPin(params) {
  return withScriptLock_(function() {
    // Ensure spreadsheet authorization works before committing PIN
    getSpreadsheet_().getId();

    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(CONFIG.PROP_KEYS.PIN_HASH)) {
      throw new Error('PIN is already configured. Please unlock or change PIN in Settings.');
    }
    var pin = String(params.pin || '').trim();
    var confirmPin = String(params.confirmPin || '').trim();
    if (!/^\d{4,8}$/.test(pin)) {
      throw new Error('PIN must be 4 to 8 digits.');
    }
    if (pin !== confirmPin) {
      throw new Error('PIN confirmation does not match.');
    }

    var salt = Utilities.getUuid();
    var hash = hashPin_(pin, salt);
    props.setProperties({
      PIN_HASH: hash,
      PIN_SALT: salt,
      PIN_LENGTH: String(pin.length),
      FAILED_ATTEMPTS: '0',
      LOCKOUT_UNTIL: '0'
    });

    updateSecurityMetadataSheet_('PIN Configured', 'Yes');
    var session = issueSessionToken_();
    logActivity_(params.operationId, 'Owner', 'Security', 'AUTH', 'SETUP_PIN', 'Initial PIN configured', null);
    return { success: true, sessionToken: session.token, expiresAt: session.expiresAt, pinLength: pin.length };
  });
}

function verifyPin(params) {
  return withScriptLock_(function() {
    var props = PropertiesService.getScriptProperties();
    var storedHash = props.getProperty(CONFIG.PROP_KEYS.PIN_HASH);
    var salt = props.getProperty(CONFIG.PROP_KEYS.PIN_SALT);
    if (!storedHash || !salt) {
      throw new Error('PIN_NOT_SET|PIN is not configured yet.');
    }

    var lockoutUntil = Number(props.getProperty(CONFIG.PROP_KEYS.LOCKOUT_UNTIL) || '0');
    if (lockoutUntil > Date.now()) {
      var remainingSec = Math.ceil((lockoutUntil - Date.now()) / 1000);
      throw new Error('PIN_LOCKED|' + lockoutUntil + '|Too many failed attempts. Try again in ' + remainingSec + 's.');
    }

    var pin = String(params.pin || '').trim();
    if (!/^\d{4,8}$/.test(pin)) {
      throw new Error('INVALID_PIN|0|Enter a valid numeric PIN.');
    }

    var candidate = hashPin_(pin, salt);
    if (!constantTimeEqual_(candidate, storedHash)) {
      var attempts = Number(props.getProperty(CONFIG.PROP_KEYS.FAILED_ATTEMPTS) || '0') + 1;
      var updates = { FAILED_ATTEMPTS: String(attempts) };
      if (attempts >= CONFIG.MAX_FAILED_ATTEMPTS) {
        var nextLockUntil = Date.now() + CONFIG.LOCKOUT_DURATION_MS;
        updates.LOCKOUT_UNTIL = String(nextLockUntil);
        updates.FAILED_ATTEMPTS = '0';
        props.setProperties(updates);
        throw new Error('PIN_LOCKED|' + nextLockUntil + '|Maximum attempts reached. Locked for 5 minutes.');
      }
      props.setProperties(updates);
      var left = CONFIG.MAX_FAILED_ATTEMPTS - attempts;
      throw new Error('INVALID_PIN|' + attempts + '|Incorrect PIN (' + left + ' attempts remaining).');
    }

    props.setProperties({ FAILED_ATTEMPTS: '0', LOCKOUT_UNTIL: '0' });
    var session = issueSessionToken_();
    return { success: true, sessionToken: session.token, expiresAt: session.expiresAt };
  });
}

function changePin(params, sessionToken) {
  validateSession({ sessionToken: sessionToken });
  return withScriptLock_(function() {
    var props = PropertiesService.getScriptProperties();
    var storedHash = props.getProperty(CONFIG.PROP_KEYS.PIN_HASH);
    var salt = props.getProperty(CONFIG.PROP_KEYS.PIN_SALT);
    var currentPin = String(params.currentPin || '').trim();
    var newPin = String(params.newPin || '').trim();
    var confirmPin = String(params.confirmPin || '').trim();

    if (!constantTimeEqual_(hashPin_(currentPin, salt), storedHash)) {
      throw new Error('INVALID_PIN|0|Current PIN is incorrect.');
    }
    if (!/^\d{4,8}$/.test(newPin)) {
      throw new Error('New PIN must be 4 to 8 digits.');
    }
    if (newPin !== confirmPin) {
      throw new Error('New PIN confirmation does not match.');
    }

    var newSalt = Utilities.getUuid();
    props.setProperties({
      PIN_HASH: hashPin_(newPin, newSalt),
      PIN_SALT: newSalt,
      PIN_LENGTH: String(newPin.length)
    });
    updateSecurityMetadataSheet_('Last PIN Change', new Date().toISOString());
    logActivity_(params.operationId, 'Owner', 'Security', 'AUTH', 'CHANGE_PIN', 'PIN updated', null);
    return { success: true, pinLength: newPin.length };
  });
}

function issueSessionToken_() {
  var props = PropertiesService.getScriptProperties();
  var timeoutMin = Number(props.getProperty(CONFIG.PROP_KEYS.SESSION_TIMEOUT_MINUTES) || '15');
  var token = Utilities.getUuid() + '-' + Utilities.getUuid();
  var ttlSec = Math.min(21600, Math.max(60, timeoutMin * 60));
  var expiresAt = Date.now() + ttlSec * 1000;
  CacheService.getScriptCache().put('SESSION_' + token, JSON.stringify({ expiresAt: expiresAt }), ttlSec);
  return { token: token, expiresAt: expiresAt };
}

function validateSession(params) {
  var token = String((params && params.sessionToken) || '').trim();
  if (!token) {
    throw new Error('AUTH_REQUIRED|Authentication required. Please unlock with your PIN.');
  }
  var cache = CacheService.getScriptCache();
  var raw = cache.get('SESSION_' + token);
  if (!raw) {
    throw new Error('SESSION_EXPIRED|Session expired. Please unlock with your PIN.');
  }
  var parsed = JSON.parse(raw);
  if (parsed.expiresAt < Date.now()) {
    cache.remove('SESSION_' + token);
    throw new Error('SESSION_EXPIRED|Session expired. Please unlock with your PIN.');
  }
  // Sliding inactivity refresh
  var props = PropertiesService.getScriptProperties();
  var timeoutMin = Number(props.getProperty(CONFIG.PROP_KEYS.SESSION_TIMEOUT_MINUTES) || '15');
  var ttlSec = Math.min(21600, Math.max(60, timeoutMin * 60));
  var nextExpiresAt = Date.now() + ttlSec * 1000;
  cache.put('SESSION_' + token, JSON.stringify({ expiresAt: nextExpiresAt }), ttlSec);
  return { valid: true, expiresAt: nextExpiresAt };
}

function logout(params) {
  var token = String((params && params.sessionToken) || '').trim();
  if (token) {
    CacheService.getScriptCache().remove('SESSION_' + token);
  }
  return { success: true };
}

/**
 * Spreadsheet-owner-only recovery helper (run directly inside Apps Script Editor).
 * Never exposed as a public web endpoint.
 */
function ownerResetPin() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(CONFIG.PROP_KEYS.PIN_HASH);
  props.deleteProperty(CONFIG.PROP_KEYS.PIN_SALT);
  props.setProperty(CONFIG.PROP_KEYS.FAILED_ATTEMPTS, '0');
  props.setProperty(CONFIG.PROP_KEYS.LOCKOUT_UNTIL, '0');
  updateSecurityMetadataSheet_('PIN Reset By Owner', new Date().toISOString());
}

function updateSecurityMetadataSheet_(setting, value) {
  var ss = getSpreadsheet_();
  ensureSheetWithSchema_(ss, CONFIG.SHEETS.SECURITY);
  var records = readRecords_(CONFIG.SHEETS.SECURITY);
  var found = false;
  for (var i = 0; i < records.length; i++) {
    if (String(records[i]['Setting']).trim() === setting) {
      var sheet = ss.getSheetByName(CONFIG.SHEETS.SECURITY);
      sheet.getRange(records[i]._rowNumber, 2, 1, 2).setValues([[value, new Date().toISOString()]]);
      found = true;
      break;
    }
  }
  if (!found) {
    appendRecordRow_(CONFIG.SHEETS.SECURITY, {
      'Setting': setting,
      'Value': value,
      'Updated At': new Date().toISOString()
    });
  }
}
