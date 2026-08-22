'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Loader2,
  Plus,
  Camera,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  const [membersLoading, setMembersLoading] = useState(false);

  // AI NLP input
  const [nlpInput, setNlpInput] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);

  // Form fields
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [descError, setDescError] = useState('');
  const [category, setCategory] = useState('general');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [groupId, setGroupId] = useState(selectedGroupId || '');
  const [paidById, setPaidById] = useState(user?.id || '');
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage'>('equal');
  const [splits, setSplits] = useState<{ userId: string; value: string }[]>([]);
  const [note, setNote] = useState('');

  // Receipt upload
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
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
    setMembersLoading(true);
    async function fetchMembers() {
      try {
        const res = await fetch(`/api/groups/${groupId}`);
        if (res.ok) {
          const data = await res.json();
          const g = data.group || data;
          const memberList = ((g.members || []) as any[]).map((m: any) => ({
            id: m.user?.id || m.userId || m.id,
            name: m.user?.name || m.name || 'Unknown',
          }));
          setMembers(memberList);
          setSplits(memberList.map((m: Member) => ({ userId: m.id, value: '' })));
          // Default paid by to current user if in the group
          const me = memberList.find((m: Member) => m.id === user?.id);
          if (me) setPaidById(me.id);
        }
      } catch {
        // silent
      } finally {
        setMembersLoading(false);
      }
    }
    fetchMembers();
  }, [groupId, user?.id]);

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
        if (data.description) { setDescription(data.description); setDescError(''); }
        if (data.amount) { setAmount(String(data.amount)); setAmountError(''); }
        if (data.category) setCategory(data.category);
        if (data.date) setDate(data.date);
        if (data.splitType) setSplitType(data.splitType);
        toast.success('Expense parsed from your description!');
      } else {
        toast.error('Could not parse expense. Try being more specific, e.g. "₹30 pizza for 3 people"');
      }
    } catch {
      toast.error('AI is currently unavailable. Please fill the form manually.');
    } finally {
      setNlpLoading(false);
    }
  };

  // AI categorize
  const handleCategorize = async () => {
    if (!description.trim()) {
      toast.error('Enter a description first');
      return;
    }
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
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Receipt image must be under 10MB');
      return;
    }
    setReceiptPreview(URL.createObjectURL(file));
    setReceiptLoading(true);
    try {
      const formData = new FormData();
      formData.append('receipt', file);
      const res = await fetch('/api/ai/receipt', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        if (data.description) { setDescription(data.description); setDescError(''); }
        if (data.amount) { setAmount(String(data.amount)); setAmountError(''); }
        if (data.category) setCategory(data.category);
        if (data.date) setDate(data.date);
        toast.success('Receipt scanned successfully!');
      } else {
        toast.error('Could not read receipt. Try a clearer photo.');
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

  // Validate form
  const validate = () => {
    let valid = true;
    if (!description.trim()) {
      setDescError('Please enter what the expense was for');
      valid = false;
    } else {
      setDescError('');
    }
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setAmountError('Please enter a valid amount greater than ₹0');
      valid = false;
    } else {
      setAmountError('');
    }
    if (!groupId) {
      toast.error('Please select a group');
      valid = false;
    }
    return valid;
  };

  // Submit expense
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
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
      if (splitType !== 'equal') {
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
        toast.error('Failed to add expense. Please try again.');
      }
    } catch {
      toast.error('Network error. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const perPerson = amount && !isNaN(parseFloat(amount)) && members.length > 0
    ? (parseFloat(amount) / members.length).toFixed(2)
    : '0.00';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Add Expense</h2>
        <p className="text-sm text-gray-500 mt-1">Record a new expense and split it with your group.</p>
      </div>

      {/* AI Natural Language Input */}
      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-teal-50/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-gray-900 text-sm">Quick Add with AI</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3.5 h-3.5 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-xs">
                  Describe your expense in plain English. AI will extract the amount, category, and split details.
                  <br /><br />
                  Examples: &quot;Paid ₹45 for pizza split equally with Alex and Sam&quot;
                  or &quot;Uber to airport ₹22&quot;
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder='e.g. "Paid ₹45 for pizza split 3 ways"'
                value={nlpInput}
                onChange={(e) => setNlpInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNlpSubmit()}
                className="h-11 bg-white"
                disabled={nlpLoading}
              />
            </div>
            <Button
              onClick={handleNlpSubmit}
              disabled={nlpLoading || !nlpInput.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-4 shrink-0"
            >
              {nlpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Form */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-sm">
                What was it for? <span className="text-red-400">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    id="desc"
                    placeholder="e.g., Dinner at Italian restaurant"
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); setDescError(''); }}
                    className={`h-11 ${descError ? 'border-red-300' : ''}`}
                    autoFocus
                  />
                  {descError && <p className="text-xs text-red-500 mt-1">{descError}</p>}
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0 h-11 w-11"
                        onClick={handleCategorize}
                        disabled={categorizeLoading || !description.trim()}
                      >
                        {categorizeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-600" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Auto-categorize using AI</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="amount" className="text-sm">
                  Amount <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">₹</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setAmountError(''); }}
                    className={`h-11 pl-7 ${amountError ? 'border-red-300' : ''}`}
                  />
                </div>
                {amountError && <p className="text-xs text-red-500 mt-1">{amountError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date" className="text-sm">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-sm">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group & Paid By */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Group <span className="text-red-400">*</span></Label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={groups.length === 0 ? 'Create a group first' : 'Select group'} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.emoji} {g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {groups.length === 0 && (
                  <Button variant="link" size="sm" className="h-auto p-0 text-emerald-600" onClick={() => setView('groups')}>
                    Create a group first
                  </Button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Paid by</Label>
                <Select value={paidById} onValueChange={setPaidById}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={membersLoading ? 'Loading...' : 'Who paid?'} />
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
              <div className="flex items-center gap-2">
                <Label className="text-sm">Split Type</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3.5 h-3.5 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs max-w-xs">
                      <strong>Equal:</strong> Split evenly among all members<br/>
                      <strong>Exact:</strong> Enter specific amounts per person<br/>
                      <strong>Percentage:</strong> Enter percentage each person pays
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
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
                    size="sm"
                  >
                    {type === 'equal' ? 'Equal' : type === 'exact' ? 'Exact ₹' : 'Percentage %'}
                  </Button>
                ))}
              </div>
            </div>

            {/* Split Details */}
            {splitType !== 'equal' && members.length > 0 && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <Label className="text-sm font-medium">
                  Split Details {splitType === 'percentage' ? '(%)' : '(₹)'}
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
                          placeholder="0"
                          value={split?.value || ''}
                          onChange={(e) => updateSplit(m.id, e.target.value)}
                          className="h-9"
                        />
                        <span className="text-xs text-gray-400 w-4">{splitType === 'percentage' ? '%' : '₹'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {splitType === 'equal' && members.length > 0 && (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <p className="text-sm text-emerald-700">
                  Split equally among <strong>{members.length}</strong> member{members.length !== 1 ? 's' : ''}: <strong>₹{perPerson}</strong> each
                </p>
              </div>
            )}

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="note" className="text-sm">Note <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Textarea
                id="note"
                placeholder="Any additional details..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Receipt Upload */}
            <div className="space-y-1.5">
              <Label className="text-sm">Receipt <span className="text-gray-400 font-normal">(optional)</span></Label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleReceiptUpload}
                    disabled={receiptLoading}
                  />
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors">
                    {receiptLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    ) : (
                      <Camera className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-600">Upload receipt photo</span>
                  </div>
                </label>
                {receiptPreview && (
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
                    <img src={receiptPreview} alt="Receipt" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
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
