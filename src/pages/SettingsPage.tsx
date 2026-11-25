import React, { useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  Database,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  ListChecks,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../hooks/useTheme';
import { authApi } from '../services/apiClient';
import {
  AppSettings,
  CustomFieldEntity,
  CustomFieldType,
  ListsConfig,
  ThemeMode,
} from '../types/finance';
import { exportFullWorkbookXLSX, exportJSONBackup } from '../utils/exportUtils';

type SettingsTab = 'general' | 'people' | 'fields' | 'lists' | 'security' | 'sync';

interface SettingsPageProps {
  onAddPerson: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onAddPerson }) => {
  const {
    dataset,
    authStatus,
    spreadsheetTitle,
    syncState,
    syncError,
    pendingQueue,
    syncNow,
    retryPendingQueue,
    performSyncAction,
    lockApp,
    pushToast,
  } = useFinance();

  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<SettingsTab>('general');

  // General form
  const [appName, setAppName] = useState(
    dataset.settings.appName && dataset.settings.appName !== 'FinLens Lite'
      ? dataset.settings.appName
      : 'FinLens'
  );
  const [defaultCurrency, setDefaultCurrency] = useState(dataset.settings.defaultCurrency || 'INR');
  const [usdRate, setUsdRate] = useState(String(dataset.settings.exchangeRatesToINR?.USD || 84.5));
  const [dateFormat, setDateFormat] = useState<AppSettings['dateFormat']>(dataset.settings.dateFormat || 'DD/MM/YYYY');
  const [numberFormat, setNumberFormat] = useState<AppSettings['numberFormat']>(dataset.settings.numberFormat || 'en-IN');
  const [sessionTimeout, setSessionTimeout] = useState(String(dataset.settings.sessionTimeoutMinutes || 15));

  // Custom Fields builder
  const [cfEntity, setCfEntity] = useState<CustomFieldEntity>('Transactions');
  const [cfLabel, setCfLabel] = useState('');
  const [cfType, setCfType] = useState<CustomFieldType>('Short text');
  const [cfOptions, setCfOptions] = useState('');
  const [cfRequired, setCfRequired] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldLabel, setEditingFieldLabel] = useState('');

  // Lists editor
  const [selectedList, setSelectedList] = useState<keyof ListsConfig>('categories');
  const [newListItem, setNewListItem] = useState('');

  // Security: Change PIN
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  const saveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = Number(usdRate) || 84.5;
    await performSyncAction(
      'updateSettings',
      {
        settings: {
          ...dataset.settings,
          appName: appName.trim() || 'FinLens',
          defaultCurrency,
          exchangeRatesToINR: {
            ...dataset.settings.exchangeRatesToINR,
            USD: rateNum,
          },
          dateFormat,
          numberFormat,
          theme,
          sessionTimeoutMinutes: Math.max(1, Number(sessionTimeout) || 15),
        },
      },
      'Updated general settings'
    );
  };

  const handleAddCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfLabel.trim()) return;
    await performSyncAction(
      'addCustomField',
      {
        entity: cfEntity,
        label: cfLabel.trim(),
        fieldType: cfType,
        options:
          cfType === 'Dropdown'
            ? cfOptions
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean)
            : [],
        required: cfRequired,
        visible: true,
        order: dataset.customFields.filter((f) => f.entity === cfEntity).length + 1,
      },
      `Added custom field "${cfLabel.trim()}" to ${cfEntity}`
    );
    setCfLabel('');
    setCfOptions('');
    setCfRequired(false);
  };

  const handleAddListItem = async () => {
    const val = newListItem.trim();
    if (!val) return;
    const currentArr = dataset.lists[selectedList] as string[];
    if (currentArr.includes(val)) return;
    await performSyncAction(
      'updateLists',
      {
        lists: {
          ...dataset.lists,
          [selectedList]: [...currentArr, val],
        },
      },
      `Added "${val}" to ${selectedList}`
    );
    setNewListItem('');
  };

  const handleRemoveListItem = async (item: string) => {
    const currentArr = dataset.lists[selectedList] as string[];
    if (currentArr.length <= 1) return;
    await performSyncAction(
      'updateLists',
      {
        lists: {
          ...dataset.lists,
          [selectedList]: currentArr.filter((x) => x !== item),
        },
      },
      `Removed "${item}" from ${selectedList}`
    );
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinBusy(true);
    try {
      await authApi.changePin(currentPin, newPin, confirmPin);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      pushToast('success', 'PIN changed successfully.');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to change PIN.');
    } finally {
      setPinBusy(false);
    }
  };

  const inputClass =
    'w-full rounded-full border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-4 py-2.5 text-sm text-[#171A22] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30';

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Settings2 className="w-4 h-4" /> },
    { id: 'people', label: 'Manage People', icon: <Users className="w-4 h-4" /> },
    { id: 'fields', label: 'Manage Fields', icon: <SlidersHorizontal className="w-4 h-4" /> },
    { id: 'lists', label: 'Manage Lists', icon: <ListChecks className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <LockKeyhole className="w-4 h-4" /> },
    { id: 'sync', label: 'Data & Sync', icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[#171A22] dark:text-[#F8FAFC]">Settings</h2>
          <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF]">
            Customize currencies, dynamic fields, dropdown lists, PIN security, and Google Sheets sync
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'bg-[#1677FF] text-white shadow-xs'
                : 'bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] text-[#747B8A]'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* 1. General */}
      {tab === 'general' && (
        <form
          onSubmit={saveGeneral}
          className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-6 space-y-5 max-w-2xl"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Application Name</label>
              <input type="text" value={appName} onChange={(e) => setAppName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Default Currency</label>
              <select value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)} className={inputClass}>
                {dataset.lists.currencies.map((c, idx) => <option key={`${c}-${idx}`} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">USD to INR Rate</label>
              <input type="number" step="0.01" min="1" value={usdRate} onChange={(e) => setUsdRate(e.target.value)} className={`${inputClass} tabular-nums`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Theme</label>
              <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeMode)} className={inputClass}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Date Format</label>
              <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as AppSettings['dateFormat'])} className={inputClass}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Number Format</label>
              <select value={numberFormat} onChange={(e) => setNumberFormat(e.target.value as AppSettings['numberFormat'])} className={inputClass}>
                <option value="en-IN">Indian (1,00,000.00)</option>
                <option value="en-US">International (100,000.00)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white"
          >
            <Check className="w-4 h-4" />
            Save General Settings
          </button>
        </form>
      )}

      {/* 2. Manage People */}
      {tab === 'people' && (
        <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">People Directory ({dataset.people.length})</h3>
            <button
              type="button"
              onClick={onAddPerson}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-gradient px-3.5 py-2 text-xs font-semibold text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Person
            </button>
          </div>

          <div className="divide-y divide-[#E7EAF0] dark:divide-[#30343D]">
            {dataset.people.map((p, idx) => (
              <div key={`${p.id || 'p'}-${idx}`} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-[#747B8A]">
                    {p.id} · {p.relationship} · {p.defaultCurrency} · {p.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    performSyncAction(
                      p.status === 'Archived' ? 'restorePerson' : 'archivePerson',
                      { id: p.id },
                      p.status === 'Archived' ? `Restored ${p.name}` : `Archived ${p.name}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] px-3 py-1.5 text-xs font-medium"
                >
                  {p.status === 'Archived' ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 text-[#16A34A]" /> Restore
                    </>
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5 text-[#747B8A]" /> Archive
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Manage Fields */}
      {tab === 'fields' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <form
            onSubmit={handleAddCustomField}
            className="lg:col-span-5 rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5 space-y-4 h-fit"
          >
            <h3 className="text-base font-semibold">Add Custom Field</h3>
            <p className="text-xs text-[#747B8A]">
              Mandatory system fields (Record IDs, Amount, Currency, Date) are protected and cannot be removed.
            </p>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Module / Sheet</label>
              <select value={cfEntity} onChange={(e) => setCfEntity(e.target.value as CustomFieldEntity)} className={inputClass}>
                {(['People', 'Transactions', 'EMI Plans', 'EMI Schedule', 'Investments', 'Debts'] as CustomFieldEntity[]).map((ent) => (
                  <option key={ent} value={ent}>{ent}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Field Label *</label>
              <input type="text" required value={cfLabel} onChange={(e) => setCfLabel(e.target.value)} placeholder="e.g., Collateral / Bank Account" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Field Type</label>
              <select value={cfType} onChange={(e) => setCfType(e.target.value as CustomFieldType)} className={inputClass}>
                {(['Short text', 'Long text', 'Number', 'Currency', 'Date', 'Dropdown', 'Checkbox', 'Yes/No'] as CustomFieldType[]).map((ft) => (
                  <option key={ft} value={ft}>{ft}</option>
                ))}
              </select>
            </div>
            {cfType === 'Dropdown' && (
              <div>
                <label className="block text-xs font-medium text-[#747B8A] mb-1">Dropdown Options (comma separated)</label>
                <input type="text" value={cfOptions} onChange={(e) => setCfOptions(e.target.value)} placeholder="Option A, Option B, Option C" className={inputClass} />
              </div>
            )}
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={cfRequired} onChange={(e) => setCfRequired(e.target.checked)} className="h-4 w-4 rounded" />
              <span>Required field</span>
            </label>
            <button type="submit" className="w-full rounded-xl bg-brand-gradient py-2.5 text-sm font-semibold text-white">
              Add Custom Field
            </button>
          </form>

          <div className="lg:col-span-7 rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5 space-y-3">
            <h3 className="text-base font-semibold">Custom Fields for {cfEntity}</h3>
            {dataset.customFields.filter((f) => f.entity === cfEntity && !f.archived).length === 0 ? (
              <p className="text-xs text-[#747B8A] py-6">
                No custom fields defined for {cfEntity} yet.
              </p>
            ) : (
              <div className="divide-y divide-[#E7EAF0] dark:divide-[#30343D]">
                {(() => {
                  const entityFields = dataset.customFields
                    .filter((f) => f.entity === cfEntity && !f.archived)
                    .sort((a, b) => a.order - b.order);

                  const handleMoveField = async (index: number, direction: -1 | 1) => {
                    const targetIndex = index + direction;
                    if (targetIndex < 0 || targetIndex >= entityFields.length) return;
                    const currentField = entityFields[index];
                    const swapField = entityFields[targetIndex];
                    await performSyncAction(
                      'updateCustomField',
                      { id: currentField.id, order: swapField.order },
                      `Reordered ${currentField.label}`
                    );
                    await performSyncAction(
                      'updateCustomField',
                      { id: swapField.id, order: currentField.order },
                      `Reordered ${swapField.label}`
                    );
                  };

                  return entityFields.map((field, idx) => (
                    <div key={`${field.id || 'cf'}-${idx}`} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {editingFieldId === field.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingFieldLabel}
                              onChange={(e) => setEditingFieldLabel(e.target.value)}
                              className="rounded-full border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                const trimmed = editingFieldLabel.trim();
                                if (!trimmed) return;
                                await performSyncAction(
                                  'updateCustomField',
                                  { id: field.id, label: trimmed },
                                  `Renamed custom field to ${trimmed}`
                                );
                                setEditingFieldId(null);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-brand-gradient text-xs font-semibold text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFieldId(null)}
                              className="px-2 py-1 text-xs text-[#747B8A]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-semibold">{field.label}</p>
                            <p className="text-xs text-[#747B8A]">
                              {field.fieldType} · {field.required ? 'Required' : 'Optional'} · {field.visible ? 'Visible' : 'Hidden'}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveField(idx, -1)}
                          className="p-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] disabled:opacity-30"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === entityFields.length - 1}
                          onClick={() => handleMoveField(idx, 1)}
                          className="p-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] disabled:opacity-30"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFieldId(field.id);
                            setEditingFieldLabel(field.label);
                          }}
                          className="p-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D]"
                          title="Rename field"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            performSyncAction(
                              'updateCustomField',
                              { id: field.id, visible: !field.visible },
                              `Toggled visibility for ${field.label}`
                            )
                          }
                          className="p-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D]"
                          title={field.visible ? 'Hide field' : 'Show field'}
                        >
                          {field.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-[#747B8A]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            performSyncAction('archiveCustomField', { id: field.id }, `Archived field ${field.label}`)
                          }
                          className="p-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-[#DC2626]"
                          title="Archive field"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Manage Lists */}
      {tab === 'lists' && (
        <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5 space-y-4 max-w-2xl">
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedList}
              onChange={(e) => setSelectedList(e.target.value as keyof ListsConfig)}
              className={`${inputClass} sm:w-52 shrink-0`}
            >
              <option value="categories">Categories</option>
              <option value="paymentMethods">Payment Methods</option>
              <option value="currencies">Currencies</option>
              <option value="relationshipTypes">Relationship Types</option>
              <option value="investmentCategories">Investment Categories</option>
              <option value="transactionTypes">Transaction Types</option>
              <option value="emiFrequencies">EMI Frequencies</option>
            </select>
            <div className="flex gap-2 flex-1">
              <input
                type="text"
                value={newListItem}
                onChange={(e) => setNewListItem(e.target.value)}
                placeholder="Add new item..."
                className={inputClass}
              />
              <button
                type="button"
                onClick={handleAddListItem}
                className="px-4 py-2 rounded-xl bg-brand-gradient text-xs font-semibold text-white shrink-0"
              >
                Add
              </button>
            </div>
          </div>

          <div className="divide-y divide-[#E7EAF0] dark:divide-[#30343D]">
            {(dataset.lists[selectedList] as string[]).map((item, idx) => (
              <div key={`${item}-${idx}`} className="py-2.5 flex items-center justify-between text-sm">
                <span>{item}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveListItem(item)}
                  className="text-xs text-[#DC2626] hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Security */}
      {tab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <form
            onSubmit={handleChangePin}
            className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#1677FF]" />
              <h3 className="text-base font-semibold">Change PIN</h3>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Current PIN</label>
              <input type="password" inputMode="numeric" required value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">New PIN (4–8 digits)</label>
              <input type="password" inputMode="numeric" required value={newPin} onChange={(e) => setNewPin(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">Confirm New PIN</label>
              <input type="password" inputMode="numeric" required value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} className={inputClass} />
            </div>
            <button type="submit" disabled={pinBusy} className="rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white">
              {pinBusy ? 'Updating...' : 'Update PIN'}
            </button>
          </form>

          <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5 space-y-4">
            <h3 className="text-base font-semibold">Session & Recovery</h3>
            <div>
              <label className="block text-xs font-medium text-[#747B8A] mb-1">
                Inactivity Timeout (minutes)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={saveGeneral}
                  className="px-4 py-2 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-xs font-semibold shrink-0"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-[#F7F8FA] dark:bg-[#101216] p-3.5 text-xs text-[#747B8A] space-y-1">
              <p className="font-semibold text-[#171A22] dark:text-[#F8FAFC]">Owner Recovery Procedure</p>
              <p>
                PIN reset is restricted to the spreadsheet owner. Run{' '}
                <span className="font-mono">ownerResetPin()</span> inside your Google Apps Script Editor or configure{' '}
                <span className="font-mono">FINANCE_RECOVERY_KEY</span> in server Secrets.
              </p>
            </div>

            <button
              type="button"
              onClick={lockApp}
              className="w-full rounded-xl border border-[#DC2626]/30 text-[#DC2626] py-2.5 text-sm font-semibold hover:bg-[#DC2626]/5"
            >
              Lock & Logout
            </button>
          </div>
        </div>
      )}

      {/* 6. Data & Sync */}
      {tab === 'sync' && (
        <div className="space-y-4">
          <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">
                  Google Spreadsheet: {spreadsheetTitle || 'Private Owner Spreadsheet'}
                </h3>
                <p className="text-xs text-[#747B8A] mt-0.5">
                  Sync status: <strong className="text-[#171A22] dark:text-[#F8FAFC]">{syncState}</strong>
                  {dataset.settings.lastSyncedAt &&
                    ` · Last synced ${new Date(dataset.settings.lastSyncedAt).toLocaleTimeString()}`}
                </p>
                {syncError && <p className="text-xs text-[#DC2626] mt-1">{syncError}</p>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => syncNow()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-gradient px-3.5 py-2 text-xs font-semibold text-white"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
                  Sync Now
                </button>
              </div>
            </div>

            {pendingQueue.length > 0 && (
              <div className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/5 p-3.5 flex items-center justify-between gap-3">
                <div className="text-xs">
                  <p className="font-semibold text-[#F59E0B]">
                    {pendingQueue.length} pending offline change(s)
                  </p>
                  <p className="text-[#747B8A]">Will sync automatically when online, or click Retry.</p>
                </div>
                <button
                  type="button"
                  onClick={() => retryPendingQueue()}
                  className="px-3.5 py-1.5 rounded-xl bg-[#F59E0B] text-white text-xs font-semibold"
                >
                  Retry Sync
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E7EAF0] dark:border-[#30343D]">
              <button
                type="button"
                onClick={() => exportFullWorkbookXLSX(dataset)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] px-3.5 py-2 text-xs font-semibold"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#16A34A]" />
                Export Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => exportJSONBackup(dataset)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] px-3.5 py-2 text-xs font-semibold"
              >
                <Download className="w-4 h-4 text-[#1677FF]" />
                Download JSON Backup
              </button>
              <button
                type="button"
                onClick={() =>
                  performSyncAction(
                    'importWorkbookSeed',
                    {},
                    'Verified all workbook tabs and schemas'
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] px-3.5 py-2 text-xs font-semibold"
              >
                Verify Worksheet Schemas
              </button>
            </div>
          </div>

          <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5 space-y-2 text-xs text-[#747B8A]">
            <p className="text-sm font-semibold text-[#171A22] dark:text-[#F8FAFC]">
              Google Apps Script Web App Backend
            </p>
            <p>
              Connection status:{' '}
              <strong className="text-[#171A22] dark:text-[#F8FAFC]">
                {authStatus?.backendConfigured ? 'Connected (Owner Apps Script Web App)' : 'Configuration required'}
              </strong>
            </p>
            <p>
              Spreadsheet reads and writes execute server-side under the spreadsheet owner&apos;s Apps Script authorization. Website visitors only authenticate with your application PIN.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
