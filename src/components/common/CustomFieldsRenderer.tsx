import React from 'react';
import { CustomFieldDefinition, CustomFieldEntity } from '../../types/finance';

interface CustomFieldsRendererProps {
  entity: CustomFieldEntity;
  definitions: CustomFieldDefinition[];
  values: Record<string, string | number | boolean>;
  onChange: (nextValues: Record<string, string | number | boolean>) => void;
}

export const CustomFieldsRenderer: React.FC<CustomFieldsRendererProps> = ({
  entity,
  definitions,
  values,
  onChange,
}) => {
  const fields = definitions
    .filter((f) => f.entity === entity && !f.archived && f.visible)
    .sort((a, b) => a.order - b.order);

  if (fields.length === 0) return null;

  const setVal = (key: string, val: string | number | boolean) => {
    onChange({ ...values, [key]: val });
  };

  return (
    <div className="pt-3 border-t border-[#E7EAF0] dark:border-[#30343D] space-y-3">
      <p className="text-xs font-semibold text-[#747B8A] dark:text-[#9CA3AF]">Custom Fields</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((field, idx) => {
          const val = values[field.key];
          const inputClass =
            'w-full rounded-full border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-4 py-2.5 text-sm text-[#171A22] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/40';

          return (
            <div
              key={`${field.id || 'cf'}-${idx}`}
              className={field.fieldType === 'Long text' ? 'sm:col-span-2' : ''}
            >
              <label className="block text-xs font-medium text-[#747B8A] dark:text-[#9CA3AF] mb-1">
                {field.label}
                {field.required && <span className="text-[#DC2626] ml-1">*</span>}
              </label>

              {field.fieldType === 'Short text' && (
                <input
                  type="text"
                  required={field.required}
                  value={String(val ?? '')}
                  onChange={(e) => setVal(field.key, e.target.value)}
                  className={inputClass}
                />
              )}

              {field.fieldType === 'Long text' && (
                <textarea
                  rows={2}
                  required={field.required}
                  value={String(val ?? '')}
                  onChange={(e) => setVal(field.key, e.target.value)}
                  className="w-full rounded-2xl border border-[#E7EAF0] dark:border-[#30343D] bg-[#F7F8FA] dark:bg-[#101216] px-3.5 py-2.5 text-sm text-[#171A22] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/40"
                />
              )}

              {(field.fieldType === 'Number' || field.fieldType === 'Currency') && (
                <input
                  type="number"
                  step="any"
                  required={field.required}
                  value={val === undefined || val === null ? '' : String(val)}
                  onChange={(e) => setVal(field.key, e.target.value === '' ? '' : Number(e.target.value))}
                  className={`${inputClass} tabular-nums`}
                />
              )}

              {field.fieldType === 'Date' && (
                <input
                  type="date"
                  required={field.required}
                  value={String(val ?? '')}
                  onChange={(e) => setVal(field.key, e.target.value)}
                  className={inputClass}
                />
              )}

              {field.fieldType === 'Dropdown' && (
                <select
                  required={field.required}
                  value={String(val ?? '')}
                  onChange={(e) => setVal(field.key, e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select {field.label}</option>
                  {field.options.map((opt, oIdx) => (
                    <option key={`${opt}-${oIdx}`} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              {field.fieldType === 'Checkbox' && (
                <label className="inline-flex items-center gap-2.5 min-h-[40px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    onChange={(e) => setVal(field.key, e.target.checked)}
                    className="h-4 w-4 rounded border-[#E7EAF0] text-[#1677FF] focus:ring-[#1677FF]"
                  />
                  <span className="text-sm text-[#171A22] dark:text-[#F8FAFC]">Enabled</span>
                </label>
              )}

              {field.fieldType === 'Yes/No' && (
                <select
                  required={field.required}
                  value={String(val ?? '')}
                  onChange={(e) => setVal(field.key, e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
