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
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useAppStore } from '@/store/app-store';

interface GroupBalance {
  groupId: string;
  groupName: string;
  groupEmoji: string;
  yourBalance: number;
}

interface BalanceDetail {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
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
  from: string;
  to: string;
  amount: number;
}

export function SettleView() {
  const { user } = useAppStore();
  const [groupBalances, setGroupBalances] = useState<GroupBalance[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [balances, setBalances] = useState<BalanceDetail[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [simplified, setSimplified] = useState<SimplifiedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [simplifyLoading, setSimplifyLoading] = useState(false);

  // Record payment dialog
  const [recordOpen, setRecordOpen] = useState(false);
  const [payFrom, setPayFrom] = useState('');
  const [payTo, setPayTo] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payAmountError, setPayAmountError] = useState('');
  const [payNote, setPayNote] = useState('');
  const [recording, setRecording] = useState(false);

  const fetchGroupBalances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/balance');
      if (res.ok) {
        const data = await res.json();
        setGroupBalances(data.groups || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroupBalances();
  }, [fetchGroupBalances]);

  const fetchGroupDetail = useCallback(async (groupId: string) => {
    setDetailLoading(true);
    setSimplified([]);
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      if (res.ok) {
        const data = await res.json();
        setBalances(data.balances || []);
        setSettlements(data.settlements || []);
      }
    } catch {
      // silent
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
        setSimplified(data.payments || []);
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
      setPayAmountError('Enter a valid amount greater than $0');
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
          fromId: payFrom,
          toId: payTo,
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
        fetchGroupBalances();
      } else {
        toast.error('Failed to record payment');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setRecording(false);
    }
  };

  const totalOwed = groupBalances
    .filter((g) => g.yourBalance > 0)
    .reduce((sum, g) => sum + g.yourBalance, 0);
  const totalOwing = groupBalances
    .filter((g) => g.yourBalance < 0)
    .reduce((sum, g) => sum + Math.abs(g.yourBalance), 0);
  const hasAnyBalance = totalOwed > 0 || totalOwing > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Others owe you</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">${totalOwed.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-400">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">You owe others</p>
                <p className="text-2xl font-bold text-red-500 mt-1">${totalOwing.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <ArrowDownRight className="w-6 h-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Group balances list */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : !hasAnyBalance ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">All settled up!</h3>
            <p className="text-sm text-gray-500">You don&apos;t owe anyone and no one owes you. Nice!</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select a group to settle</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {groupBalances.map((gb) => {
                const isActive = selectedGroupId === gb.groupId;
                return (
                  <button
                    key={gb.groupId}
                    className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left ${
                      isActive ? 'bg-emerald-50/50 border-l-2 border-l-emerald-500' : ''
                    }`}
                    onClick={() => setSelectedGroupId(gb.groupId)}
                  >
                    <span className="text-2xl">{gb.groupEmoji || '👥'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{gb.groupName}</p>
                      {isActive && <p className="text-xs text-emerald-600 mt-0.5">Selected</p>}
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        gb.yourBalance >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {gb.yourBalance >= 0 ? '+' : ''}
                      ${gb.yourBalance.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected group detail */}
      {selectedGroupId && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900">Detailed Balances</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : balances.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 font-medium">All settled up in this group!</p>
                <p className="text-xs text-gray-400 mt-1">No outstanding balances</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {balances.map((b, idx) => {
                const isYouOwe = b.from?.id === user?.id;
                const isOwedToYou = b.to?.id === user?.id;
                return (
                  <Card key={idx} className={isYouOwe || isOwedToYou ? 'ring-1 ring-emerald-100' : ''}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isYouOwe ? 'bg-red-50' : 'bg-emerald-50'}`}>
                        {isYouOwe ? (
                          <ArrowDownRight className="w-5 h-5 text-red-500" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{b.from?.name || 'Someone'}</span>
                          {' → '}
                          <span className="font-medium">{b.to?.name || 'Someone'}</span>
                        </p>
                        {isYouOwe && <p className="text-xs text-red-500 mt-0.5">You need to pay</p>}
                        {isOwedToYou && <p className="text-xs text-emerald-600 mt-0.5">Owed to you</p>}
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${isYouOwe ? 'text-red-500' : isOwedToYou ? 'text-emerald-600' : 'text-gray-700'}`}>
                        ${b.amount.toFixed(2)}
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Simplified payments */}
          {simplified.length > 0 && (
            <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-teal-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" />Optimal Payment Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500 mb-3">Reduce from {balances.length} transactions to {simplified.length}:</p>
                <div className="space-y-2">
                  {simplified.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-emerald-100">
                      <span className="text-sm flex-1 text-gray-900 font-medium">{p.from} → {p.to}</span>
                      <span className="text-sm font-bold text-emerald-700">${p.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent settlements */}
          {settlements.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Recent Settlements</h4>
              <div className="space-y-2">
                {settlements.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{s.from?.name} paid {s.to?.name}</p>
                      {s.note && <p className="text-xs text-gray-500">{s.note}</p>}
                    </div>
                    <span className="text-sm font-semibold text-gray-700">${s.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record a Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500 leading-relaxed">
              Record that a payment was made. This will reduce the outstanding balance.
            </p>
            <div className="space-y-1.5">
              <Label>From (payer) <span className="text-red-400">*</span></Label>
              <Select value={payFrom} onValueChange={setPayFrom}>
                <SelectTrigger><SelectValue placeholder="Who is paying?" /></SelectTrigger>
                <SelectContent>
                  {balances.map((b, idx) => (
                    <SelectItem key={`from-${idx}`} value={b.from?.id || ''}>{b.from?.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To (receiver) <span className="text-red-400">*</span></Label>
              <Select value={payTo} onValueChange={setPayTo}>
                <SelectTrigger><SelectValue placeholder="Who receives payment?" /></SelectTrigger>
                <SelectContent>
                  {balances.map((b, idx) => (
                    <SelectItem key={`to-${idx}`} value={b.to?.id || ''}>{b.to?.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Amount <span className="text-red-400">*</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                <Input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => { setPayAmount(e.target.value); setPayAmountError(''); }}
                  className={`pl-7 ${payAmountError ? 'border-red-300' : ''}`}
                />
              </div>
              {payAmountError && <p className="text-xs text-red-500 mt-1">{payAmountError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-note">Note <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                id="pay-note"
                placeholder="e.g., Venmo, Cash, UPI"
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {recording ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
