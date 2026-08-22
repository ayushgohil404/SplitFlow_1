'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Upload,
  Loader2,
  Plus,
  Trash2,
  Camera,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

interface Group {
  id: string;
  name: string;
  emoji: string;
}

interface Member {
  id: string;
  name: string;
}

const CATEGORIES = [
  { value: 'food', label: '🍕 Food & Dining' },
  { value: 'travel', label: '✈️ Travel' },
  { value: 'housing', label: '🏠 Housing' },
  { value: 'entertainment', label: '🎉 Entertainment' },
  { value: 'utilities', label: '💡 Utilities' },
  { value: 'shopping', label: '🛍️ Shopping' },
  { value: 'transport', label: '🚗 Transport' },
  { value: 'health', label: '🏥 Health' },
  { value: 'education', label: '📚 Education' },
  { value: 'general', label: '📋 General' },
];

export function AddExpenseView() {
  const { selectedGroupId, navigateToGroup, setView, user } = useAppStore();

  // Data
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  // AI NLP input
  const [nlpInput, setNlpInput] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);

  // Form fields
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('general');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [groupId, setGroupId] = useState(selectedGroupId || '');
  const [paidById, setPaidById] = useState(user?.id || '');
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage'>('equal');
  const [splits, setSplits] = useState<{ userId: string; value: string }[]>([]);
  const [note, setNote] = useState('');

  // Receipt upload
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  // AI categorize
  const [categorizeLoading, setCategorizeLoading] = useState(false);

  // Submitting
  const [submitting, setSubmitting] = useState(false);

  // Fetch groups
  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('/api/groups');
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.groups || [];
          setGroups(list);
          if (!selectedGroupId && list.length > 0) {
            setGroupId(list[0].id);
          }
        }
      } catch {
        // silent
      }
    }
    fetchGroups();
  }, [selectedGroupId]);

  // Fetch members when group changes
  useEffect(() => {
    if (!groupId) return;
    async function fetchMembers() {
      try {
        const res = await fetch(`/api/groups/${groupId}`);
        if (res.ok) {
          const data = await res.json();
          const memberList = (data.members || []).map((m: any) => ({ id: m.id, name: m.name }));
          setMembers(memberList);
          // Initialize splits
          setSplits(memberList.map((m: Member) => ({ userId: m.id, value: '' })));
          // Default paid by to current user
        }
      } catch {
        // silent
      }
    }
    fetchMembers();
  }, [groupId]);

  // AI parse expense
  const handleNlpSubmit = async () => {
    if (!nlpInput.trim()) return;
    setNlpLoading(true);
    try {
      const res = await fetch('/api/ai/parse-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nlpInput }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.description) setDescription(data.description);
        if (data.amount) setAmount(String(data.amount));
        if (data.category) setCategory(data.category);
        if (data.date) setDate(data.date);
        if (data.splitType) setSplitType(data.splitType);
        if (data.paidById) setPaidById(data.paidById);
        toast.success('Expense parsed!');
      } else {
        toast.error('Could not parse expense');
      }
    } catch {
      toast.error('Failed to parse expense');
    } finally {
      setNlpLoading(false);
    }
  };

  // AI categorize
  const handleCategorize = async () => {
    if (!description.trim()) return;
    setCategorizeLoading(true);
    try {
      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.category) {
          setCategory(data.category);
          toast.success(`Categorized as ${data.category}`);
        }
      }
    } catch {
      toast.error('Failed to categorize');
    } finally {
      setCategorizeLoading(false);
    }
  };

  // Receipt upload
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
    setReceiptLoading(true);
    try {
      const formData = new FormData();
      formData.append('receipt', file);
      const res = await fetch('/api/ai/receipt', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.description) setDescription(data.description);
        if (data.amount) setAmount(String(data.amount));
        if (data.category) setCategory(data.category);
        if (data.date) setDate(data.date);
        toast.success('Receipt scanned!');
      }
    } catch {
      toast.error('Failed to scan receipt');
    } finally {
      setReceiptLoading(false);
    }
  };

  // Update split value
  const updateSplit = (userId: string, value: string) => {
    setSplits((prev) => prev.map((s) => (s.userId === userId ? { ...s, value } : s)));
  };

  // Submit expense
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || !groupId) {
      toast.error('Please fill in required fields');
      return;
    }
    setSubmitting(true);
    try {
      const body: any = {
        description: description.trim(),
        amount: parseFloat(amount),
        category,
        date,
        groupId,
        paidById,
        splitType,
        note: note.trim(),
      };
      if (splitType === 'exact' || splitType === 'percentage') {
        body.splits = splits.map((s) => ({
          userId: s.userId,
          value: parseFloat(s.value) || 0,
        }));
      }
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success('Expense added!');
        if (groupId) {
          navigateToGroup(groupId);
        } else {
          setView('dashboard');
        }
      } else {
        toast.error('Failed to add expense');
      }
    } catch {
      toast.error('Failed to add expense');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedGroup = groups.find((g) => g.id === groupId);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Add Expense</h2>
        <p className="text-sm text-gray-500 mt-1">Record a new expense to split with your group.</p>
      </div>

      {/* AI Natural Language Input */}
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-gray-900 text-sm">AI-Powered Input</h3>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                placeholder='Describe your expense... e.g. "Paid $45 for pizza split equally with Alex and Sam"'
                value={nlpInput}
                onChange={(e) => setNlpInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNlpSubmit()}
                className="h-11 pr-10 bg-white"
              />
            </div>
            <Button
              onClick={handleNlpSubmit}
              disabled={nlpLoading || !nlpInput.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-4"
            >
              {nlpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Form */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="desc">Description *</Label>
              <div className="flex gap-2">
                <Input
                  id="desc"
                  placeholder="What was the expense for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="h-11"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-11 w-11"
                  onClick={handleCategorize}
                  disabled={categorizeLoading || !description.trim()}
                  title="AI Categorize"
                >
                  {categorizeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-600" />}
                </Button>
              </div>
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="h-11 pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group & Paid By */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Group *</Label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.emoji} {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Paid By</Label>
                <Select value={paidById} onValueChange={setPaidById}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Who paid?" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Split Type */}
            <div className="space-y-2">
              <Label>Split Type</Label>
              <div className="flex gap-2">
                {(['equal', 'exact', 'percentage'] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={splitType === type ? 'default' : 'outline'}
                    className={
                      splitType === type
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : ''
                    }
                    onClick={() => setSplitType(type)}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Split Details */}
            {splitType !== 'equal' && members.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Split Details {splitType === 'percentage' ? '(%)' : '($)'}
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {members.map((m) => {
                    const split = splits.find((s) => s.userId === m.id);
                    return (
                      <div key={m.id} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-32 truncate shrink-0">{m.name}</span>
                        <Input
                          type="number"
                          step={splitType === 'percentage' ? '1' : '0.01'}
                          min="0"
                          placeholder={splitType === 'percentage' ? '0' : '0.00'}
                          value={split?.value || ''}
                          onChange={(e) => updateSplit(m.id, e.target.value)}
                          className="h-9"
                        />
                        <span className="text-xs text-gray-400 w-4">{splitType === 'percentage' ? '%' : '$'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {splitType === 'equal' && members.length > 0 && (
              <p className="text-sm text-gray-500">
                Split equally among {members.length} members: ${amount ? (parseFloat(amount) / members.length).toFixed(2) : '0.00'} each
              </p>
            )}

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                placeholder="Any additional details..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>

            {/* Receipt Upload */}
            <div className="space-y-2">
              <Label>Receipt (optional)</Label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleReceiptUpload}
                  />
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors">
                    {receiptLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    ) : (
                      <Camera className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-600">Upload receipt</span>
                  </div>
                </label>
                {receiptPreview && (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden border">
                    <img src={receiptPreview} alt="Receipt" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={submitting || !description.trim() || !amount || !groupId}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding Expense...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Expense
                </div>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
