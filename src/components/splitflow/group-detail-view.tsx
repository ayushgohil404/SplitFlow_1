'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Copy,
  Check,
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
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('expenses');
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);

  // Members dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);

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
            userName: 'User',
            amount: Number(s.amount),
          })),
        }));
        const totalExpenses = expenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
        const balances = apiBalances.map((b: any) => ({
          from: { id: b.fromUserId, name: 'User' },
          to: { id: b.toUserId, name: 'User' },
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

  const copyCode = () => {
    if (group?.inviteCode) {
      navigator.clipboard.writeText(group.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddMember = async () => {
    if (!memberEmail.trim() || !selectedGroupId) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/groups/${selectedGroupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: memberEmail.trim() }),
      });
      if (res.ok) {
        toast.success('Member added!');
        setAddMemberOpen(false);
        setMemberEmail('');
        fetchGroup();
      } else {
        toast.error('Failed to add member');
      }
    } catch {
      toast.error('Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedGroupId) return;
    try {
      const res = await fetch(`/api/groups/${selectedGroupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (res.ok) {
        toast.success('Member removed');
        fetchGroup();
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
        body: JSON.stringify({ memberId: user?.id }),
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
        <p className="text-gray-500">Group not found</p>
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
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{group.name}</h2>
              {group.description && (
                <p className="text-sm text-gray-500 mt-1">{group.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Users className="w-4 h-4" />{group.members.length} members</span>
                <span className="flex items-center gap-1"><Receipt className="w-4 h-4" />₹{group.totalExpenses?.toFixed(2)} total</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-500">Code:</span>
                <code className="text-sm font-mono font-semibold text-gray-900">{group.inviteCode}</code>
                <button onClick={copyCode} className="text-gray-400 hover:text-gray-600">
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
                <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No expenses yet</p>
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
                      <p className="text-sm font-medium text-gray-900 truncate">{exp.description}</p>
                      <p className="text-xs text-gray-500">
                        Paid by {exp.paidBy?.name} · {exp.date ? new Date(exp.date).toLocaleDateString() : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 shrink-0">
                      ₹{exp.amount.toFixed(2)}
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
              <Button size="sm" variant="outline" onClick={() => setAddMemberOpen(true)}>
                <UserPlus className="w-4 h-4 mr-1.5" />Add Member
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {group.members.map((member) => (
              <Card key={member.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-emerald-50 text-emerald-700 text-sm font-semibold">
                      {member.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                      {member.role === 'admin' && (
                        <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700">
                          <Shield className="w-3 h-3 mr-1" />Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{member.email}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                  {isAdmin && member.id !== user?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
                <Scale className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">All settled up! No balances.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {group.balances.map((bal, idx) => {
                const isYouOwe = bal.from?.id === user?.id;
                return (
                  <Card key={idx}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isYouOwe ? 'bg-red-50' : 'bg-emerald-50'}`}>
                        {isYouOwe ? (
                          <ArrowDownRight className="w-5 h-5 text-red-500" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{bal.from?.name}</span>
                          {' → '}
                          <span className="font-medium">{bal.to?.name}</span>
                        </p>
                      </div>
                      <span className={`text-sm font-bold ${isYouOwe ? 'text-red-500' : 'text-emerald-600'}`}>
                        {isYouOwe ? '-' : '+'}₹{bal.amount.toFixed(2)}
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3 mt-6">
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setLeaveOpen(true)}
            >
              <LogOut className="w-4 h-4 mr-2" />Leave Group
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />Delete Group
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-email">Email Address</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="friend@example.com"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddMember}
              disabled={!memberEmail.trim() || addingMember}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {addingMember ? 'Adding...' : 'Add Member'}
            </Button>
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
