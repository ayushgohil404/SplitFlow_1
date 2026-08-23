'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  User,
  Receipt,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const CATEGORY_EMOJIS: Record<string, string> = {
  food: '🍕',
  travel: '✈️',
  housing: '🏠',
  entertainment: '🎉',
  utilities: '💡',
  shopping: '🛍️',
  transport: '🚗',
  health: '🏥',
  education: '📚',
  general: '📋',
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'group', label: 'Groups' },
  { value: 'direct', label: 'Direct' },
];

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'food', label: '🍕 Food' },
  { value: 'travel', label: '✈️ Travel' },
  { value: 'housing', label: '🏠 Housing' },
  { value: 'entertainment', label: '🎉 Fun' },
  { value: 'utilities', label: '💡 Utilities' },
  { value: 'shopping', label: '🛍️ Shopping' },
  { value: 'transport', label: '🚗 Transport' },
  { value: 'health', label: '🏥 Health' },
  { value: 'education', label: '📚 Education' },
];

export function HistoryView() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(0);
  const limit = 30;

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(page * limit),
        });
        if (filter !== 'all') params.set('filter', filter);
        if (search.trim()) params.set('search', search.trim());
        if (category !== 'all') params.set('category', category);

        const res = await fetch(`/api/expenses/history?${params}`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
          setTotal(typeof data.total === 'number' ? data.total : 0);
        } else if (!cancelled) {
          toast.error('Failed to load history');
        }
      } catch {
        if (!cancelled) toast.error('Failed to load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [filter, search, category, page]);

  // Group by date using useMemo to avoid re-computing on every render
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const exp of expenses) {
      try {
        const d = new Date(exp.date || Date.now());
        const key = d.toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        if (!map[key]) map[key] = [];
        map[key].push(exp);
      } catch {
        // skip
      }
    }
    return map;
  }, [expenses]);

  const totalPages = Math.ceil(total / limit);
  const totalAmount = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Expense History</h2>
        <p className="text-sm text-muted-foreground mt-1">All your expenses across groups and direct splits.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
          <p className="text-xs text-primary font-medium">Total Expenses</p>
          <p className="text-2xl font-bold text-foreground mt-1">{expenses.length}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
          <p className="text-xs text-blue-400 font-medium">Total Amount</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">
            {'₹'}{(Number(totalAmount) || 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="rounded-xl border bg-background p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="h-10 pl-9"
          />
        </div>
        {/* Filter buttons - no Radix Select to avoid v2 compatibility issues */}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={filter === opt.value ? 'default' : 'outline'}
              size="sm"
              className={filter === opt.value
                ? 'bg-primary hover:bg-primary/90 text-white text-xs h-7 px-2.5'
                : 'text-xs h-7 px-2.5'
              }
              onClick={() => { setFilter(opt.value); setPage(0); }}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={category === opt.value ? 'default' : 'outline'}
              size="sm"
              className={category === opt.value
                ? 'bg-primary hover:bg-primary/90 text-white text-xs h-7 px-2.5'
                : 'text-xs h-7 px-2.5'
              }
              onClick={() => { setCategory(opt.value); setPage(0); }}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Expense List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="rounded-xl border bg-background p-12 text-center">
          <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No expenses found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || filter !== 'all' || category !== 'all'
              ? 'Try adjusting your filters'
              : 'Add your first expense to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateKey, dayExpenses]) => (
            <div key={dateKey}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{dateKey}</p>
                <div className="flex-1 h-px bg-muted" />
              </div>
              <div className="space-y-2">
                {dayExpenses.map((exp: any) => {
                  const splitCount = (Array.isArray(exp.splits) ? exp.splits.length : 0)
                    + (Array.isArray(exp.nonUserSplits) ? exp.nonUserSplits.length : 0);
                  const amount = Number(exp.amount) || 0;
                  const desc = String(exp.description || 'Expense');
                  const cat = String(exp.category || 'other');
                  const splitType = String(exp.splitType || 'equal');
                  const paidByName = (exp.paidBy && exp.paidBy.name) ? String(exp.paidBy.name) : 'You';
                  const groupName = (exp.group && exp.group.name) ? String(exp.group.name) : '';
                  const groupEmoji = (exp.group && exp.group.emoji) ? String(exp.group.emoji) : '';
                  const nonUserCount = Array.isArray(exp.nonUserSplits) ? exp.nonUserSplits.length : 0;

                  return (
                    <div
                      key={String(exp.id || Math.random())}
                      className="rounded-xl border bg-background p-4 flex items-center gap-3 hover:shadow-sm transition-shadow"
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <span className="text-lg">{CATEGORY_EMOJIS[cat] || '📋'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{desc}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {groupName ? (
                            <span className="text-[10px] font-medium px-1.5 py-0 h-4 rounded bg-muted text-muted-foreground inline-flex items-center">
                              {groupEmoji} {groupName}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0 h-4 rounded border border-emerald-200 text-primary inline-flex items-center">
                              <User className="w-2.5 h-2.5 mr-0.5" /> Direct
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {paidByName} paid
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            {splitType === 'equal' ? 'equal split' : splitType} with {splitCount}
                          </span>
                        </div>
                        {nonUserCount > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              {nonUserCount} email participant{nonUserCount > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-foreground shrink-0">
                        {'₹'}{amount.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(Math.max(0, page - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
