'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  TrendingUp,
  CircleDollarSign,
  RefreshCw,
  AlertCircle,
  HandCoins,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppStore } from '@/store/app-store';

interface BalanceData {
  totalOwed: number;
  totalOwing: number;
  net: number;
}

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  user: { name: string };
}

interface GroupSummary {
  id: string;
  name: string;
  emoji: string;
  memberCount: number;
  yourBalance: number;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function DashboardView() {
  const { navigateToGroup, setView } = useAppStore();
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [balRes, actRes, grpRes] = await Promise.allSettled([
        fetch('/api/user/balance'),
        fetch('/api/activity?limit=10'),
        fetch('/api/groups'),
      ]);
      if (balRes.status === 'fulfilled' && balRes.value.ok) {
        const balData = await balRes.value.json();
        const allBalances = [
          ...(balData.groups || []).flatMap((g: any) => g.balances || []),
          ...(balData.direct || []),
        ];
        const totalOwed = allBalances
          .filter((b: any) => Number(b.amount) > 0)
          .reduce((sum: number, b: any) => sum + Number(b.amount), 0);
        const totalOwing = allBalances
          .filter((b: any) => Number(b.amount) < 0)
          .reduce((sum: number, b: any) => sum + Math.abs(Number(b.amount)), 0);
        setBalance({ totalOwed, totalOwing, net: totalOwed - totalOwing });
      }
      if (actRes.status === 'fulfilled' && actRes.value.ok) {
        const actData = await actRes.value.json();
        setActivities(Array.isArray(actData) ? actData : actData.activities || []);
      }
      if (grpRes.status === 'fulfilled' && grpRes.value.ok) {
        const grpData = await grpRes.value.json();
        setGroups(Array.isArray(grpData) ? grpData : grpData.groups || []);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatCurrency = (amount: number) => {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}₹${Math.abs(amount).toFixed(2)}`;
  };

  const hasBalance = (balance?.totalOwed ?? 0) > 0 || (balance?.totalOwing ?? 0) > 0;
  const isEmpty = !loading && !error && !balance?.totalOwed && !balance?.totalOwing && groups.length === 0;

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">Something went wrong</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">We couldn&apos;t load your dashboard data.</p>
        <Button onClick={fetchData} variant="outline" className="gap-2"><RefreshCw className="w-4 h-4" /> Try Again</Button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
          <CircleDollarSign className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Welcome to SplitFlow!</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">Start splitting expenses in 3 easy steps:</p>
        <div className="max-w-xs w-full text-left mb-6 space-y-3">
          {[1, 2, 3].map((n, i) => (
            <div key={n} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">{n}</div>
              <p className="text-sm text-muted-foreground">{['Create a group with your friends or roommates', 'Add expenses as they happen', 'Settle up easily with one click'][i]}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={() => setView('groups')} className="bg-primary hover:bg-primary/90 text-primary-foreground"><Users className="w-4 h-4 mr-2" />Create a Group</Button>
          <Button variant="outline" onClick={() => setView('add-expense')}><Plus className="w-4 h-4 mr-2" />Add Expense</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div variants={item}>
          {loading ? <Skeleton className="h-28 w-full rounded-xl" /> : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="border-l-4 border-l-primary hover:shadow-md transition-shadow cursor-default">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">You are owed</p>
                          <p className="text-2xl font-bold text-primary mt-1">₹{balance?.totalOwed?.toFixed(2) || '0.00'}</p>
                          <p className="text-xs text-muted-foreground mt-1">Across all groups</p>
                        </div>
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                          <ArrowUpRight className="w-5 h-5 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Total amount others owe you</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </motion.div>

        <motion.div variants={item}>
          {loading ? <Skeleton className="h-28 w-full rounded-xl" /> : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="border-l-4 border-l-destructive hover:shadow-md transition-shadow cursor-default">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">You owe</p>
                          <p className="text-2xl font-bold text-destructive mt-1">₹{balance?.totalOwing?.toFixed(2) || '0.00'}</p>
                          <p className="text-xs text-muted-foreground mt-1">Across all groups</p>
                        </div>
                        <div className="w-11 h-11 rounded-full bg-destructive/10 flex items-center justify-center">
                          <ArrowDownRight className="w-5 h-5 text-destructive" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Total amount you owe others</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </motion.div>
      </div>


      {!isEmpty && (
        <motion.div variants={item} className="flex flex-wrap gap-2">
          <Button onClick={() => setView('add-expense')} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="w-4 h-4 mr-1.5" />Add Expense</Button>
          <Button variant="outline" size="sm" onClick={() => setView('groups')}><Users className="w-4 h-4 mr-1.5" />Groups</Button>
          {hasBalance && (
            <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10" onClick={() => setView('settle')}><HandCoins className="w-4 h-4 mr-1.5" />Settle Up</Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setView('ai-assistant')}><TrendingUp className="w-4 h-4 mr-1.5" />Ask AI</Button>
        </motion.div>
      )}


      {groups.length > 0 && (
        <motion.div variants={item}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Your Groups</h3>
            <Button variant="ghost" size="sm" className="text-primary" onClick={() => setView('groups')}>View all</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups.map((group) => (
              <Card key={group.id} className="cursor-pointer hover:shadow-md transition-all duration-200" onClick={() => navigateToGroup(group.id)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{group.emoji || '👥'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.memberCount} member{group.memberCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Your balance</span>
                    <span className={`text-sm font-semibold ${(group.yourBalance || 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(group.yourBalance || 0)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}


      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
          <Button variant="ghost" size="sm" className="text-primary" onClick={() => setView('activity')}>View all</Button>
        </div>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-4">{Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-full" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div>
                </div>
              ))}</div>
            ) : activities.length === 0 ? (
              <div className="p-8 text-center">
                <Receipt className="w-9 h-9 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground mt-1">Add your first expense to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {activities.map((act) => (
                  <div key={act.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{act.message}</p>
                      <p className="text-xs text-muted-foreground">{act.user?.name} · {act.createdAt ? new Date(act.createdAt).toLocaleDateString() : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
