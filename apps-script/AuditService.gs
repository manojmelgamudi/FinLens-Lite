/**
 * AuditService.gs — Audit trail wrapper & duplicate-write protection.
 */
function recordAuditEvent(operationId, actor, entityType, entityId, action, summary, details) {
  return logActivity_(operationId, actor, entityType, entityId, action, summary, details);
}

function getAuditLog(limit) {
  var rows = readRecords_(CONFIG.SHEETS.ACTIVITY_LOG);
  rows.reverse();
  if (limit && limit > 0) {
    return rows.slice(0, limit);
  }
  return rows;
}
