/**
 * PeopleService.gs — Dynamic People management preserving existing Person IDs (P001+).
 */
function getPeople() {
  return readRecords_(CONFIG.SHEETS.PEOPLE).map(mapPersonRow_);
}

function getPerson(params) {
  var id = String(params.personId || '').trim();
  var people = getPeople();
  for (var i = 0; i < people.length; i++) {
    if (people[i].id === id) return people[i];
  }
  throw new Error('Person not found.');
}

function addPerson(params) {
  return withScriptLock_(function() {
    if (isOperationProcessed_(params.operationId)) {
      return { duplicate: true };
    }
    var name = String(params.name || '').trim();
    if (!name) throw new Error('Person name is required.');

    var now = new Date().toISOString();
    var id = generateNextId_(CONFIG.SHEETS.PEOPLE, 'Person ID', 'P', 3);
    var record = {
      'Person ID': id,
      'Name': name,
      'Relationship': String(params.relationship || 'Friend').trim(),
      'Default Currency': validateCurrency_(params.defaultCurrency || 'INR'),
      'Phone': String(params.phone || '').trim(),
      'Email': String(params.email || '').trim(),
      'Notes': String(params.notes || '').trim(),
      'Status': String(params.status || 'Active').trim(),
      'Custom Fields JSON': JSON.stringify(params.customFields || {}),
      'Created At': now,
      'Updated At': now
    };
    appendRecordRow_(CONFIG.SHEETS.PEOPLE, record);
    logActivity_(params.operationId, 'Owner', 'Person', id, 'CREATE', 'Added person ' + name, record);
    return mapPersonRow_(record);
  });
}

function updatePerson(params) {
  return withScriptLock_(function() {
    if (isOperationProcessed_(params.operationId)) {
      return { duplicate: true };
    }
    var id = String(params.id || '').trim();
    assertPersonExists_(id);
    var now = new Date().toISOString();
    var updates = {
      'Name': String(params.name || '').trim(),
      'Relationship': String(params.relationship || '').trim(),
      'Default Currency': validateCurrency_(params.defaultCurrency || 'INR'),
      'Phone': String(params.phone || '').trim(),
      'Email': String(params.email || '').trim(),
      'Notes': String(params.notes || '').trim(),
      'Status': String(params.status || 'Active').trim(),
      'Custom Fields JSON': JSON.stringify(params.customFields || {}),
      'Updated At': now
    };
    updateRecordRowById_(CONFIG.SHEETS.PEOPLE, 'Person ID', id, updates);
    logActivity_(params.operationId, 'Owner', 'Person', id, 'UPDATE', 'Updated person ' + updates.Name, updates);
    return getPerson({ personId: id });
  });
}

function archivePerson(params) {
  return withScriptLock_(function() {
    var id = String(params.id || '').trim();
    assertPersonExists_(id);
    updateRecordRowById_(CONFIG.SHEETS.PEOPLE, 'Person ID', id, {
      'Status': 'Archived',
      'Updated At': new Date().toISOString()
    });
    logActivity_(params.operationId, 'Owner', 'Person', id, 'ARCHIVE', 'Archived person ' + id, null);
    return { success: true, id: id };
  });
}

function restorePerson(params) {
  return withScriptLock_(function() {
    var id = String(params.id || '').trim();
    assertPersonExists_(id);
    updateRecordRowById_(CONFIG.SHEETS.PEOPLE, 'Person ID', id, {
      'Status': 'Active',
      'Updated At': new Date().toISOString()
    });
    logActivity_(params.operationId, 'Owner', 'Person', id, 'RESTORE', 'Restored person ' + id, null);
    return { success: true, id: id };
  });
}

function mapPersonRow_(row) {
  return {
    id: String(row['Person ID'] || '').trim(),
    name: String(row['Name'] || '').trim(),
    relationship: String(row['Relationship'] || '').trim(),
    defaultCurrency: String(row['Default Currency'] || 'INR').trim(),
    phone: String(row['Phone'] || '').trim(),
    email: String(row['Email'] || '').trim(),
    notes: String(row['Notes'] || '').trim(),
    status: String(row['Status'] || 'Active').trim(),
    customFields: parseJsonSafe_(row['Custom Fields JSON'], {}),
    createdAt: String(row['Created At'] || ''),
    updatedAt: String(row['Updated At'] || '')
  };
}
