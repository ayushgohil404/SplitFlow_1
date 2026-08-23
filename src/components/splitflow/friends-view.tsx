'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  X,
  Mail,
  User,
  Clock,
  Loader2,
  Users,
  Send,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

interface Friend {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  friendshipId: string;
  friendsSince: string;
}

interface PendingRequest {
  id: string;
  user: { id: string; name: string | null; email: string; image: string | null };
  createdAt: string;
}

interface GroupBalance {
  groupId: string;
  groupName: string;
  groupEmoji: string;
  currency: string;
  balances: {
    userId: string;
    userName: string | null;
    amount: number;
  }[];
}

interface DirectBalance {
  userId: string;
  userName: string | null;
  amount: number;
  isEmail: boolean;
}

export function FriendsView() {
  const { user } = useAppStore();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingReceived, setPendingReceived] = useState<PendingRequest[]>([]);
  const [pendingSent, setPendingSent] = useState<PendingRequest[]>([]);
  const [groupBalances, setGroupBalances] = useState<GroupBalance[]>([]);
  const [directBalances, setDirectBalances] = useState<DirectBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFriend, setExpandedFriend] = useState<string | null>(null);

  // Add friend dialog
   const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [friendsRes, balanceRes] = await Promise.all([
        fetch('/api/friends'),
        fetch('/api/user/balance'),
      ]);

      if (friendsRes.ok) {
        const data = await friendsRes.json();
        setFriends(data.friends || []);
        setPendingReceived(data.pendingReceived || []);
        setPendingSent(data.pendingSent || []);
      }

      if (balanceRes.ok) {
        const data = await balanceRes.json();
        setGroupBalances(data.groups || []);
        setDirectBalances(data.direct || []);
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get net balance for a friend across all groups + direct
  const getFriendNetBalance = (friendId: string): number => {
    let net = 0;

    // From group balances
    for (const gb of groupBalances) {
      const bal = gb.balances.find((b) => b.userId === friendId);
      if (bal) net += bal.amount;
    }

    // From direct balances
    const direct = directBalances.find((d) => d.userId === friendId);
    if (direct) net += direct.amount;

    return Math.round(net * 100) / 100;
  };

  const getFriendGroupBreakdown = (friendId: string) => {
    return groupBalances
      .map((gb) => {
        const bal = gb.balances.find((b) => b.userId === friendId);
        if (!bal || Math.abs(bal.amount) < 0.005) return null;
        return {
          groupId: gb.groupId,
          groupName: gb.groupName,
          groupEmoji: gb.groupEmoji,
          amount: bal.amount,
        };
      })
      .filter(Boolean);
  };

  const handleAddFriend = async () => {
    if (!addEmail.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Friend request sent!');
        setAddOpen(false);
        setAddEmail('');
        fetchData();
      } else if (res.status === 404 && data.code === 'USER_NOT_FOUND') {
        toast.info(data.error);
      } else {
        toast.error(data.error || 'Failed to send request');
      }
    } catch {
      toast.error('Failed to send request');
    } finally {
      setAdding(false);
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      const res = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId, action: 'accept' }),
      });
      if (res.ok) {
        toast.success('Friend request accepted!');
        fetchData();
      }
    } catch {
      toast.error('Failed to accept');
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    try {
      const res = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId, action: 'decline' }),
      });
      if (res.ok) {
        toast.success('Request declined');
        fetchData();
      }
    } catch {
      toast.error('Failed to decline');
    }
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    try {
      const res = await fetch(`/api/friends?id=${friendshipId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Friend removed');
        fetchData();
      }
    } catch {
      toast.error('Failed to remove friend');
    }
  };

  // Summary calculations
  const totalOwedToMe = friends
    .map((f) => getFriendNetBalance(f.id))
    .filter((a) => a > 0)
    .reduce((s, a) => s + a, 0);

  const totalIOwe = friends
    .map((f) => getFriendNetBalance(f.id))
    .filter((a) => a < 0)
    .reduce((s, a) => s + Math.abs(a), 0);

  // Also count direct balances with non-friends
  const nonFriendDirect = directBalances.filter(
    (d) => !friends.some((f) => f.id === d.userId)
  );
  const nonFriendOwed = nonFriendDirect.filter((d) => d.amount > 0).reduce((s, d) => s + d.amount, 0);
  const nonFriendIOwe = nonFriendDirect.filter((d) => d.amount < 0).reduce((s, d) => s + Math.abs(d.amount), 0);

  const grandTotalOwed = totalOwedToMe + nonFriendOwed;
  const grandTotalIOwe = totalIOwe + nonFriendIOwe;

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Friends</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage friends and balances.</p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-primary hover:bg-primary/90 text-white"
          size="sm"
        >
          <UserPlus className="w-4 h-4 mr-1.5" />Add Friend
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-primary" />
              <p className="text-xs text-primary font-medium">Friends owe you</p>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">₹{grandTotalOwed.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-destructive" />
              <p className="text-xs text-destructive font-medium">You owe friends</p>
            </div>
            <p className="text-2xl font-bold text-destructive mt-1">₹{grandTotalIOwe.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Friend Requests */}
      {pendingReceived.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pending Requests ({pendingReceived.length})
          </h3>
          {pendingReceived.map((req) => (
            <Card key={req.id} className="border-amber-200 bg-amber-50/30">
              <CardContent className="p-4 flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-amber-100 text-amber-700 text-sm font-semibold">
                    {req.user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{req.user.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{req.user.email}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    className="h-8 bg-primary hover:bg-primary/90 text-white"
                    onClick={() => handleAcceptRequest(req.id)}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-destructive hover:text-red-700 hover:bg-destructive/10"
                    onClick={() => handleDeclineRequest(req.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sent Requests */}
      {pendingSent.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Send className="w-3.5 h-3.5" />
            Sent Requests ({pendingSent.length})
          </h3>
          {pendingSent.map((req) => (
            <Card key={req.id} className="opacity-60">
              <CardContent className="p-4 flex items-center gap-3">
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                    {req.user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{req.user.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{req.user.email}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">Pending</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Friends List */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Your Friends ({friends.length})
        </h3>

        {friends.length === 0 && pendingReceived.length === 0 && pendingSent.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No friends yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Add friends by email to start splitting expenses directly</p>
              <Button
                onClick={() => setAddOpen(true)}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <UserPlus className="w-4 h-4 mr-1.5" />Add Friend
              </Button>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence>
            {friends.map((friend) => {
              const netBalance = getFriendNetBalance(friend.id);
              const isExpanded = expandedFriend === friend.id;
              const breakdown = getFriendGroupBreakdown(friend.id);

              return (
                <motion.div
                  key={friend.id}
                  layout
                  className={isExpanded ? 'col-span-full' : ''}
                >
                  <Card
                    className="cursor-pointer hover:shadow-sm transition-all"
                    onClick={() => setExpandedFriend(isExpanded ? null : friend.id)}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary/10 text-foreground text-sm font-semibold">
                          {friend.name?.charAt(0)?.toUpperCase() || friend.email?.charAt(0)?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {friend.name || friend.email}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{friend.email}</p>
                      </div>
                      {Math.abs(netBalance) > 0.005 ? (
                        <span className={`text-sm font-bold shrink-0 ${netBalance > 0 ? 'text-primary' : 'text-destructive'}`}>
                          {netBalance > 0 ? '+' : ''}₹{netBalance.toFixed(2)}
                        </span>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] shrink-0 bg-muted text-muted-foreground">Settled</Badge>
                      )}
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </CardContent>
                  </Card>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2">
                          {/* Group-by-group breakdown */}
                          {breakdown.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">By Group</p>
                              {breakdown.map((b: any) => (
                                <div key={b.groupId} className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg">
                                  <span className="text-sm text-foreground">{b.groupEmoji} {b.groupName}</span>
                                  <span className={`text-sm font-medium ${b.amount > 0 ? 'text-primary' : 'text-destructive'}`}>
                                    {b.amount > 0 ? '+' : ''}₹{(Number(b.amount) || 0).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-red-700 hover:bg-destructive/10"
                              onClick={(e) => { e.stopPropagation(); handleRemoveFriend(friend.friendshipId); }}
                            >
                              Remove Friend
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Non-friend direct balances (people you've split with but aren't friends) */}
      {nonFriendDirect.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Other Balances</h3>
          {nonFriendDirect.map((d, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  {d.isEmail ? <Mail className="w-5 h-5 text-muted-foreground" /> : <User className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{d.userName || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{d.isEmail ? 'Not yet a user' : 'Not friends'}</p>
                </div>
                <span className={`text-sm font-bold ${d.amount > 0 ? 'text-primary' : 'text-destructive'}`}>
                  {d.amount > 0 ? '+' : ''}₹{(Number(d.amount) || 0).toFixed(2)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Friend Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Add Friend
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enter your friend&apos;s email address. If they&apos;re already on SplitFlow, they&apos;ll receive a friend request. If not, you can still add expenses using their email.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="friend-email">Friend&apos;s Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="friend-email"
                  type="email"
                  placeholder="friend@email.com"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
                />
              </div>
            </div>
            <Button
              onClick={handleAddFriend}
              disabled={!addEmail.trim() || adding}
              className="w-full bg-primary hover:bg-primary/90 text-white"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              {adding ? 'Sending...' : 'Send Friend Request'}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
