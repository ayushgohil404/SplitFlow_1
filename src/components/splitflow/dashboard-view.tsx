'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  HandCoins,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  TrendingUp,
  CircleDollarSign,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';

interface BalanceData {
  totalOwed: number;
  totalOwing: number;
  net: number;
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  amount: number;
  groupName: string;
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

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [balRes, actRes, grpRes] = await Promise.allSettled([
          fetch('/api/user/balance'),
          fetch('/api/activity?limit=10'),
          fetch('/api/groups'),
        ]);
        if (balRes.status === 'fulfilled' && balRes.value.ok) {
          const balData = await balRes.value.json();
          setBalance(balData);
        }
        if (actRes.status === 'fulfilled' && actRes.value.ok) {
          const actData = await actRes.value.json();
          setActivities(Array.isArray(actData) ? actData : actData.items || []);
        }
        if (grpRes.status === 'fulfilled' && grpRes.value.ok) {
          const grpData = await grpRes.value.json();
          setGroups(Array.isArray(grpData) ? grpData : grpData.groups || []);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const formatCurrency = (amount: number) => {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}$${Math.abs(amount).toFixed(2)}`;
  };

  const isEmpty = !loading && !balance?.totalOwed && !balance?.totalOwing && groups.length === 0;

  if (isEmpty) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6">
          <CircleDollarSign className="w-10 h-10 text-emerald-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Welcome to SplitFlow!</h3>
        <p className="text-gray-500 mb-8 max-w-sm">
          Start by creating a group with your friends, then add expenses to split them fairly.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button
            onClick={() => setView('add-expense')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
          <Button variant="outline" onClick={() => setView('groups')}>
            <Users className="w-4 h-4 mr-2" />
            Create Group
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div variants={item}>
          {loading ? (
            <Skeleton className="h-28 w-full rounded-xl" />
          ) : (
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">You are owed</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-1">
                      ${balance?.totalOwed?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                    <ArrowUpRight className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        <motion.div variants={item}>
          {loading ? (
            <Skeleton className="h-28 w-full rounded-xl" />
          ) : (
            <Card className="border-l-4 border-l-red-400">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">You owe</p>
                    <p className="text-3xl font-bold text-red-500 mt-1">
                      ${balance?.totalOwing?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                    <ArrowDownRight className="w-6 h-6 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* Quick actions */}
      <motion.div variants={item} className="flex flex-wrap gap-3">
        <Button onClick={() => setView('add-expense')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" />Add Expense
        </Button>
        <Button variant="outline" onClick={() => setView('settle')}>
          <HandCoins className="w-4 h-4 mr-2" />Settle Up
        </Button>
        <Button variant="outline" onClick={() => setView('groups')}>
          <Users className="w-4 h-4 mr-2" />Create Group
        </Button>
      </motion.div>

      {/* Groups summary */}
      {groups.length > 0 && (
        <motion.div variants={item}>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Your Groups</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigateToGroup(group.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{group.emoji || '👥'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{group.name}</p>
                      <p className="text-xs text-gray-500">{group.memberCount} members</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Your balance</span>
                    <span
                      className={`text-sm font-semibold ${
                        (group.yourBalance || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {formatCurrency(group.yourBalance || 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent activity */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Recent Activity</h3>
          <Button variant="ghost" size="sm" className="text-emerald-600" onClick={() => setView('activity')}>
            View all
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="p-8 text-center">
                <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {activities.map((act) => (
                  <div key={act.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{act.description}</p>
                      <p className="text-xs text-gray-500">{act.groupName} · {act.user?.name}</p>
                    </div>
                    <span className="text-sm font-medium text-gray-700 shrink-0">
                      ${act.amount?.toFixed(2)}
                    </span>
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
