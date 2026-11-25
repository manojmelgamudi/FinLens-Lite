import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Search, UserPlus } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { Person } from '../types/finance';
import { computePersonSummary, formatCurrency, formatDateDisplay } from '../utils/calculations';

interface PeoplePageProps {
  onSelectPerson: (personId: string) => void;
  onAddPerson: () => void;
  onEditPerson: (person: Person) => void;
}

type PeopleFilter =
  | 'all'
  | 'active'
  | 'inactive'
  | 'archived'
  | 'with_emi'
  | 'without_emi'
  | 'outstanding'
  | 'settled';

type PeopleSort = 'outstanding_desc' | 'name_asc' | 'next_due';

export const PeoplePage: React.FC<PeoplePageProps> = ({
  onSelectPerson,
  onAddPerson,
}) => {
  const { dataset, displayCurrency } = useFinance();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const [sortBy, setSortBy] = useState<PeopleSort>('outstanding_desc');

  const summaries = useMemo(
    () =>
      dataset.people.map((person) =>
        computePersonSummary(
          person,
          dataset.transactions,
          dataset.emiPlans,
          dataset.emiSchedule,
          dataset.settings,
          displayCurrency
        )
      ),
    [dataset, displayCurrency]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summaries
      .filter((s) => {
        if (q && !`${s.person.name} ${s.person.id} ${s.person.relationship}`.toLowerCase().includes(q)) {
          return false;
        }
        switch (filter) {
          case 'active':
            return s.person.status === 'Active';
          case 'inactive':
            return s.person.status === 'Inactive';
          case 'archived':
            return s.person.status === 'Archived';
          case 'with_emi':
            return s.activeEmiPlansCount > 0 && s.person.status !== 'Archived';
          case 'without_emi':
            return s.activeEmiPlansCount === 0 && s.person.status !== 'Archived';
          case 'outstanding':
            return s.principalOutstandingDisplay > 0.01 && s.person.status !== 'Archived';
          case 'settled':
            return s.principalOutstandingDisplay <= 0.01 && s.person.status !== 'Archived';
          default:
            return s.person.status !== 'Archived';
        }
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return a.person.name.localeCompare(b.person.name);
        if (sortBy === 'next_due') {
          if (!a.nextEmiDueDate && !b.nextEmiDueDate) return 0;
          if (!a.nextEmiDueDate) return 1;
          if (!b.nextEmiDueDate) return -1;
          return a.nextEmiDueDate.localeCompare(b.nextEmiDueDate);
        }
        return b.principalOutstandingDisplay - a.principalOutstandingDisplay;
      });
  }, [summaries, search, filter, sortBy]);

  const numFmt = dataset.settings.numberFormat;

  const filterButtons: { id: PeopleFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'outstanding', label: 'Outstanding' },
    { id: 'with_emi', label: 'With EMI' },
    { id: 'without_emi', label: 'No EMI' },
    { id: 'settled', label: 'Settled' },
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'archived', label: 'Archived' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-[#171A22] dark:text-[#F8FAFC]">
          People
        </h2>

        <button
          type="button"
          onClick={onAddPerson}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:opacity-95 active:scale-[0.98] transition whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Person</span>
        </button>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#747B8A] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or relationship..."
            className="w-full rounded-full bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] pl-10 pr-4 py-2.5 text-sm text-[#171A22] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30"
          />
        </div>

        <div className="relative shrink-0">
          <select
            aria-label="Sort people"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as PeopleSort)}
            className="no-auto-chevron w-full sm:w-auto appearance-none rounded-full bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] pl-4 pr-9 py-2.5 text-sm font-medium text-[#171A22] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#1677FF]/30 cursor-pointer"
          >
            <option value="outstanding_desc">Highest Outstanding</option>
            <option value="name_asc">Name (A–Z)</option>
            <option value="next_due">Next EMI Due</option>
          </select>
          <ChevronDown className="w-4 h-4 text-[#747B8A] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Segmented Filter Bar */}
      <div className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#EEF1F6]/90 dark:bg-[#161920] p-1 border border-[#E7EAF0] dark:border-[#30343D] overflow-x-auto">
        {filterButtons.map((btn) => {
          const active = filter === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFilter(btn.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs transition whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-white dark:bg-[#232732] text-[#171A22] dark:text-[#F8FAFC] font-semibold shadow-xs'
                  : 'text-[#747B8A] dark:text-[#9CA3AF] font-medium hover:text-[#171A22] dark:hover:text-[#F8FAFC]'
              }`}
            >
              {btn.label}
            </button>
          );
        })}
      </div>

      {/* People Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-10 text-center">
          <UserPlus className="w-9 h-9 text-[#747B8A]/50 mx-auto mb-2" />
          <p className="text-base font-semibold text-[#171A22] dark:text-[#F8FAFC]">
            No people found
          </p>
          <p className="mt-1 text-xs text-[#747B8A]">
            Adjust your filter or add a new person to start tracking lending and EMIs.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s, idx) => {
            const p = s.person;
            const nativeCur = p.defaultCurrency || 'INR';
            const nativeOutstanding =
              s.principalOutstandingByCurrency[nativeCur] ?? s.principalOutstandingDisplay;

            return (
              <button
                key={`${p.id || 'person'}-${idx}`}
                type="button"
                onClick={() => onSelectPerson(p.id)}
                className="text-left rounded-[20px] bg-white dark:bg-[#1A1D24] border border-[#E7EAF0] dark:border-[#30343D] p-5 shadow-xs hover:border-[#1677FF]/60 transition flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-2xl bg-brand-gradient text-white font-semibold text-base flex items-center justify-center shrink-0">
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-[#171A22] dark:text-[#F8FAFC] truncate">
                        {p.name}
                      </p>
                      <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF]">
                        {p.relationship ? `${p.relationship} · ${nativeCur}` : nativeCur}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#747B8A] shrink-0 mt-1" />
                </div>

                <div className="mt-5">
                  <p className="text-xs text-[#747B8A] dark:text-[#9CA3AF]">Principal Outstanding</p>
                  <p className="mt-0.5 text-2xl font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
                    {formatCurrency(nativeOutstanding, nativeCur, numFmt)}
                  </p>
                  {nativeCur !== displayCurrency && (
                    <p className="text-xs text-[#747B8A] tabular-nums">
                      ≈ {formatCurrency(s.principalOutstandingDisplay, displayCurrency, numFmt)}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#E7EAF0] dark:border-[#30343D] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[#747B8A]">Total Lent</p>
                    <p className="font-semibold text-[#171A22] dark:text-[#F8FAFC] tabular-nums">
                      {formatCurrency(s.totalLentByCurrency[nativeCur] || 0, nativeCur, numFmt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#747B8A]">EMI Status</p>
                    <p
                      className={`font-semibold ${
                        s.emiStatusSummary === 'Overdue'
                          ? 'text-[#DC2626]'
                          : s.emiStatusSummary === 'On Track'
                          ? 'text-[#16A34A]'
                          : 'text-[#747B8A]'
                      }`}
                    >
                      {s.emiStatusSummary}
                      {s.nextEmiDueDate
                        ? ` · ${formatDateDisplay(s.nextEmiDueDate, dataset.settings.dateFormat)}`
                        : ''}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
