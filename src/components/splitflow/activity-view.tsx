'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  Receipt,
  Plus,
  Users,
  HandCoins,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSocket } from '@/hooks/use-socket';

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  groupId: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

interface Group {
  id: string;
  name: string;
  emoji: string;
}

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  expense_added: Receipt,
  expense_deleted: Receipt,
  member_joined: Users,
  member_left: Users,
  settlement: HandCoins,
  group_created: Plus,
};

export function ActivityView() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filterGroup, setFilterGroup] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const { on } = useSocket();

  const fetchActivities = useCallback(async (append = false) => {
    const currentPage = append ? page : 0;
    const offset = currentPage * 20;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20', offset: String(offset) });
      if (filterGroup !== 'all') params.set('groupId', filterGroup);
      const res = await fetch(`/api/activity?${params}`);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.activities || [];
        if (append) {
          setActivities((prev) => [...prev, ...items]);
          setPage((prev) => prev + 1);
        } else {
          setActivities(items);
          setPage(0);
        }
        setHasMore(items.length === 20);
      }
    } catch {
      console.error('Failed to fetch activities');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filterGroup, page]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Fetch groups for filter tabs
  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('/api/groups');
        if (res.ok) {
          const data = await res.json();
          setGroups(Array.isArray(data) ? data : data.groups || []);
        }
      } catch {
        console.error('Failed to fetch groups for activity filter');
      }
    }
    fetchGroups();
  }, []);

  // Reset page when filter changes
  useEffect(() => {
    setPage(0);
  }, [filterGroup]);

  // WebSocket real-time updates
  useEffect(() => {
    const cleanup = on('new-activity', (activity: ActivityItem) => {
      setActivities((prev) => [activity, ...prev]);
    });
    return cleanup;
  }, [on]);

  const getActivityIcon = (type: string) => {
    return ACTIVITY_ICONS[type] || Activity;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Group filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          size="sm"
          variant={filterGroup === 'all' ? 'default' : 'outline'}
          className={filterGroup === 'all' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shrink-0' : 'shrink-0'}
          onClick={() => setFilterGroup('all')}
        >
          All
        </Button>
        {groups.map((g) => (
          <Button
            key={g.id}
            size="sm"
            variant={filterGroup === g.id ? 'default' : 'outline'}
            className={filterGroup === g.id ? 'bg-emerald-600 hover:bg-emerald-700 text-white shrink-0' : 'shrink-0'}
            onClick={() => setFilterGroup(g.id)}
          >
            {g.emoji} {g.name}
          </Button>
        ))}
      </div>

      {/* Activity list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No activity yet</p>
            <p className="text-sm text-gray-400 mt-1">Activity will appear here as you use SplitFlow.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {activities.map((act, idx) => {
              const Icon = getActivityIcon(act.type);
              return (
                <motion.div
                  key={act.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <Card className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarFallback className="bg-emerald-50 text-emerald-700 text-sm font-semibold">
                          {act.user?.name?.charAt(0)?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="text-gray-500">{act.message}</span>
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 w-24 text-right">
                        {act.createdAt
                          ? formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })
                          : ''}
                      </span>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {hasMore && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchActivities(true)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
