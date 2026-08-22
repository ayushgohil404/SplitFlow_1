'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Loader2,
  Plus,
  Camera,
  Info,
  Users,
  Mail,
  X,
  UserPlus,
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
import { Badge } from '@/components/ui/badge';
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
  email?: string;
}

interface Friend {
  id: string;
  name: string;
  email: string;
}

interface EmailParticipant {
  email: string;
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

type ExpenseMode = 'group' | 'direct';

export function AddExpenseView() {
  const { selectedGroupId, navigateToGroup, setView, user } = useAppStore();

  // Expense mode
  const [mode, setMode] = useState<ExpenseMode>(selectedGroupId ? 'group' : 'direct');

  // Data
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
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
  const [splitType, setSplitType] = useState<'equal' | 'share' | 'exact' | 'percentage'>('equal');
  const [splits, setSplits] = useState<{ userId: string; value: string; share: number }[]>([]);
  const [note, setNote] = useState('');

  // Direct expense: selected friends + email participants
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [emailParticipants, setEmailParticipants] = useState<EmailParticipant[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');

  // Receipt upload
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  // AI categorize
  const [categorizeLoading, setCategorizeLoading] = useState(false);

  // Submitting
  const [submitting, setSubmitting] = useState(false);

  // Fetch groups
  useEffect(() => {
    async function fetchData() {
      try {
        const [groupsRes, friendsRes] = await Promise.all([
          fetch('/api/groups'),
          fetch('/api/friends'),
        ]);
        if (groupsRes.ok) {
          const data = await groupsRes.json();
          const list = Array.isArray(data) ? data : data.groups || [];
          setGroups(list);
          if (!selectedGroupId && list.length > 0) {
            setGroupId(list[0].id);
          }
        }
        if (friendsRes.ok) {
          const fData = await friendsRes.json();
          setFriends(fData.friends || []);
        }
      } catch {
        // silent
      }
    }
    fetchData();
  }, [selectedGroupId]);

  // Fetch group members when group changes
  useEffect(() => {
    if (mode !== 'group' || !groupId) return;
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
            email: m.user?.email || m.email || '',
          }));
          setMembers(memberList);
          setSplits(memberList.map((m: Member) => ({ userId: m.id, value: '', share: 1 })));
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
  }, [groupId, mode, user?.id]);

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
        toast.error('Could not parse expense. Try being more specific.');
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

  // Add email participant
  const addEmailParticipant = () => {
    if (!newEmail.trim()) return;
    const email = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (emailParticipants.some((p) => p.email === email)) {
      toast.error('This email is already added');
      return;
    }
    setEmailParticipants([...emailParticipants, { email, name: newName.trim() || email.split('@')[0] }]);
    setNewEmail('');
    setNewName('');
  };

  // Remove email participant
  const removeEmail = (email: string) => {
    setEmailParticipants(emailParticipants.filter((p) => p.email !== email));
  };

  // Toggle friend selection
  const toggleFriend = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  // Total participants in direct mode
  const totalDirectParticipants = 1 + selectedFriends.length + emailParticipants.length;
  const perPersonDirect = amount && !isNaN(parseFloat(amount)) && totalDirectParticipants > 0
    ? (parseFloat(amount) / totalDirectParticipants).toFixed(2)
    : '0.00';

  // Update split value
  const updateSplit = (userId: string, value: string) => {
    setSplits((prev) => prev.map((s) => (s.userId === userId ? { ...s, value } : s)));
  };

  const updateSplitShare = (userId: string, share: number) => {
    setSplits((prev) => prev.map((s) => (s.userId === userId ? { ...s, share: Math.max(1, share) } : s)));
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
    if (mode === 'group' && !groupId) {
      toast.error('Please select a group');
      valid = false;
    }
    if (mode === 'direct' && selectedFriends.length === 0 && emailParticipants.length === 0) {
      toast.error('Select at least one friend or add an email to split with');
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
        paidById,
        splitType,
        note: note.trim(),
      };

      if (mode === 'group') {
        body.groupId = groupId;
        if (splitType === 'share') {
          // Send share values — backend handles proportional calculation
          body.splitType = 'equal';
          body.splits = splits.map((s) => ({
            userId: s.userId,
            share: s.share || 1,
          }));
        } else if (splitType !== 'equal') {
          body.splits = splits.map((s) => ({
            userId: s.userId,
            value: parseFloat(s.value) || 0,
          }));
        }
      } else {
        // Direct expense
        if (splitType === 'equal') {
          body.splits = selectedFriends.map((id) => ({ userId: id, share: 1 }));
          body.nonUserSplits = emailParticipants.map((p) => ({ email: p.email, name: p.name, share: 1 }));
        } else if (splitType === 'share') {
          body.splitType = 'equal';
          body.splits = splits.map((s) => ({
            userId: s.userId,
            share: s.share || 1,
          }));
          body.nonUserSplits = emailParticipants.map((p) => ({ email: p.email, name: p.name, share: 1 }));
        } else if (splitType === 'exact') {
          body.splits = splits.map((s) => ({
            userId: s.userId,
            amount: parseFloat(s.value) || 0,
          }));
        } else {
          body.splits = splits.map((s) => ({
            userId: s.userId,
            percentage: parseFloat(s.value) || 0,
          }));
        }
      }

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success('Expense added!');
        if (mode === 'group' && groupId) {
          navigateToGroup(groupId);
        } else {
          setView('history');
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add expense. Please try again.');
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

  // Split participants for direct exact/percentage mode
  const directParticipants = [
    ...(friends.filter((f) => selectedFriends.includes(f.id)).map((f) => ({ id: f.id, name: f.name }))),
  ];

  useEffect(() => {
    if (mode === 'direct' && (splitType === 'exact' || splitType === 'percentage' || splitType === 'share')) {
      setSplits(directParticipants.map((p) => ({ userId: p.id, value: '', share: 1 })));
    }
  }, [mode, splitType, selectedFriends.length]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Add Expense</h2>
        <p className="text-sm text-gray-500 mt-1">Record a new expense and split it.</p>
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
                  Examples: &quot;Paid ₹450 for pizza split equally with Alex and Sam&quot;
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder='e.g. "Paid ₹450 for pizza split 3 ways"'
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
            {/* Expense Mode Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Expense Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('direct')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                    mode === 'direct'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Direct Split</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('group')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                    mode === 'group'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Group Expense</span>
                </button>
              </div>
              <p className="text-xs text-gray-400">
                {mode === 'direct'
                  ? 'Split with friends or by email — no group needed'
                  : 'Split within an existing group'}
              </p>
            </div>

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

            {/* Group selector (only in group mode) */}
            {mode === 'group' && (
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
            )}

            {/* Direct mode: Select friends & add by email */}
            {mode === 'direct' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Split with Friends</Label>
                  {friends.length === 0 ? (
                    <p className="text-xs text-gray-400">No friends yet. Add by email below or send a friend request from the Friends page.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {friends.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleFriend(f.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                            selectedFriends.includes(f.id)
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {f.name || f.email}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Email participants */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    Add by Email
                    <span className="text-xs text-gray-400 font-normal">(for non-users too)</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="friend@email.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="h-9 flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmailParticipant())}
                    />
                    <Input
                      placeholder="Name (optional)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="h-9 w-32"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmailParticipant())}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0"
                      onClick={addEmailParticipant}
                      disabled={!newEmail.trim()}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {emailParticipants.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {emailParticipants.map((p) => (
                        <Badge key={p.email} variant="secondary" className="gap-1.5 py-1 px-2.5">
                          <Mail className="w-3 h-3 text-gray-400" />
                          {p.name}
                          <span className="text-gray-400">({p.email})</span>
                          <button
                            type="button"
                            onClick={() => removeEmail(p.email)}
                            className="ml-1 text-gray-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {emailParticipants.length > 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                      Email participants who are not on SplitFlow will see the expense once they sign up with that email.
                    </p>
                  )}
                </div>
              </div>
            )}

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
                      <strong>Equal:</strong> Split evenly among all participants<br/>
                      <strong>By Share:</strong> Split by family/group size (e.g., 4 members vs 3 members = 4:3 ratio)<br/>
                      <strong>Exact:</strong> Enter specific amounts per person<br/>
                      <strong>Percentage:</strong> Enter percentage each person pays
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex gap-2">
                {(['equal', 'share', 'exact', 'percentage'] as const).map((type) => (
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
                    {type === 'equal' ? 'Equal' : type === 'share' ? 'By Share 👨‍👩‍👧‍👦' : type === 'exact' ? 'Exact ₹' : 'Percentage %'}
                  </Button>
                ))}
              </div>
            </div>

            {/* Share split details — family/group size (both modes) */}
            {splitType === 'share' && (
              <div className="space-y-3 p-4 bg-emerald-50/70 rounded-lg border border-emerald-100">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Family / Group Size 👨‍👩‍👧‍👦
                  </Label>
                  {(() => {
                    const allParticipants = mode === 'group'
                      ? members.map((m) => ({ id: m.id, name: m.name }))
                      : directParticipants;
                    const totalShares = allParticipants.reduce((sum, p) => {
                      const s = splits.find((sp) => sp.userId === p.id);
                      return sum + (s?.share || 1);
                    }, 0);
                    const numAmount = parseFloat(amount) || 0;
                    const ratioStr = allParticipants
                      .map((p) => {
                        const s = splits.find((sp) => sp.userId === p.id);
                        return s?.share || 1;
                      })
                      .join(' : ');
                    return (
                      <span className="text-xs text-emerald-700 font-medium bg-emerald-100 px-2 py-1 rounded-full">
                        Ratio: {ratioStr} = {totalShares} total shares
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-gray-500">
                  Set how many people each participant represents. The expense will be split proportionally.
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {(mode === 'group' ? members : directParticipants).map((p) => {
                    const split = splits.find((s) => s.userId === p.id);
                    const shareCount = split?.share || 1;
                    const allParticipants = mode === 'group' ? members : directParticipants;
                    const totalShares = allParticipants.reduce((sum, pp) => {
                      const s = splits.find((sp) => sp.userId === pp.id);
                      return sum + (s?.share || 1);
                    }, 0);
                    const numAmount = parseFloat(amount) || 0;
                    const shareAmount = totalShares > 0
                      ? Math.round((numAmount * shareCount) / totalShares * 100) / 100
                      : 0;
                    const sharePct = totalShares > 0
                      ? Math.round((shareCount / totalShares) * 1000) / 10
                      : 0;
                    return (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-28 truncate shrink-0">{p.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateSplitShare(p.id, shareCount - 1)}
                            className="w-7 h-7 rounded-md border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                            disabled={shareCount <= 1}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={shareCount}
                            onChange={(e) => updateSplitShare(p.id, parseInt(e.target.value) || 1)}
                            className="w-10 h-7 text-center text-sm font-medium border border-gray-200 rounded-md bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => updateSplitShare(p.id, shareCount + 1)}
                            className="w-7 h-7 rounded-md border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{shareCount === 1 ? 'person' : 'people'}</span>
                        <div className="flex-1" />
                        <span className="text-sm font-semibold text-emerald-700 shrink-0">₹{shareAmount.toFixed(2)}</span>
                        <span className="text-[10px] text-gray-400 w-10 text-right shrink-0">{sharePct}%</span>
                      </div>
                    );
                  })}
                </div>
                {emailParticipants.length > 0 && splitType === 'share' && (
                  <div className="mt-2 pt-2 border-t border-emerald-200">
                    <p className="text-xs text-amber-600">
                      Email participants are counted as 1 share each.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Split Details for Group mode (exact/percentage) */}
            {mode === 'group' && splitType !== 'equal' && splitType !== 'share' && members.length > 0 && (
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

            {/* Split Details for Direct mode (exact/percentage with friends) */}
            {mode === 'direct' && splitType !== 'equal' && splitType !== 'share' && directParticipants.length > 0 && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <Label className="text-sm font-medium">
                  Split Details {splitType === 'percentage' ? '(%)' : '(₹)'}
                </Label>
                <div className="space-y-2">
                  {directParticipants.map((p) => {
                    const split = splits.find((s) => s.userId === p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-32 truncate shrink-0">{p.name}</span>
                        <Input
                          type="number"
                          step={splitType === 'percentage' ? '1' : '0.01'}
                          min="0"
                          placeholder="0"
                          value={split?.value || ''}
                          onChange={(e) => updateSplit(p.id, e.target.value)}
                          className="h-9"
                        />
                        <span className="text-xs text-gray-400 w-4">{splitType === 'percentage' ? '%' : '₹'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Equal split summary */}
            {splitType === 'equal' && (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                {mode === 'group' && members.length > 0 ? (
                  <p className="text-sm text-emerald-700">
                    Split equally among <strong>{members.length}</strong> member{members.length !== 1 ? 's' : ''}: <strong>₹{perPerson}</strong> each
                  </p>
                ) : mode === 'direct' && totalDirectParticipants > 1 ? (
                  <p className="text-sm text-emerald-700">
                    Split equally among <strong>{totalDirectParticipants}</strong> people: <strong>₹{perPersonDirect}</strong> each
                    {emailParticipants.length > 0 && (
                      <span className="block text-xs text-amber-600 mt-1">
                        Including {emailParticipants.length} email participant{emailParticipants.length > 1 ? 's' : ''} who will see this after signing up
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-emerald-700">
                    Add friends or email participants to split with
                  </p>
                )}
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
