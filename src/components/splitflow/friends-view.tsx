'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAppStore } from '@/store/app-store';

interface FriendBalance {
  userId: string;
  userName: string;
  userEmail: string;
  totalBalance: number;
  groups: {
    groupId: string;
    groupName: string;
    groupEmoji: string;
    balance: number;
  }[];
}

export function FriendsView() {
  const [friends, setFriends] = useState<FriendBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/balance');
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const totalOwed = useMemo(
    () => friends.filter((f) => f.totalBalance > 0).reduce((s, f) => s + f.totalBalance, 0),
    [friends]
  );
  const totalOwing = useMemo(
    () => friends.filter((f) => f.totalBalance < 0).reduce((s, f) => s + Math.abs(f.totalBalance), 0),
    [friends]
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Friends owe you</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">${totalOwed.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-400">
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">You owe friends</p>
            <p className="text-2xl font-bold text-red-500 mt-1">${totalOwing.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Friends list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : friends.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No friends yet</h3>
            <p className="text-sm text-gray-500">
              Friends will appear here once you join or create groups with others.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {friends.map((friend) => (
            <Card key={friend.userId} className="overflow-hidden">
              <button
                className="w-full text-left"
                onClick={() =>
                  setExpandedId(expandedId === friend.userId ? null : friend.userId)
                }
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarFallback className="bg-emerald-50 text-emerald-700 font-semibold">
                      {friend.userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {friend.userName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {friend.groups?.length || 0} shared group{(friend.groups?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {friend.totalBalance !== 0 && (
                      <span
                        className={`text-sm font-semibold ${
                          friend.totalBalance > 0 ? 'text-emerald-600' : 'text-red-500'
                        }`
                      }
                      >
                        {friend.totalBalance > 0 ? '+' : ''}
                        ${friend.totalBalance.toFixed(2)}
                      </span>
                    )}
                    {expandedId === friend.userId ? (
                      <ChevronLeft className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </CardContent>
              </button>

              {/* Expanded: group-by-group breakdown */}
              <AnimatePresence>
                {expandedId === friend.userId && friend.groups?.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-2 border-t border-gray-100 pt-3">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Group Breakdown
                      </p>
                      {friend.groups.map((g) => (
                        <div
                          key={g.groupId}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="text-base">{g.groupEmoji || '👥'}</span>
                          <span className="flex-1 text-gray-700 truncate">
                            {g.groupName}
                          </span>
                          <span
                            className={`font-medium ${
                              g.balance > 0 ? 'text-emerald-600' : g.balance < 0 ? 'text-red-500' : 'text-gray-400'
                            }`
                          }
                          >
                            {g.balance > 0 ? '+' : ''}${g.balance.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
