'use client';

import { useState, useEffect } from 'react';
import {
  Trash2,
  Calendar,
  User,
  Tag,
  Receipt,
  Wallet,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Split {
  userId: string;
  userName: string;
  amount: number;
  paidAmount?: number;
}

interface ExpenseDetail {
  id: string;
  description: string;
  amount: number;
  category: string;
  categoryEmoji: string;
  date: string;
  paidBy: { id: string; name: string };
  splitType: string;
  splits: Split[];
  groupName: string;
  note?: string;
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

interface ExpenseDetailDialogProps {
  expenseId: string;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  onDeleted?: () => void;
}

export function ExpenseDetailDialog({
  expenseId,
  open,
  onClose,
  onUpdated,
  onDeleted,
}: ExpenseDetailDialogProps) {
  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || !expenseId) return;
    setLoading(true);
    fetch(`/api/expenses/${expenseId}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => {
        const raw = data.expense || data;
        // Map splits to flatten user.name into userName
        const mapped = {
          ...raw,
          splits: (raw.splits || []).map((s: any) => ({
            ...s,
            userName: s.user?.name || s.userName || 'Unknown',
          })),
          paidBy: raw.paidBy
            ? { name: raw.paidBy.name || 'Unknown', id: raw.paidBy.id }
            : { name: 'Unknown', id: '' },
          groupName: raw.group?.name || '',
          categoryEmoji: CATEGORY_EMOJIS[raw.category || ''] || '\u{1F4CB}',
        };
        setExpense(mapped);
      })
      .catch(() => toast.error('Failed to load expense'))
      .finally(() => setLoading(false));
  }, [open, expenseId]);

  const handleDelete = async () => {
    if (!expenseId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Expense deleted');
        onDeleted?.();
        onClose();
      } else {
        toast.error('Failed to delete expense');
      }
    } catch {
      toast.error('Failed to delete expense');
    } finally {
      setDeleting(false);
    }
  };

  const catEmoji = expense?.categoryEmoji || CATEGORY_EMOJIS[expense?.category || ''] || '📋';

  // Check if multi-payer (any split has paidAmount > 0)
  const isMultiPayer = expense?.splits?.some(s => (s.paidAmount || 0) > 0.005) || false;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{catEmoji}</span>
            {expense?.description || 'Expense Details'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
            <Skeleton className="h-4 w-full" />
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="w-7 h-7 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-14" />
              </div>
            ))}</div>
          </div>
        ) : expense ? (
          <div className="space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Receipt className="w-3 h-3" />Amount
                </p>
                <p className="text-lg font-bold text-foreground">
                  ₹{(Number(expense.amount) || 0).toFixed(2)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Tag className="w-3 h-3" />Category
                </p>
                <p className="text-sm font-medium text-foreground capitalize">
                  {catEmoji} {expense.category || 'General'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />Date
                </p>
                <p className="text-sm font-medium text-foreground">
                  {expense.date ? new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" />Split Type
                </p>
                <p className="text-sm font-medium text-foreground capitalize">
                  {expense.splitType || 'equal'}
                </p>
              </div>
            </div>

            {expense.note && (
              <div className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
                {expense.note}
              </div>
            )}

            <Separator />

            {/* Who paid section - show multi-payer info if applicable */}
            {isMultiPayer && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Wallet className="w-3 h-3" />Who Paid
                </p>
                <div className="space-y-1.5">
                  {expense.splits
                    .filter(s => (s.paidAmount || 0) > 0.005)
                    .map((split) => (
                      <div key={split.userId} className="flex items-center gap-2 px-2 py-1.5 bg-primary/5 rounded-lg">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="bg-primary/10 text-foreground text-[10px] font-semibold">
                            {split.userName?.charAt(0)?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-xs text-foreground">{split.userName}</span>
                        <span className="text-xs font-semibold text-foreground">₹{(Number(split.paidAmount) || 0).toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Split Breakdown */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Split Breakdown ({expense.splitType || 'equal'})
              </p>
              <div className="space-y-2">
                {expense.splits?.map((split) => (
                  <div key={split.userId} className="flex items-center gap-2">
                    <Avatar className="w-7 h-7">
                      <AvatarFallback className="bg-primary/10 text-foreground text-xs font-semibold">
                        {split.userName?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground">
                        {split.userName}
                      </span>
                      {isMultiPayer && (split.paidAmount || 0) > 0.005 && (
                        <span className="text-[10px] text-primary ml-1.5">
                          (paid ₹{(split.paidAmount || 0).toFixed(2)})
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-foreground">
                        ₹{(Number(split.amount) || 0).toFixed(2)}
                      </span>
                      {isMultiPayer && (
                        <p className={`text-[10px] ${
                          (Number(split.paidAmount || 0) - Number(split.amount)) > 0.005
                            ? 'text-primary'
                            : (Number(split.paidAmount || 0) - Number(split.amount)) < -0.005
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                        }` }>
                          {(() => {
                            const diff = Math.round((Number(split.paidAmount || 0) - Number(split.amount)) * 100) / 100;
                            if (Math.abs(diff) <= 0.005) return 'settled';
                            return diff > 0 ? `gets back ₹${diff.toFixed(2)}` : `owes ₹${Math.abs(diff).toFixed(2)}`;
                          })()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
