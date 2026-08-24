'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  HandCoins,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Zap,
  CreditCard,
  Loader2,
  Users,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';

interface GroupBalance {
  groupId: string;
  groupName: string;
  groupEmoji: string;
  balances: {
    userId: string;
    userName: string | null;
    userImage: string | null;
    amount: number;
  }[];
}

interface DirectBalance {
  userId: string;
  userName: string | null;
  userImage: string | null;
  amount: number;
  isEmail?: boolean;
}

interface PersonBalance {
  userId: string;
  userName: string | null;
  userImage: string | null;
  amount: number;
  isEmail?: boolean;
  sourceGroups: { groupId: string; groupName: string; groupEmoji: string; amount: number }[];
}

interface BalanceDetail {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
}

interface GroupMember {
  userId: string;
  userName: string;
}

interface Settlement {
  id: string;
  from: { name: string };
  to: { name: string };
  amount: number;
  note: string;
  createdAt: string;
}

interface SimplifiedPayment {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

type Tab = 'overall' | 'group';

export function SettleView() {
  const { user } = useAppStore();
  const [tab, setTab] = useState<Tab>('overall');
  const [groupBalances, setGroupBalances] = useState<GroupBalance[]>([]);
  const [directBalances, setDirectBalances] = useState<DirectBalance[]>([]);
  const [personBalances, setPersonBalances] = useState<PersonBalance[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [balances, setBalances] = useState<BalanceDetail[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [simplified, setSimplified] = useState<SimplifiedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [simplifyLoading, setSimplifyLoading] = useState(false);

  const [recordOpen, setRecordOpen] = useState(false);
  const [payFrom, setPayFrom] = useState('');
  const [payTo, setPayTo] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payAmountError, setPayAmountError] = useState('');
  const [payNote, setPayNote] = useState('');
  const [recording, setRecording] = useState(false);

  // For direct settlement
  const [directSettleOpen, setDirectSettleOpen] = useState(false);
  const [directSettleUserId, setDirectSettleUserId] = useState('');
  const [directSettleAmount, setDirectSettleAmount] = useState('');
  const [directSettleRecording, setDirectSettleRecording] = useState(false);

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/balance');
      if (res.ok) {
        const data = await res.json();
        const groups = (data.groups || []) as any[];
        const direct = (data.direct || []) as DirectBalance[];
        setGroupBalances(groups.map((g: any) => ({
          groupId: g.groupId,
          groupName: g.groupName,
          groupEmoji: g.groupEmoji,
          balances: g.balances || [],
        })));
        setDirectBalances(direct);

        // Merge all balances into per-person view
        const personMap = new Map<string, PersonBalance>();

        // From group balances
        for (const g of groups) {
          for (const b of (g.balances || [])) {
            const existing = personMap.get(b.userId);
            const groupInfo = { groupId: g.groupId, groupName: g.groupName, groupEmoji: g.groupEmoji, amount: b.amount };
            if (existing) {
              existing.amount = Math.round((existing.amount + b.amount) * 100) / 100;
              existing.sourceGroups.push(groupInfo);
            } else {
              personMap.set(b.userId, {
                userId: b.userId,
                userName: b.userName,
                userImage: b.userImage,
                amount: b.amount,
                sourceGroups: [groupInfo],
              });
            }
          }
        }

        // From direct balances
        for (const d of direct) {
          const existing = personMap.get(d.userId);
          if (existing) {
            existing.amount = Math.round((existing.amount + d.amount) * 100) / 100;
            if (d.isEmail) existing.isEmail = true;
          } else {
            personMap.set(d.userId, {
              userId: d.userId,
              userName: d.userName,
              userImage: d.userImage,
              amount: d.amount,
              isEmail: d.isEmail,
              sourceGroups: [],
            });
          }
        }

        // Sort: positive (owed to you) first, then negative (you owe)
        const sorted = Array.from(personMap.values())
          .filter(p => Math.abs(p.amount) > 0.005)
          .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
        setPersonBalances(sorted);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  const fetchGroupDetail = useCallback(async (groupId: string) => {
    setDetailLoading(true);
    setSimplified([]);
    try {
      const [groupRes, settleRes] = await Promise.all([
        fetch(`/api/groups/${groupId}`),
        fetch(`/api/settlements?groupId=${groupId}`),
      ]);
      if (groupRes.ok) {
        const data = await groupRes.json();
        const g = data.group || data;
        const memberList = ((g.members || []) as any[]).map((m: any) => ({
          userId: m.user?.id || m.userId || m.id,
          userName: m.user?.name || m.name || 'Unknown',
        }));
        setGroupMembers(memberList);
        const rawBalances = data.balances || [];
        setBalances(rawBalances.map((b: any) => ({
          from: b.from || { id: b.fromUserId, name: 'Unknown' },
          to: b.to || { id: b.toUserId, name: 'Unknown' },
          amount: Number(b.amount) || 0,
        })));
      }
      if (settleRes.ok) {
        const sData = await settleRes.json();
        setSettlements((sData.settlements || []).map((s: any) => ({
          id: s.id,
          from: { name: s.fromUser?.name || 'Someone' },
          to: { name: s.toUser?.name || 'Someone' },
          amount: Number(s.amount),
          note: s.note || '',
          createdAt: s.createdAt,
        })));
      }
    } catch {
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupDetail(selectedGroupId);
    }
  }, [selectedGroupId, fetchGroupDetail]);

  const handleSimplify = async () => {
    if (!selectedGroupId) return;
    setSimplifyLoading(true);
    try {
      const res = await fetch('/api/settlements/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedGroupId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimplified(data.settlements || []);
        toast.success('Optimal payment plan calculated!');
      }
    } catch {
      toast.error('Failed to simplify debts');
    } finally {
      setSimplifyLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    setPayAmountError('');
    const numAmount = parseFloat(payAmount);
    if (!payFrom || !payTo || !payAmount || !selectedGroupId) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setPayAmountError('Enter a valid amount greater than \u20b90');
      return;
    }
    if (payFrom === payTo) {
      toast.error('Payer and receiver must be different people');
      return;
    }
    setRecording(true);
    try {
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroupId,
          fromUserId: payFrom,
          toUserId: payTo,
          amount: numAmount,
          note: payNote.trim(),
        }),
      });
      if (res.ok) {
        toast.success('Payment recorded!');
        setRecordOpen(false);
        setPayFrom('');
        setPayTo('');
        setPayAmount('');
        setPayNote('');
        fetchGroupDetail(selectedGroupId);
        fetchOverviewData();
      } else {
        toast.error('Failed to record payment');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setRecording(false);
    }
  };

