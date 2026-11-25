export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | string;

export type ThemeMode = 'light' | 'dark' | 'system';

export type TransactionType =
  | 'Lending'
  | 'Repayment'
  | 'Interest Earned'
  | 'Interest Adjustment'
  | 'Fee'
  | 'Other Adjustment';

export type TransactionMode = 'One-time' | 'EMI';

export type TransactionStatus = 'Active' | 'Reversed' | 'Archived';

export type EMIFrequency = 'Monthly' | 'Weekly' | 'Biweekly' | 'Quarterly' | 'Custom';

export type EMIPlanType = 'Fixed' | 'Flexible';

export type EMIPlanStatus = 'Active' | 'Paused' | 'Completed' | 'Cancelled';

export type EMIInstallmentStatus =
  | 'Pending'
  | 'Paid'
  | 'Partially Paid'
  | 'Overdue'
  | 'Skipped'
  | 'Rescheduled';

export type CustomFieldEntity =
  | 'People'
  | 'Transactions'
  | 'EMI Plans'
  | 'EMI Schedule'
  | 'Investments'
  | 'Debts';

export type CustomFieldType =
  | 'Short text'
  | 'Long text'
  | 'Number'
  | 'Currency'
  | 'Date'
  | 'Dropdown'
  | 'Checkbox'
  | 'Yes/No';

export interface Person {
  id: string; // e.g., P001
  name: string;
  relationship: string;
  defaultCurrency: CurrencyCode;
  phone: string;
  email: string;
  notes: string;
  status: 'Active' | 'Inactive' | 'Archived';
  customFields: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string; // e.g., T001
  date: string; // ISO YYYY-MM-DD or '' if legacy undated
  personId: string;
  personName: string;
  transactionType: TransactionType;
  transactionMode: TransactionMode;
  description: string;
  amount: number;
  currency: CurrencyCode;
  inrEquivalent: number | null;
  category: string;
  paymentMethod: string;
  referenceNumber: string;
  notes: string;
  emiPlanId?: string;
  emiInstallmentId?: string;
  reducesPrincipal?: boolean; // true for Interest Adjustment marked as balance reduction (like T005)
  status: TransactionStatus;
  reversedTransactionId?: string;
  customFields: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface EMIPlan {
  id: string; // e.g., EMI001
  personId: string;
  personName: string;
  planName: string;
  planType: EMIPlanType;
  totalPrincipal: number;
  installmentAmount: number;
  currency: CurrencyCode;
  frequency: EMIFrequency;
  customIntervalDays?: number;
  startDate: string;
  firstDueDate: string;
  dueDay: number;
  numberOfInstallments: number;
  endDate: string;
  interestRateOrAmount: number;
  processingFee: number;
  status: EMIPlanStatus;
  notes: string;
  customFields: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface EMIInstallment {
  id: string; // e.g., INS001
  emiPlanId: string;
  personId: string;
  personName: string;
  installmentNumber: number;
  dueDate: string; // ISO YYYY-MM-DD
  scheduledAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency: CurrencyCode;
  status: EMIInstallmentStatus;
  linkedTransactionIds: string[];
  paidDate?: string;
  notes: string;
  customFields: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface Investment {
  id: string; // e.g., INV001
  name: string;
  category: string;
  investmentDate: string;
  amountInvested: number;
  currency: CurrencyCode;
  currentValue: number | null;
  currentValueCurrency: CurrencyCode;
  status: 'Active' | 'Exited' | 'Archived';
  notes: string;
  customFields: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface Debt {
  id: string; // e.g., DBT001
  creditor: string;
  description: string;
  date: string;
  amount: number;
  currency: CurrencyCode;
  amountPaid: number;
  outstandingAmount: number;
  status: 'Active' | 'Settled' | 'Archived';
  notes: string;
  customFields: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldDefinition {
  id: string;
  entity: CustomFieldEntity;
  label: string;
  key: string;
  fieldType: CustomFieldType;
  options: string[]; // for Dropdown
  required: boolean;
  visible: boolean;
  order: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  appName: string;
  defaultCurrency: CurrencyCode;
  supportedCurrencies: CurrencyCode[];
  exchangeRatesToINR: Record<string, number>; // e.g. { INR: 1, USD: 84.5, EUR: 91.2, GBP: 107.4, AED: 23.0 }
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  numberFormat: 'en-IN' | 'en-US';
  theme: ThemeMode;
  language: string;
  sessionTimeoutMinutes: number;
  pinLength: number;
  treatInterestAdjustmentAsBalanceReductionDefault: boolean;
  biometricEnabled: boolean;
  lastSyncedAt?: string;
}

export interface ListsConfig {
  transactionTypes: TransactionType[];
  categories: string[];
  paymentMethods: string[];
  emiFrequencies: EMIFrequency[];
  currencies: CurrencyCode[];
  relationshipTypes: string[];
  investmentCategories: string[];
  paymentStatuses: EMIInstallmentStatus[];
}

export interface ActivityLogEntry {
  id: string;
  operationId: string;
  timestamp: string;
  actor: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  details?: string;
}

export interface FinanceDataset {
  people: Person[];
  transactions: Transaction[];
  emiPlans: EMIPlan[];
  emiSchedule: EMIInstallment[];
  investments: Investment[];
  debts: Debt[];
  customFields: CustomFieldDefinition[];
  settings: AppSettings;
  lists: ListsConfig;
  activityLog: ActivityLogEntry[];
}

export type SyncState = 'synced' | 'syncing' | 'failed' | 'offline' | 'pending';

export interface PendingSyncOperation {
  operationId: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
  description: string;
  retries: number;
  lastError?: string;
}

export interface PersonFinancialSummary {
  person: Person;
  totalLentDisplay: number;
  totalRepaidDisplay: number;
  principalOutstandingDisplay: number;
  interestEarnedDisplay: number;
  interestOutstandingDisplay: number;
  totalLentByCurrency: Record<string, number>;
  principalOutstandingByCurrency: Record<string, number>;
  activeEmiPlansCount: number;
  nextEmiDueDate: string | null;
  nextEmiAmount: number | null;
  nextEmiCurrency: CurrencyCode | null;
  emiStatusSummary: 'On Track' | 'Due Today' | 'Overdue' | 'Completed' | 'No EMI';
  hasReconciliationNote: boolean;
}

export interface DateRangeFilter {
  preset: 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'all' | 'custom';
  startDate?: string;
  endDate?: string;
}
