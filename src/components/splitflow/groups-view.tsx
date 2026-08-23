'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  LogIn,
  Users,
  Receipt,
  Search,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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

const EMOJI_OPTIONS = ['🏠', '🍕', '✈️', '🎉', '💡', '📚', '🏋️', '🚗', '🎮', '🏖️', '💼', '🐕'];
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
  { value: 'INR', label: 'INR (₹)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
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
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formNameError, setFormNameError] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formEmoji, setFormEmoji] = useState('🏠');
  const [formCategory, setFormCategory] = useState('general');
  const [formCurrency, setFormCurrency] = useState('INR');
  const [creating, setCreating] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(Array.isArray(data) ? data : data.groups || []);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.description?.toLowerCase().includes(q) ||
        g.category?.toLowerCase().includes(q)
    );
  }, [groups, searchQuery]);

  const handleCreate = async () => {
    setFormNameError('');
    if (!formName.trim()) {
      setFormNameError('Please enter a group name');
      return;
    }
    if (formName.trim().length < 2) {
      setFormNameError('Group name must be at least 2 characters');
      return;
    }
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
        toast.success('Group created! Share the invite code with friends.');
        setCreateOpen(false);
        setFormName('');
        setFormDesc('');
        setFormEmoji('🏠');
        setFormCategory('general');
        setFormCurrency('INR');
        fetchGroups();
      } else {
        toast.error('Failed to create group. Please try again.');
      }
    } catch {
      toast.error('Network error. Please check your connection.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    setJoinError('');
    let code = inviteCode.trim();
    if (!code) {
      setJoinError('Please enter an invite code');
      return;
    }
    // Strip URL if user pasted full link
    if (code.includes('/invite/')) {
      code = code.split('/invite/').pop() || '';
    }
    if (!code) {
      setJoinError('Please enter a valid invite code');
      return;
    }
    setJoining(true);
    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code }),
      });
      if (res.ok) {
        toast.success('Joined group successfully!');
        setJoinOpen(false);
        setInviteCode('');
        fetchGroups();
      } else {
        const data = await res.json().catch(() => ({}));
        setJoinError(data.error || 'Invalid invite code. Please check and try again.');
      }
    } catch {
      setJoinError('Network error. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90 text-white shadow-sm">
            <Plus className="w-4 h-4 mr-2" />Create Group
          </Button>
          <Button variant="outline" onClick={() => setJoinOpen(true)}>
            <LogIn className="w-4 h-4 mr-2" />Join Group
          </Button>
        </div>
        
        {/* Search */}
        {groups.length > 3 && (
          <div className="relative flex-1 max-w-xs sm:ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
        )}
      </div>

      {/* Error state */}
      {error && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load groups</h3>
          <p className="text-sm text-muted-foreground mb-4">Something went wrong. Please try again.</p>
          <Button onClick={fetchGroups} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-40">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <div className="pt-2 border-t border-border space-y-2">
                  <div className="flex justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-16" /></div>
                  <div className="flex justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-16" /></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredGroups.length === 0 && searchQuery ? (
        <div className="text-center py-12">
          <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No groups matching &quot;{searchQuery}&quot;</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearchQuery('')}>
            Clear search
          </Button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No groups yet</h3>
          <p className="text-sm text-muted-foreground mb-1 max-w-sm leading-relaxed">
            Create a group to start splitting expenses with friends, roommates, or travel buddies.
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            You can also join an existing group using an invite code.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90 text-white">
              <Plus className="w-4 h-4 mr-2" />Create Your First Group
            </Button>
            <Button variant="outline" onClick={() => setJoinOpen(true)}>
              <LogIn className="w-4 h-4 mr-2" />Join a Group
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredGroups.map((group) => (
            <motion.div key={group.id} variants={item}>
              <Card
                className="cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 h-full"
                onClick={() => navigateToGroup(group.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{group.emoji || '👥'}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{group.name}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Users className="w-3 h-3" />{group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {group.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">{group.description}</p>
                  )}
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total spent</span>
                      <span className="font-medium text-foreground">
                        ₹{(group.totalExpenses || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Your balance</span>
                      <span
                        className={`font-semibold ${
                          (group.yourBalance || 0) >= 0 ? 'text-primary' : 'text-destructive'
                        }`}
                      >
                        {(group.yourBalance || 0) >= 0 ? '+' : ''}
                        ₹{(group.yourBalance || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setFormNameError(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormEmoji(emoji)}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                      formEmoji === emoji
                        ? 'bg-primary/10 ring-2 ring-primary scale-110'
                        : 'bg-muted hover:bg-muted'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Group Name <span className="text-destructive">*</span></Label>
              <Input
                id="group-name"
                placeholder="e.g., Weekend Trip to Goa"
                value={formName}
                onChange={(e) => { setFormName(e.target.value); setFormNameError(''); }}
                className={`h-11 ${formNameError ? 'border-destructive/40' : ''}`}
                autoFocus
              />
              {formNameError && <p className="text-xs text-destructive">{formNameError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="group-desc"
                placeholder="What's this group for?"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setFormNameError(''); }}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!formName.trim() || creating}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {creating ? 'Creating...' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Group Dialog */}
      <Dialog open={joinOpen} onOpenChange={(open) => { setJoinOpen(open); setJoinError(''); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Join a Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Paste the group invite code or invite link shared by the group creator.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="invite-code">Invite Code</Label>
              <Input
                id="invite-code"
                placeholder="Paste invite code or link"
                value={inviteCode}
                onChange={(e) => { setInviteCode(e.target.value); setJoinError(''); }}
                className={`h-11 text-center font-mono text-sm tracking-wider ${joinError ? 'border-destructive/40' : ''}`}
                autoFocus
                maxLength={30}
              />
              {joinError && <p className="text-xs text-destructive">{joinError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setJoinOpen(false); setJoinError(''); }}>Cancel</Button>
            <Button
              onClick={handleJoin}
              disabled={!inviteCode.trim() || joining}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {joining ? 'Joining...' : 'Join Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