  // Handle direct settlement (no group)
  const handleDirectSettle = async () => {
    const numAmount = parseFloat(directSettleAmount);
    if (!directSettleUserId || !numAmount || numAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setDirectSettleRecording(true);
    try {
      // Determine direction: if personBalances says positive, they owe us; if negative, we owe them
      const personBal = personBalances.find(p => p.userId === directSettleUserId);
      let fromUserId: string, toUserId: string;
      if (!personBal) {
        toast.error('Could not find balance info');
        setDirectSettleRecording(false);
        return;
      }
      if (personBal.amount > 0) {
        // They owe us - they pay us
        fromUserId = directSettleUserId;
        toUserId = user?.id || '';
      } else {
        // We owe them - we pay them
        fromUserId = user?.id || '';
        toUserId = directSettleUserId;
      }

      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId,
          toUserId,
          amount: numAmount,
          note: 'Direct settlement',
        }),
      });
      if (res.ok) {
        toast.success('Settlement recorded!');
        setDirectSettleOpen(false);
        setDirectSettleAmount('');
        fetchOverviewData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to record settlement');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDirectSettleRecording(false);
    }
  };

  const openDirectSettle = (userId: string) => {
    setDirectSettleUserId(userId);
    const person = personBalances.find(p => p.userId === userId);
    setDirectSettleAmount(String(Math.abs(person?.amount || 0).toFixed(2)));
    setDirectSettleOpen(true);
  };

  // Calculate totals
  const totalOwed = personBalances.filter(p => p.amount > 0).reduce((s, p) => s + p.amount, 0);
  const totalOwing = personBalances.filter(p => p.amount < 0).reduce((s, p) => s + Math.abs(p.amount), 0);
  const hasAnyBalance = totalOwed > 0 || totalOwing > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      <div>
        <h2 className="text-xl font-bold text-foreground">Settle Up</h2>
        <p className="text-sm text-muted-foreground mt-1">See who owes whom and record payments.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Others owe you</p>
                <p className="text-2xl font-bold text-primary mt-1">\u20b9{totalOwed.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-400">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">You owe others</p>
                <p className="text-2xl font-bold text-destructive mt-1">\u20b9{totalOwing.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <ArrowDownRight className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        <button
          type="button"
          onClick={() => setTab('overall')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
            tab === 'overall' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <HandCoins className="w-4 h-4" />
          Overall
        </button>
        <button
          type="button"
          onClick={() => setTab('group')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
            tab === 'group' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4" />
          By Group
        </button>
      </div>

      {tab === 'overall' && (
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4 flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </CardContent></Card>
            ))}</div>
          ) : !hasAnyBalance ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-1">All settled up!</h3>
                <p className="text-sm text-muted-foreground">You don&apos;t owe anyone and no one owes you.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {personBalances.filter(p => p.amount > 0).length > 0 && (
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Friends owe you</p>
              )}
              {personBalances.filter(p => p.amount > 0).map((p) => (
                <Card key={p.userId} className="cursor-pointer hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className={`text-sm font-semibold ${p.isEmail ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                        {(p.userName || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.userName || 'Someone'}</p>
                      {p.sourceGroups.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">
                          {p.sourceGroups.map(sg => `${sg.groupEmoji} ${sg.groupName}`).join(', ')}
                        </p>
                      )}
                      {p.sourceGroups.length === 0 && (
                        <p className="text-xs text-muted-foreground">Direct expense</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-primary">+\u20b9{p.amount.toFixed(2)}</span>
                    {!p.isEmail ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
                        onClick={(e) => { e.stopPropagation(); openDirectSettle(p.userId); }}
                      >
                        Settle
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Email</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}

              {personBalances.filter(p => p.amount < 0).length > 0 && (
                <p className="text-xs font-semibold text-destructive uppercase tracking-wider pt-2">You owe</p>
              )}
              {personBalances.filter(p => p.amount < 0).map((p) => (
                <Card key={p.userId} className="cursor-pointer hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className={`text-sm font-semibold ${p.isEmail ? 'bg-amber-500/10 text-amber-600' : 'bg-destructive/10 text-destructive'}`}>
                        {(p.userName || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.userName || 'Someone'}</p>
                      {p.sourceGroups.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">
                          {p.sourceGroups.map(sg => `${sg.groupEmoji} ${sg.groupName}`).join(', ')}
                        </p>
                      )}
                      {p.sourceGroups.length === 0 && (
                        <p className="text-xs text-muted-foreground">Direct expense</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-destructive">-\u20b9{Math.abs(p.amount).toFixed(2)}</span>
                    {!p.isEmail ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); openDirectSettle(p.userId); }}
                      >
                        Settle
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Email</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'group' && (
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4 flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </CardContent></Card>
            ))}</div>
          ) : groupBalances.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-1">No groups yet</h3>
                <p className="text-sm text-muted-foreground">Create a group first to see balances.</p>
              </CardContent>
            </Card>
          ) : !selectedGroupId ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Select a group to settle</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {groupBalances.map((gb) => {
                    const netBalance = gb.balances.reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0);
                    return (
                    <button
                      key={gb.groupId}
                      className="w-full flex items-center gap-3 p-4 hover:bg-muted transition-colors text-left"
                      onClick={() => setSelectedGroupId(gb.groupId)}
                    >
                      <span className="text-2xl">{gb.groupEmoji || '👥'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">{gb.groupName}</p>
                        <p className="text-xs text-muted-foreground">{gb.balances.length} balance{gb.balances.length !== 1 ? 's' : ''}</p>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          netBalance >= 0 ? 'text-primary' : 'text-destructive'
                        }`}
                      >
                        {netBalance >= 0 ? '+' : ''}\u20b9{(Number(netBalance) || 0).toFixed(2)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setSelectedGroupId(''); setBalances([]); setSettlements([]); setSimplified([]); }}>
                  \u2190 Back
                </Button>
                <h3 className="text-base font-semibold text-foreground">
                  {groupBalances.find(g => g.groupId === selectedGroupId)?.groupEmoji}{' '}
                  {groupBalances.find(g => g.groupId === selectedGroupId)?.groupName || 'Group'}
                </h3>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Detailed balances within this group</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white"
                    onClick={() => setRecordOpen(true)}
                  >
                    <CreditCard className="w-4 h-4 mr-1.5" />Record Payment
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" onClick={handleSimplify} disabled={simplifyLoading}>
                          {simplifyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5" />}
                          Simplify
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-xs">
                        Calculates the minimum number of payments needed to settle all debts
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {detailLoading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}><CardContent className="p-4 flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </CardContent></Card>
                ))}</div>
              ) : balances.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground font-medium">All settled up in this group!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {balances.map((b, idx) => {
                    const isYouOwe = b.from?.id === user?.id;
                    const isOwedToYou = b.to?.id === user?.id;
                    return (
                      <Card key={idx} className={isYouOwe || isOwedToYou ? 'ring-1 ring-emerald-100 dark:ring-emerald-900' : ''}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isYouOwe ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                            {isYouOwe ? (
                              <ArrowDownRight className="w-5 h-5 text-destructive" />
                            ) : (
                              <ArrowUpRight className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">
                              <span className="font-medium">{b.from?.name || 'Someone'}</span>
                              {' \u2192 '}
                              <span className="font-medium">{b.to?.name || 'Someone'}</span>
                            </p>
                            {isYouOwe && <p className="text-xs text-destructive mt-0.5">You need to pay</p>}
                            {isOwedToYou && <p className="text-xs text-primary mt-0.5">Owed to you</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-sm font-bold ${isYouOwe ? 'text-destructive' : isOwedToYou ? 'text-primary' : 'text-foreground'}`}>
                              \u20b9{(Number(b.amount) || 0).toFixed(2)}
                            </span>
                            {(isYouOwe || isOwedToYou) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-7 text-xs ${isYouOwe ? 'border-destructive/30 text-destructive hover:bg-destructive/10' : 'border-primary/30 text-primary hover:bg-primary/10'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPayFrom(b.from?.id || '');
                                  setPayTo(b.to?.id || '');
                                  setPayAmount(String(Number(b.amount).toFixed(2)));
                                  setPayNote('');
                                  setRecordOpen(true);
                                }}
                              >
                                Settle
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {simplified.length > 0 && (
                <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/30 dark:to-teal-950/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />Optimal Payment Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">Reduce from {balances.length} transactions to {simplified.length}:</p>
                    <div className="space-y-2">
                      {simplified.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2.5 bg-background rounded-lg border border-primary/20">
                          <span className="text-sm flex-1 text-foreground font-medium">{p.fromUserName} \u2192 {p.toUserName}</span>
                          <span className="text-sm font-bold text-foreground">\u20b9{(Number(p.amount) || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {settlements.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Recent Settlements</h4>
                  <div className="space-y-2">
                    {settlements.slice(0, 10).map((s) => (
                      <div key={s.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{s.from?.name} paid {s.to?.name}</p>
                          {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-semibold text-foreground">\u20b9{(Number(s.amount) || 0).toFixed(2)}</span>
                          <p className="text-[10px] text-muted-foreground">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Group Record Payment Dialog */}
      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record a Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Record that a payment was made. This will reduce the outstanding balance.
            </p>
            <div className="space-y-1.5">
              <Label>From (payer) <span className="text-destructive">*</span></Label>
              <Select value={payFrom} onValueChange={setPayFrom}>
                <SelectTrigger><SelectValue placeholder="Who is paying?" /></SelectTrigger>
                <SelectContent>
                  {groupMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>{m.userName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To (receiver) <span className="text-destructive">*</span></Label>
              <Select value={payTo} onValueChange={setPayTo}>
                <SelectTrigger><SelectValue placeholder="Who receives payment?" /></SelectTrigger>
                <SelectContent>
                  {groupMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>{m.userName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Amount <span className="text-destructive">*</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">\u20b9</span>
                <Input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => { setPayAmount(e.target.value); setPayAmountError(''); }}
                  className={`pl-7 ${payAmountError ? 'border-destructive/40' : ''}`}
                />
              </div>
              {payAmountError && <p className="text-xs text-destructive mt-1">{payAmountError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-note">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="pay-note"
                placeholder="e.g., UPI, Cash, Venmo"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordOpen(false)}>Cancel</Button>
            <Button
              onClick={handleRecordPayment}
              disabled={!payFrom || !payTo || !payAmount || recording}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {recording ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct Settlement Dialog (no group) */}
      <Dialog open={directSettleOpen} onOpenChange={setDirectSettleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Direct Settlement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Record a payment between you and <span className="font-medium text-foreground">{personBalances.find(p => p.userId === directSettleUserId)?.userName || 'this person'}</span>.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="direct-amount">Amount <span className="text-destructive">*</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">\u20b9</span>
                <Input
                  id="direct-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={directSettleAmount}
                  onChange={(e) => setDirectSettleAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              Current balance: <span className={`font-semibold ${(personBalances.find(p => p.userId === directSettleUserId)?.amount || 0) > 0 ? 'text-primary' : 'text-destructive'}`}>\u20b9{(personBalances.find(p => p.userId === directSettleUserId)?.amount || 0).toFixed(2)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDirectSettleOpen(false)}>Cancel</Button>
            <Button
              onClick={handleDirectSettle}
              disabled={!directSettleAmount || parseFloat(directSettleAmount) <= 0 || directSettleRecording}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {directSettleRecording ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}