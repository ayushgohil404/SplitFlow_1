'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  LogIn,
  Users,
  Copy,
  Check,
  Receipt,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  description: string;
  category: string;
  currency: string;
  memberCount: number;
  totalExpenses: number;
  yourBalance: number;
  inviteCode: string;
}

const EMOJI_OPTIONS = ['🏠', '🍕', '✈️', '🎉', '💡', '📚', '🏋️', '🚗', '🎮', '🏖️'];
const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'travel', label: 'Travel' },
  { value: 'food', label: 'Food & Dining' },
  { value: 'housing', label: 'Housing' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'other', label: 'Other' },
];
const CURRENCIES = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'INR', label: 'INR (₹)' },
  { value: 'JPY', label: 'JPY (¥)' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function GroupsView() {
  const { navigateToGroup } = useAppStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formEmoji, setFormEmoji] = useState('🏠');
  const [formCategory, setFormCategory] = useState('general');
  const [formCurrency, setFormCurrency] = useState('USD');
  const [creating, setCreating] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(Array.isArray(data) ? data : data.groups || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim(),
          emoji: formEmoji,
          category: formCategory,
          currency: formCurrency,
        }),
      });
      if (res.ok) {
        toast.success('Group created!');
        setCreateOpen(false);
        setFormName('');
        setFormDesc('');
        setFormEmoji('🏠');
        setFormCategory('general');
        setFormCurrency('USD');
        fetchGroups();
      } else {
        toast.error('Failed to create group');
      }
    } catch {
      toast.error('Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setJoining(true);
    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.trim() }),
      });
      if (res.ok) {
        toast.success('Joined group!');
        setJoinOpen(false);
        setInviteCode('');
        fetchGroups();
      } else {
        toast.error('Invalid invite code');
      }
    } catch {
      toast.error('Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" />Create Group
        </Button>
        <Button variant="outline" onClick={() => setJoinOpen(true)}>
          <LogIn className="w-4 h-4 mr-2" />Join Group
        </Button>
      </div>

      {/* Groups grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No groups yet</h3>
          <p className="text-sm text-gray-500 mb-6">
            Create a group to start splitting expenses with friends.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-2" />Create Your First Group
          </Button>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {groups.map((group) => (
            <motion.div key={group.id} variants={item}>
              <Card
                className="cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                onClick={() => navigateToGroup(group.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{group.emoji || '👥'}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{group.name}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />{group.memberCount} members
                      </p>
                    </div>
                  </div>
                  {group.description && (
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{group.description}</p>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Total expenses</span>
                      <span className="font-medium text-gray-900">
                        ${(group.totalExpenses || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Your balance</span>
                      <span
                        className={`font-semibold ${
                          (group.yourBalance || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {(group.yourBalance || 0) >= 0 ? '+' : ''}
                        ${(group.yourBalance || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create Group Dialog */
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormEmoji(emoji)}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-colors ${
                      formEmoji === emoji
                        ? 'bg-emerald-100 ring-2 ring-emerald-500'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="e.g., Weekend Trip"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-desc">Description (optional)</Label>
              <Textarea
                id="group-desc"
                placeholder="What's this group for?"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!formName.trim() || creating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {creating ? 'Creating...' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Group Dialog */
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Join a Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-code">Invite Code</Label>
              <Input
                id="invite-code"
                placeholder="Enter invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="h-11 text-center font-mono text-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)}>Cancel</Button>
            <Button
              onClick={handleJoin}
              disabled={!inviteCode.trim() || joining}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {joining ? 'Joining...' : 'Join Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
