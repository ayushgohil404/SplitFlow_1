'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Users,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  LogOut,
  UserPlus,
  Shield,
  Calendar,
  Scale,
  Mail,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { ExpenseDetailDialog } from './expense-detail-dialog';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  categoryEmoji: string;
  paidBy: { id: string; name: string };
  date: string;
  splitType: string;
  splits: { userId: string; userName: string; amount: number }[];
}

interface Balance {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
}

interface GroupData {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: string;
  currency: string;
  inviteCode: string;
  members: Member[];
  expenses: Expense[];
  balances: Balance[];
  totalExpenses: number;
}

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

export function GroupDetailView() {
  const { selectedGroupId, setView, user } = useAppStore();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expenses');
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  // Settings dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editCurrency, setEditCurrency] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchGroup = useCallback(async () => {
    if (!selectedGroupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${selectedGroupId}`);
      if (res.ok) {
        const data = await res.json();
        const g = data.group || data;
        const apiBalances = data.balances || [];
        const members = (g.members || []).map((m: any) => ({
          id: m.user?.id || m.userId || m.id,
          name: m.user?.name || m.name || 'Unknown',
          email: m.user?.email || m.email || '',
          role: m.role,
          joinedAt: m.joinedAt,
        }));
        const expenses = (g.expenses || []).map((e: any) => ({
          ...e,
          paidBy: e.paidBy || { id: e.createdBy, name: 'Unknown' },
          splits: (e.splits || []).map((s: any) => ({
            userId: s.userId,
            userName: s.user?.name || 'Unknown',
            amount: Number(s.amount),
          })),
        }));
        const totalExpenses = expenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
        const memberMap = new Map(members.map(m => [m.id, m.name]));
        const balances = apiBalances.map((b: any) => ({
          from: { id: b.fromUserId, name: memberMap.get(b.fromUserId) || 'Unknown' },
          to: { id: b.toUserId, name: memberMap.get(b.toUserId) || 'Unknown' },
          amount: Number(b.amount),
        }));
        setGroup({ ...g, members, expenses, totalExpenses, balances } as GroupData);
        setEditName(g.name || '');
        setEditDesc(g.description || '');
        setEditEmoji(g.emoji || '👥');
        setEditCurrency(g.currency || 'INR');
      } else {
        toast.error('Failed to load group');
      }
    } catch {
      toast.error('Failed to load group');
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);



  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !selectedGroupId) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/groups/${selectedGroupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Member added successfully!');
        setInviteEmail('');
        setInviteOpen(false);
        fetchGroup();
      } else {
        toast.error(data.error || 'Failed to add member');
      }
    } catch {
      toast.error('Failed to add member');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedGroupId) return;
    try {
      const res = await fetch(`/api/groups/${selectedGroupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: memberId }),
      });
      if (res.ok) {
        toast.success('Member removed');
        fetchGroup();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to remove member');
      }
    } catch {
      toast.error('Failed to remove member');
    }
  };

  const handleSaveSettings = async () => {
    if (!selectedGroupId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${selectedGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDesc,
          emoji: editEmoji,
          currency: editCurrency,
        }),
      });
      if (res.ok) {
        toast.success('Group updated!');
        fetchGroup();
      } else {
        toast.error('Failed to update group');
      }
    } catch {
      toast.error('Failed to update group');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroupId) return;
    try {
      const res = await fetch(`/api/groups/${selectedGroupId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Group deleted');
        setView('groups');
      }
    } catch {
      toast.error('Failed to delete group');
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroupId) return;
    try {
      const res = await fetch(`/api/groups/${selectedGroupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id }),
      });
      if (res.ok) {
        toast.success('Left group');
        setView('groups');
      }
    } catch {
      toast.error('Failed to leave group');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Group not found</p>
        <Button variant="outline" className="mt-4" onClick={() => setView('groups')}>
          Back to Groups
        </Button>
      </div>
    );
  }

  const isAdmin = group.members.some((m) => m.id === user?.id && m.role === 'admin');

  return (
    <div className="space-y-6">
      {/* Group header */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <span className="text-4xl sm:text-5xl">{group.emoji || '👥'}</span>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">{group.name}</h2>
              {group.description && (
                <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="w-4 h-4" />{group.members.length} members</span>
                <span className="flex items-center gap-1"><Receipt className="w-4 h-4" />₹{group.totalExpenses?.toFixed(2)} total</span>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex">
          <TabsTrigger value="expenses" className="text-xs sm:text-sm">Expenses</TabsTrigger>
          <TabsTrigger value="members" className="text-xs sm:text-sm">Members</TabsTrigger>
          <TabsTrigger value="balances" className="text-xs sm:text-sm">Balances</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm">Settings</TabsTrigger>
        </TabsList>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => {
                useAppStore.getState().selectGroup(selectedGroupId!);
                setView('add-expense');
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" />Add Expense
            </Button>
          </div>
          {group.expenses.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No expenses yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {group.expenses.map((exp) => (
                <Card
                  key={exp.id}
                  className="cursor-pointer hover:shadow-sm transition-shadow"
                  onClick={() => setSelectedExpenseId(exp.id)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <span className="text-xl">{CATEGORY_EMOJIS[exp.category] || '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{exp.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Paid by {exp.paidBy?.name} · {exp.date ? new Date(exp.date).toLocaleDateString() : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-foreground shrink-0">
                      ₹{(Number(exp.amount) || 0).toFixed(2)}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-4">
          <div className="flex justify-end mb-4">
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => { setInviteOpen(true); setInviteEmail(''); }}>
                <UserPlus className="w-4 h-4 mr-1.5" />Invite People
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {group.members.map((member) => (
              <Card key={member.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-foreground text-sm font-semibold">
                      {member.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                      {member.role === 'admin' && (
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-foreground">
                          <Shield className="w-3 h-3 mr-1" />Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                  {isAdmin && member.id !== user?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-red-700 hover:bg-destructive/10"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Balances Tab */}
        <TabsContent value="balances" className="mt-4">
          {(!group.balances || group.balances.length === 0) ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Scale className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">All settled up! No balances.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {group.balances.map((bal, idx) => {
                const isYouOwe = bal.from?.id === user?.id;
                return (
                  <Card key={idx}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isYouOwe ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                        {isYouOwe ? (
                          <ArrowDownRight className="w-5 h-5 text-destructive" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{bal.from?.name}</span>
                          {' → '}
                          <span className="font-medium">{bal.to?.name}</span>
                        </p>
                      </div>
                      <span className={`text-sm font-bold ${isYouOwe ? 'text-destructive' : 'text-primary'}`}>
                        {isYouOwe ? '-' : '+'}₹{(Number(bal.amount) || 0).toFixed(2)}
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Group Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Emoji</Label>
                <Input value={editEmoji} onChange={(e) => setEditEmoji(e.target.value)} className="w-20 text-center text-2xl" />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={editCurrency} onValueChange={setEditCurrency}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="JPY">JPY (¥)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleSaveSettings}
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3 mt-6">
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setLeaveOpen(true)}
            >
              <LogOut className="w-4 h-4 mr-2" />Leave Group
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />Delete Group
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Add Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enter your friend's email to add them directly to this group. They must already have a SplitFlow account.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Friend's Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="friend@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                />
              </div>
            </div>
            <Button
              onClick={handleSendInvite}
              disabled={!inviteEmail.trim() || inviting}
              className="w-full bg-primary hover:bg-primary/90 text-white"
            >
              {inviting ? 'Adding...' : 'Add to Group'}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{group.name}&quot; and all its expenses. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Confirmation */}
      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave &quot;{group.name}&quot;? You&apos;ll still owe any outstanding balances.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveGroup} className="bg-red-600 hover:bg-red-700">Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Expense Detail Dialog */}
      {selectedExpenseId && (
        <ExpenseDetailDialog
          expenseId={selectedExpenseId}
          open={!!selectedExpenseId}
          onClose={() => setSelectedExpenseId(null)}
          onUpdated={fetchGroup}
          onDeleted={fetchGroup}
        />
      )}
    </div>
  );
}
