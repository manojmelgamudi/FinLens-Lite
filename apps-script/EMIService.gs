/**
 * EMIService.gs — Complete EMI Plan & Installment schedule engine with atomic payment linkage.
 */
function getEMIPlans() {
  return readRecords_(CONFIG.SHEETS.EMI_PLANS).map(mapEMIPlanRow_);
}

function getEMISchedule(params) {
  var list = readRecords_(CONFIG.SHEETS.EMI_SCHEDULE).map(mapInstallmentRow_);
  if (params && params.emiPlanId) {
    list = list.filter(function(i) { return i.emiPlanId === params.emiPlanId; });
  }
  return list;
}

function createEMIPlan(params) {
  return withScriptLock_(function() {
    if (isOperationProcessed_(params.operationId)) {
      return { duplicate: true };
    }
    var person = assertPersonExists_(params.personId);
    var totalPrincipal = validatePositiveAmount_(params.totalPrincipal, false);
    var count = Math.max(1, Math.floor(Number(params.numberOfInstallments || 1)));
    var currency = validateCurrency_(params.currency || 'INR');
    var startDate = validateIsoDate_(params.startDate, false);
    var firstDueDate = validateIsoDate_(params.firstDueDate || startDate, false);
    var now = new Date().toISOString();
    var planId = generateNextId_(CONFIG.SHEETS.EMI_PLANS, 'EMI Plan ID', 'EMI', 3);

    var planRecord = {
      'EMI Plan ID': planId,
      'Person ID': person['Person ID'],
      'Person Name': person['Name'],
      'Plan Name': String(params.planName || 'EMI Plan').trim(),
      'Plan Type': String(params.planType || 'Fixed'),
      'Total Principal': totalPrincipal,
      'Installment Amount': validatePositiveAmount_(params.installmentAmount || (totalPrincipal / count), false),
      'Currency': currency,
      'Frequency': String(params.frequency || 'Monthly'),
      'Custom Interval Days': Number(params.customIntervalDays || 30),
      'Start Date': startDate,
      'First Due Date': firstDueDate,
      'Due Day': Number(params.dueDay || Number(firstDueDate.slice(8, 10))),
      'Number of Installments': count,
      'End Date': String(params.endDate || ''),
      'Interest': Number(params.interestRateOrAmount || 0),
      'Processing Fee': Number(params.processingFee || 0),
      'Status': 'Active',
      'Notes': String(params.notes || ''),
      'Custom Fields JSON': JSON.stringify(params.customFields || {}),
      'Created At': now,
      'Updated At': now
    };
    appendRecordRow_(CONFIG.SHEETS.EMI_PLANS, planRecord);

    var schedule = params.installments || [];
    for (var i = 0; i < schedule.length; i++) {
      var item = schedule[i];
      var instId = planId + '-I' + ('0' + (i + 1)).slice(-2);
      appendRecordRow_(CONFIG.SHEETS.EMI_SCHEDULE, {
        'Installment ID': instId,
        'EMI Plan ID': planId,
        'Person ID': person['Person ID'],
        'Person Name': person['Name'],
        'Installment Number': i + 1,
        'Due Date': validateIsoDate_(item.dueDate, false),
        'Scheduled Amount': validatePositiveAmount_(item.scheduledAmount, false),
        'Paid Amount': 0,
        'Remaining Amount': validatePositiveAmount_(item.scheduledAmount, false),
        'Currency': currency,
        'Status': item.status || 'Pending',
        'Linked Transaction IDs': '[]',
        'Paid Date': '',
        'Notes': '',
        'Custom Fields JSON': '{}',
        'Created At': now,
        'Updated At': now
      });
    }

    logActivity_(params.operationId, 'Owner', 'EMIPlan', planId, 'CREATE', 'Created EMI Plan ' + planRecord['Plan Name'], planRecord);
    return { plan: mapEMIPlanRow_(planRecord), scheduleCount: schedule.length };
  });
}

function recordEMIPayment(params) {
  return withScriptLock_(function() {
    if (isOperationProcessed_(params.operationId)) {
      return { duplicate: true };
    }
    var allocations = params.allocations || [];
    if (!allocations.length) throw new Error('At least one installment allocation is required.');

    var paymentDate = validateIsoDate_(params.paymentDate, false);
    var scheduleRows = getEMISchedule({});
    var createdTransactions = [];

    for (var a = 0; a < allocations.length; a++) {
      var alloc = allocations[a];
      var inst = null;
      for (var s = 0; s < scheduleRows.length; s++) {
        if (scheduleRows[s].id === alloc.installmentId) {
          inst = scheduleRows[s];
          break;
        }
      }
      if (!inst) throw new Error('Installment not found: ' + alloc.installmentId);
      if (inst.remainingAmount <= 0.01) throw new Error('Installment ' + inst.id + ' is already paid.');

      var amt = validatePositiveAmount_(alloc.appliedAmount, false);
      if (amt > inst.remainingAmount + 0.01) {
        throw new Error('Allocated payment exceeds remaining amount on ' + inst.id);
      }

      var tx = addTransaction({
        operationId: params.operationId + '-' + inst.id,
        personId: inst.personId,
        date: paymentDate,
        transactionType: 'Repayment',
        transactionMode: 'EMI',
        description: (params.planName || 'EMI') + ' · Installment #' + inst.installmentNumber,
        amount: amt,
        currency: inst.currency,
        category: 'EMI Repayment',
        paymentMethod: params.paymentMethod || '',
        notes: params.notes || '',
        emiPlanId: inst.emiPlanId,
        emiInstallmentId: inst.id
      });
      createdTransactions.push(tx);

      var newPaid = Math.round((inst.paidAmount + amt) * 100) / 100;
      var newRem = Math.max(0, Math.round((inst.scheduledAmount - newPaid) * 100) / 100);
      var newStatus = newRem <= 0.01 ? 'Paid' : 'Partially Paid';
      var linked = inst.linkedTransactionIds.concat([tx.id]);

      updateRecordRowById_(CONFIG.SHEETS.EMI_SCHEDULE, 'Installment ID', inst.id, {
        'Paid Amount': newPaid,
        'Remaining Amount': newRem,
        'Status': newStatus,
        'Linked Transaction IDs': JSON.stringify(linked),
        'Paid Date': paymentDate,
        'Updated At': new Date().toISOString()
      });
    }

    logActivity_(params.operationId, 'Owner', 'EMIPayment', params.emiPlanId || '', 'PAYMENT', 'Recorded EMI payment', createdTransactions);
    return { success: true, transactions: createdTransactions };
  });
}

