'use client';

import { useState, useEffect } from 'react';
import {
  Trash2,
  Calendar,
  User,
  Tag,
  Receipt,
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
      .then((data) => setExpense(data.expense || data))
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
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Receipt className="w-3 h-3" />Amount
                </p>
                <p className="text-lg font-bold text-gray-900">
                  ₹{expense.amount.toFixed(2)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Tag className="w-3 h-3" />Category
                </p>
                <p className="text-sm font-medium text-gray-900 capitalize">
                  {catEmoji} {expense.category || 'General'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <User className="w-3 h-3" />Paid by
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {expense.paidBy?.name || 'Unknown'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />Date
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {expense.date ? new Date(expense.date).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>

            {expense.note && (
              <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                {expense.note}
              </div>
            )}

            <Separator />

            {/* Split breakdown */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Split Breakdown ({expense.splitType || 'equal'})
              </p>
              <div className="space-y-2">
                {expense.splits?.map((split) => (
                  <div key={split.userId} className="flex items-center gap-2">
                    <Avatar className="w-7 h-7">
                      <AvatarFallback className="bg-emerald-50 text-emerald-700 text-xs font-semibold">
                        {split.userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm text-gray-700">
                      {split.userName}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      ₹{split.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
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
