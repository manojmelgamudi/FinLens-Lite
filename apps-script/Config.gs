/**
 * Config.gs — Worksheet definitions, column schemas, and security property keys.
 * Preserves existing Personal_Financial_Tracker_Enhanced_v3.xlsx worksheet tabs.
 */
var CONFIG = {
  SHEETS: {
    START_HERE: 'Start Here',
    DASHBOARD: 'Dashboard',
    SETTINGS: 'Settings',
    PEOPLE: 'People',
    TRANSACTIONS: 'Transactions',
    EMI_PLANS: 'EMI Plans',
    EMI_SCHEDULE: 'EMI Schedule',
    INVESTMENTS: 'Investments',
    DEBTS: 'Debts',
    CUSTOM_FIELDS: 'Custom Fields',
    LISTS: 'Lists',
    SECURITY: 'Security',
    ACTIVITY_LOG: 'Activity Log'
  },
  PROP_KEYS: {
    SPREADSHEET_ID: 'SPREADSHEET_ID',
    API_SECRET: 'API_SECRET',
    PIN_HASH: 'PIN_HASH',
    PIN_SALT: 'PIN_SALT',
    PIN_LENGTH: 'PIN_LENGTH',
    FAILED_ATTEMPTS: 'FAILED_ATTEMPTS',
    LOCKOUT_UNTIL: 'LOCKOUT_UNTIL',
    SESSION_TIMEOUT_MINUTES: 'SESSION_TIMEOUT_MINUTES'
  },
  LOCK_TIMEOUT_MS: 20000,
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 5 * 60 * 1000
};

var SCHEMAS = {
  'People': [
    'Person ID', 'Name', 'Relationship', 'Default Currency', 'Phone', 'Email',
    'Notes', 'Status', 'Custom Fields JSON', 'Created At', 'Updated At'
  ],
  'Transactions': [
    'Transaction ID', 'Date', 'Person ID', 'Person Name', 'Transaction Type',
    'Transaction Mode', 'Description', 'Amount', 'Currency', 'INR Equivalent',
    'Category', 'Payment Method', 'Reference / Notes', 'EMI Plan ID',
    'EMI Installment ID', 'Reduces Principal', 'Status', 'Reversed Transaction ID',
    'Custom Fields JSON', 'Created At', 'Updated At'
  ],
  'EMI Plans': [
    'EMI Plan ID', 'Person ID', 'Person Name', 'Plan Name', 'Plan Type',
    'Total Principal', 'Installment Amount', 'Currency', 'Frequency',
    'Custom Interval Days', 'Start Date', 'First Due Date', 'Due Day',
    'Number of Installments', 'End Date', 'Interest', 'Processing Fee',
    'Status', 'Notes', 'Custom Fields JSON', 'Created At', 'Updated At'
  ],
  'EMI Schedule': [
    'Installment ID', 'EMI Plan ID', 'Person ID', 'Person Name', 'Installment Number',
    'Due Date', 'Scheduled Amount', 'Paid Amount', 'Remaining Amount', 'Currency',
    'Status', 'Linked Transaction IDs', 'Paid Date', 'Notes',
    'Custom Fields JSON', 'Created At', 'Updated At'
  ],
  'Investments': [
    'Investment ID', 'Name', 'Category', 'Investment Date', 'Amount Invested',
    'Currency', 'Current Value', 'Current Value Currency', 'Status', 'Notes',
    'Custom Fields JSON', 'Created At', 'Updated At'
  ],
  'Debts': [
    'Debt ID', 'Creditor', 'Description', 'Date', 'Amount', 'Currency',
    'Amount Paid', 'Outstanding Amount', 'Status', 'Notes',
    'Custom Fields JSON', 'Created At', 'Updated At'
  ],
  'Custom Fields': [
    'Field ID', 'Entity', 'Label', 'Key', 'Field Type', 'Options JSON',
    'Required', 'Visible', 'Order', 'Archived', 'Created At', 'Updated At'
  ],
  'Settings': ['Key', 'Value'],
  'Lists': ['List Name', 'Values JSON'],
  'Security': ['Setting', 'Value', 'Updated At'],
  'Activity Log': [
    'Log ID', 'Operation ID', 'Timestamp', 'Actor', 'Entity Type',
    'Entity ID', 'Action', 'Summary', 'Details'
  ]
};
