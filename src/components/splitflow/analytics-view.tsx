'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, TrendingUp, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { toast } from 'sonner';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  paidBy: { id: string; name: string };
  groupId: string;
}

interface Group {
  id: string;
  name: string;
  emoji: string;
}

const CHART_COLORS = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#0ea5e9', // sky
  '#f97316', // orange
  '#14b8a6', // teal
  '#84cc16', // lime
];

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food & Dining',
  travel: 'Travel',
  housing: 'Housing',
  entertainment: 'Entertainment',
  utilities: 'Utilities',
  shopping: 'Shopping',
  transport: 'Transport',
  health: 'Health',
  education: 'Education',
  general: 'General',
};

const DATE_RANGES = [
  { value: 'month', label: 'This Month' },
  { value: '3months', label: 'Last 3 Months' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

function getDateFilter(range: string) {
  const now = new Date();
  switch (range) {
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return start.toISOString();
    }
    case '3months': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      return start.toISOString();
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1);
      return start.toISOString();
    }
    default:
      return '1970-01-01';
  }
}

export function AnalyticsView() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [dateRange, setDateRange] = useState('month');
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, grpRes] = await Promise.allSettled([
        fetch('/api/expenses/history'),
        fetch('/api/groups'),
      ]);
      if (expRes.status === 'fulfilled' && expRes.value.ok) {
        const data = await expRes.value.json();
        setExpenses(Array.isArray(data) ? data : data.expenses || []);
      }
      if (grpRes.status === 'fulfilled' && grpRes.value.ok) {
        const data = await grpRes.value.json();
        setGroups(Array.isArray(data) ? data : data.groups || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredExpenses = useMemo(() => {
    let filtered = expenses;
    if (selectedGroupId !== 'all') {
      filtered = filtered.filter((e) => e.groupId === selectedGroupId);
    }
    const dateFilter = getDateFilter(dateRange);
    filtered = filtered.filter((e) => new Date(e.date) >= new Date(dateFilter));
    return filtered;
  }, [expenses, selectedGroupId, dateRange]);

  const totalSpent = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  // Category breakdown for pie chart
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      const cat = e.category || 'general';
      map[cat] = (map[cat] || 0) + e.amount;
    });
    return Object.entries(map)
      .map(([cat, amount]) => ({
        name: CATEGORY_LABELS[cat] || cat,
        value: amount,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // Monthly trend
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + e.amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));
  }, [filteredExpenses]);

  // Per-member data
  const memberData = useMemo(() => {
    const paidMap: Record<string, { name: string; total: number }> = {};
    filteredExpenses.forEach((e) => {
      const name = e.paidBy?.name || 'Unknown';
      if (!paidMap[name]) paidMap[name] = { name, total: 0 };
      paidMap[name].total += e.amount;
    });
    return Object.values(paidMap).sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  const handleAIInsights = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroupId !== 'all' ? selectedGroupId : undefined,
          dateRange,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiInsights(data.insights || data.text || 'No insights available.');
      } else {
        toast.error('Failed to get insights');
      }
    } catch {
      toast.error('Failed to get insights');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.emoji} {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-gray-500">Total spending</p>
          <p className="text-3xl font-bold text-gray-900">₹{totalSpent.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">{filteredExpenses.length} expenses</p>
        </CardContent>
      </Card>

      {/* Charts */}
      {filteredExpenses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No expenses to analyze</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Pie Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryData.map((_entry, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `₹${value.toFixed(2)}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="flex flex-wrap gap-3 mt-2 justify-center">
                {categoryData.map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-1.5 text-xs">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="text-gray-600">{cat.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => {
                        const [y, m] = v.split('-');
                        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        return months[parseInt(m) - 1];
                      }}
                    />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip formatter={(value: number) => `₹${value.toFixed(2)}`} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#10b981' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Categories horizontal bar */}
      {categoryData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Spending Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, categoryData.length * 40)}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                <Tooltip formatter={(value: number) => `₹${value.toFixed(2)}`} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {categoryData.map((_entry, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-member comparison */}
      {memberData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Who Paid Most</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {memberData.map((m, i) => {
              const maxTotal = memberData[0].total;
              const pct = maxTotal > 0 ? (m.total / maxTotal) * 100 : 0;
              return (
                <div key={m.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 font-medium">{m.name}</span>
                    <span className="text-gray-900 font-semibold">₹{m.total.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full bg-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />AI Insights
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAIInsights}
              disabled={aiLoading}
              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              Generate Insights
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              <span className="ml-2 text-sm text-gray-500">Analyzing your spending...</span>
            </div>
          ) : aiInsights ? (
            <div className="prose prose-sm prose-gray max-w-none">
              {aiInsights.split('\n').map((line, i) => (
                <p key={i} className={line.startsWith('#') ? 'font-bold text-base mt-4 mb-2' : line.startsWith('-') ? 'ml-4' : ''}>
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              Click &quot;Generate Insights&quot; to get AI-powered analysis of your spending.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