function updateInstallment(params) {
  return withScriptLock_(function() {
    var id = String(params.id || '').trim();
    var updates = {
      'Due Date': validateIsoDate_(params.dueDate, false),
      'Scheduled Amount': validatePositiveAmount_(params.scheduledAmount, false),
      'Remaining Amount': Math.max(0, Number(params.scheduledAmount) - Number(params.paidAmount || 0)),
      'Status': String(params.status || 'Pending'),
      'Notes': String(params.notes || ''),
      'Updated At': new Date().toISOString()
    };
    updateRecordRowById_(CONFIG.SHEETS.EMI_SCHEDULE, 'Installment ID', id, updates);
    logActivity_(params.operationId, 'Owner', 'EMIInstallment', id, 'UPDATE', 'Updated installment ' + id, updates);
    return { success: true };
  });
}

function updateEMIPlanStatus_(planId, status, operationId) {
  return withScriptLock_(function() {
    updateRecordRowById_(CONFIG.SHEETS.EMI_PLANS, 'EMI Plan ID', planId, {
      'Status': status,
      'Updated At': new Date().toISOString()
    });
    logActivity_(operationId, 'Owner', 'EMIPlan', planId, 'STATUS', 'Set EMI plan status to ' + status, null);
    return { success: true };
  });
}

function pauseEMIPlan(params) { return updateEMIPlanStatus_(params.id, 'Paused', params.operationId); }
function resumeEMIPlan(params) { return updateEMIPlanStatus_(params.id, 'Active', params.operationId); }
function cancelEMIPlan(params) { return updateEMIPlanStatus_(params.id, 'Cancelled', params.operationId); }
function completeEMIPlan(params) { return updateEMIPlanStatus_(params.id, 'Completed', params.operationId); }

function mapEMIPlanRow_(row) {
  return {
    id: String(row['EMI Plan ID'] || '').trim(),
    personId: String(row['Person ID'] || '').trim(),
    personName: String(row['Person Name'] || '').trim(),
    planName: String(row['Plan Name'] || '').trim(),
    planType: String(row['Plan Type'] || 'Fixed').trim() || 'Fixed',
    totalPrincipal: Number(row['Total Principal']) || 0,
    installmentAmount: Number(row['Installment Amount']) || 0,
    currency: String(row['Currency'] || 'INR').trim() || 'INR',
    frequency: String(row['Frequency'] || 'Monthly').trim() || 'Monthly',
    customIntervalDays: Number(row['Custom Interval Days']) || 30,
    startDate: formatDateCell_(row['Start Date']),
    firstDueDate: formatDateCell_(row['First Due Date']),
    dueDay: Number(row['Due Day']) || 1,
    numberOfInstallments: Number(row['Number of Installments']) || 1,
    endDate: formatDateCell_(row['End Date']),
    interestRateOrAmount: Number(row['Interest']) || 0,
    processingFee: Number(row['Processing Fee']) || 0,
    status: String(row['Status'] || 'Active').trim() || 'Active',
    notes: String(row['Notes'] || '').trim(),
    customFields: parseJsonSafe_(row['Custom Fields JSON'], {}),
    createdAt: String(row['Created At'] || ''),
    updatedAt: String(row['Updated At'] || '')
  };
}

function mapInstallmentRow_(row) {
  return {
    id: String(row['Installment ID'] || '').trim(),
    emiPlanId: String(row['EMI Plan ID'] || '').trim(),
    personId: String(row['Person ID'] || '').trim(),
    personName: String(row['Person Name'] || '').trim(),
    installmentNumber: Number(row['Installment Number']) || 1,
    dueDate: formatDateCell_(row['Due Date']),
    scheduledAmount: Number(row['Scheduled Amount']) || 0,
    paidAmount: Number(row['Paid Amount']) || 0,
    remainingAmount: Number(row['Remaining Amount']) || 0,
    currency: String(row['Currency'] || 'INR').trim() || 'INR',
    status: String(row['Status'] || 'Pending').trim() || 'Pending',
    linkedTransactionIds: parseJsonSafe_(row['Linked Transaction IDs'], []),
    paidDate: formatDateCell_(row['Paid Date']),
    notes: String(row['Notes'] || '').trim(),
    customFields: parseJsonSafe_(row['Custom Fields JSON'], {}),
    createdAt: String(row['Created At'] || ''),
    updatedAt: String(row['Updated At'] || '')
  };
}
