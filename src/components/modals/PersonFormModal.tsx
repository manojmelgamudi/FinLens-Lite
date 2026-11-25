import React, { useEffect, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Person } from '../../types/finance';
import { BottomSheet } from '../common/BottomSheet';
import { CustomFieldsRenderer } from '../common/CustomFieldsRenderer';

interface PersonFormModalProps {
  open: boolean;
  onClose: () => void;
  editingPerson?: Person | null;
}

export const PersonFormModal: React.FC<PersonFormModalProps> = ({
  open,
  onClose,
  editingPerson,
}) => {
  const { dataset, performSyncAction } = useFinance();
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Friend');
  const [defaultCurrency, setDefaultCurrency] = useState(dataset.settings.defaultCurrency || 'INR');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Person['status']>('Active');
  const [customFields, setCustomFields] = useState<Record<string, string | number | boolean>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingPerson) {
      setName(editingPerson.name);
      setRelationship(editingPerson.relationship || 'Friend');
      setDefaultCurrency(editingPerson.defaultCurrency || 'INR');
      setPhone(editingPerson.phone || '');
      setEmail(editingPerson.email || '');
      setNotes(editingPerson.notes || '');
      setStatus(editingPerson.status || 'Active');
      setCustomFields(editingPerson.customFields || {});
      setShowAdvanced(Boolean(editingPerson.phone || editingPerson.email || editingPerson.notes));
    } else {
      setName('');
      setRelationship(dataset.lists.relationshipTypes[0] || 'Friend');
      setDefaultCurrency(dataset.settings.defaultCurrency || 'INR');
      setPhone('');
      setEmail('');
      setNotes('');
      setStatus('Active');
      setCustomFields({});
      setShowAdvanced(false);
    }
  }, [open, editingPerson, dataset.settings.defaultCurrency, dataset.lists.relationshipTypes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      id: editingPerson?.id,
      name: name.trim(),
      relationship,
      defaultCurrency,
      phone: phone.trim(),
      email: email.trim(),
      notes: notes.trim(),
      status,
      customFields,
    };
    const ok = await performSyncAction(
      editingPerson ? 'updatePerson' : 'addPerson',
      payload,
      editingPerson ? `Updated ${name.trim()}` : `Added ${name.trim()}`
    );
    setSaving(false);
    if (ok) onClose();
  };

  const inputClass =
    'w-full rounded-full border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-4 py-2.5 text-sm text-[#171A22] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/40';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editingPerson ? `Edit ${editingPerson.name}` : 'Add Person'}
      subtitle={editingPerson ? `ID: ${editingPerson.id}` : 'Person ID is generated automatically in Google Sheets'}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E7EAF0] dark:border-[#30343D] text-sm font-medium text-[#747B8A] dark:text-[#9CA3AF]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="person-form"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-brand-gradient text-sm font-semibold text-white shadow-xs hover:opacity-95 disabled:opacity-50"
          >
            {saving ? 'Saving...' : editingPerson ? 'Save Changes' : 'Add Person'}
          </button>
        </div>
      }
    >
      <form id="person-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-xs font-medium text-[#DC2626] bg-[#DC2626]/5 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div>
          <label className="block text-xs font-medium text-[#747B8A] dark:text-[#9CA3AF] mb-1">
            Full Name <span className="text-[#DC2626]">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Arjun Mehta"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#747B8A] dark:text-[#9CA3AF] mb-1">
              Relationship
            </label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className={inputClass}
            >
              {dataset.lists.relationshipTypes.map((r, idx) => (
                <option key={`${r}-${idx}`} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#747B8A] dark:text-[#9CA3AF] mb-1">
              Default Currency
            </label>
            <select
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
              className={inputClass}
            >
              {dataset.lists.currencies.map((c, idx) => (
                <option key={`${c}-${idx}`} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="text-xs font-semibold text-[#1677FF] hover:underline"
        >
          {showAdvanced ? 'Hide optional details' : '+ Add phone, email, status & notes'}
        </button>

        {showAdvanced && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#747B8A] dark:text-[#9CA3AF] mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#747B8A] dark:text-[#9CA3AF] mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#747B8A] dark:text-[#9CA3AF] mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Person['status'])}
                className={inputClass}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#747B8A] dark:text-[#9CA3AF] mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                className="w-full rounded-2xl border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-3.5 py-2.5 text-sm text-[#171A22] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/40"
              />
            </div>
          </div>
        )}

        <CustomFieldsRenderer
          entity="People"
          definitions={dataset.customFields}
          values={customFields}
          onChange={setCustomFields}
        />
      </form>
    </BottomSheet>
  );
};
