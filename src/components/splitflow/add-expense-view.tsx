'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Loader2,
  Plus,
  Camera,
  Info,
  Users,
  Mail,
  X,
  UserPlus,
  User,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

interface Group {
  id: string;
  name: string;
  emoji: string;
}

interface Member {
  id: string;
  name: string;
  email?: string;
}

interface Friend {
  id: string;
  name: string;
  email: string;
}

interface EmailParticipant {
  email: string;
  name: string;
}

const CATEGORIES = [
  { value: 'food', label: '🍕 Food & Dining' },
  { value: 'travel', label: '✈️ Travel' },
  { value: 'housing', label: '🏠 Housing' },
  { value: 'entertainment', label: '🎉 Entertainment' },
  { value: 'utilities', label: '💡 Utilities' },
  { value: 'shopping', label: '🛍️ Shopping' },
  { value: 'transport', label: '🚗 Transport' },
  { value: 'health', label: '🏥 Health' },
  { value: 'education', label: '📚 Education' },
  { value: 'general', label: '📋 General' },
];

type ExpenseMode = 'group' | 'direct';

export function AddExpenseView() {
  const { selectedGroupId, navigateToGroup, setView, user } = useAppStore();

  // Expense mode
  const [mode, setMode] = useState<ExpenseMode>(selectedGroupId ? 'group' : 'direct');

  // Data
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // AI NLP input
  const [nlpInput, setNlpInput] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);
  // Stores parsed friend split amounts (name → value) from AI parse, applied after useEffect
  const [pendingFriendSplitValues, setPendingFriendSplitValues] = useState<Record<string, string>>({});

  // Form fields
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [descError, setDescError] = useState('');
  const [category, setCategory] = useState('general');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [groupId, setGroupId] = useState(selectedGroupId || '');
  const [paidById, setPaidById] = useState(user?.id || '');
  const [splitType, setSplitType] = useState<'equal' | 'share' | 'exact' | 'percentage'>('equal');
  const [splits, setSplits] = useState<{ userId: string; value: string; share: number }[]>([]);
  const [note, setNote] = useState('');

  // Direct expense: selected friends + email participants
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [emailParticipants, setEmailParticipants] = useState<EmailParticipant[]>([]);
  const [emailSplitAmounts, setEmailSplitAmounts] = useState<Record<string, string>>({});
  const [userSplitValue, setUserSplitValue] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');

  // Receipt upload
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  // AI categorize
  const [categorizeLoading, setCategorizeLoading] = useState(false);

  // Submitting
  const [submitting, setSubmitting] = useState(false);

  // Fetch groups
  useEffect(() => {
    async function fetchData() {
      try {
        const [groupsRes, friendsRes] = await Promise.all([
          fetch('/api/groups'),
          fetch('/api/friends'),
        ]);
        if (groupsRes.ok) {
          const data = await groupsRes.json();
          const list = Array.isArray(data) ? data : data.groups || [];
          setGroups(list);
          if (!selectedGroupId && list.length > 0) {
            setGroupId(list[0].id);
          }
        }
        if (friendsRes.ok) {
          const fData = await friendsRes.json();
          setFriends(fData.friends || []);
        }
      } catch {
        // silent
      }
    }
    fetchData();
  }, [selectedGroupId]);

  // Fetch group members when group changes
  useEffect(() => {
    if (mode !== 'group' || !groupId) return;
    setMembersLoading(true);
    async function fetchMembers() {
      try {
        const res = await fetch(`/api/groups/${groupId}`);
        if (res.ok) {
          const data = await res.json();
          const g = data.group || data;
          const memberList = ((g.members || []) as any[]).map((m: any) => ({
            id: m.user?.id || m.userId || m.id,
            name: m.user?.name || m.name || 'Unknown',
            email: m.user?.email || m.email || '',
          }));
          setMembers(memberList);
          setSplits(memberList.map((m: Member) => ({ userId: m.id, value: '', share: 1 })));
          const me = memberList.find((m: Member) => m.id === user?.id);
          if (me) setPaidById(me.id);
        }
      } catch {
        // silent
      } finally {
        setMembersLoading(false);
      }
    }
    fetchMembers();
  }, [groupId, mode, user?.id]);

  // AI parse expense
  const handleNlpSubmit = async () => {
    if (!nlpInput.trim()) return;
    setNlpLoading(true);
    // Clear pending values from previous parse
    setPendingFriendSplitValues({});
    try {
      const res = await fetch('/api/ai/parse-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nlpInput }),
      });
      const data = await res.json();

      // Handle HTTP errors and AI errors uniformly
      if (!res.ok && res.status !== 200) {
        toast.error(data.error || 'Could not parse expense. Try being more specific.');
        return;
      }
      if (data.error) {
        console.log('[AI Parse] Error response:', data);
        if (data.code === 'NOT_CONFIGURED') {
          toast.error('AI is not configured. Please set a valid GROQ_API_KEY in Vercel environment variables.');
        } else if (data.code === 'AI_ERROR') {
          toast.error(data.error);
        } else {
          toast.error(data.error || 'Could not parse expense. Try a different phrasing.');
        }
        return;
      }

      // Set basic fields
      if (data.description) { setDescription(data.description); setDescError(''); }
      if (data.amount) { setAmount(String(data.amount)); setAmountError(''); }
      if (data.category) setCategory(data.category);
      if (data.date) setDate(data.date);

      const sType = data.splitType as string;
      const isExactOrPct = sType === 'exact' || sType === 'percentage';

      // Handle group selection from AI parse
      if (data.groupId && typeof data.groupId === 'string') {
        const groupName = data.groupId.toLowerCase();
        const matchedGroup = groups.find((g) => g.name.toLowerCase() === groupName);
        if (matchedGroup) {
          setMode('group');
          setGroupId(matchedGroup.id);
          // Don't process friend/email splits for group expenses
          if (isExactOrPct) {
            setSplitType(sType as 'exact' | 'percentage');
          } else if (sType === 'equal' || sType === 'share') {
            setSplitType(sType === 'share' ? 'share' : 'equal');
          } else if (sType === 'single') {
            setSplitType('equal');
          }
          toast.success(`Expense parsed for group "${matchedGroup.name}"! Review and submit.`);
          return;
        }
        // Group name not found — fall through to direct mode
      }

      // Determine mode: switch to direct if there are email splits or named non-me splits
      const emailSplits = data.emailSplits as { email: string; name?: string; amount?: number; percentage?: number }[] | undefined;
      const namedSplits = data.splits as { name: string; amount?: number | null; percentage?: number | null; share?: number }[] | undefined;
      const hasEmails = emailSplits && emailSplits.length > 0;
      const hasNamedSplits = namedSplits && namedSplits.some((s) => s.name !== 'me');

      // Handle "single" / "only me" / personal expenses — no participants
      if (sType === 'single' && !hasEmails && !hasNamedSplits) {
        setMode('direct');
        setSelectedFriends([]);
        setEmailParticipants([]);
        setEmailSplitAmounts({});
        setPendingFriendSplitValues({});
        setSplitType('equal');
        toast.success('Expense parsed! No split needed — just submit.');
        return;
      }

      // Extract "me" split value for exact/percentage modes
      if (isExactOrPct) {
        const meSplit = namedSplits?.find((s) => s.name === 'me');
        if (meSplit && (meSplit.amount != null || meSplit.percentage != null)) {
          setUserSplitValue(String(meSplit.amount ?? meSplit.percentage));
        } else if (data.amount) {
          const totalAmt = parseFloat(String(data.amount));
          let othersTotal = 0;
          if (sType === 'exact') {
            for (const ns of (namedSplits || []).filter((s) => s.name !== 'me')) othersTotal += ns.amount ?? 0;
            for (const es of (emailSplits || [])) othersTotal += es.amount ?? 0;
          } else {
            for (const ns of (namedSplits || []).filter((s) => s.name !== 'me')) othersTotal += ns.percentage ?? 0;
            for (const es of (emailSplits || [])) othersTotal += es.percentage ?? 0;
          }
          const myValue = sType === 'exact'
            ? Math.round((totalAmt - othersTotal) * 100) / 100
            : Math.round((100 - othersTotal) * 100) / 100;
          setUserSplitValue(myValue > 0 ? String(myValue) : '');
        } else {
          setUserSplitValue('');
        }
      } else {
        setUserSplitValue('');
      }

      // Switch to direct mode when we have participants to add
      if (hasEmails || hasNamedSplits) {
        setMode('direct');
      }

      // Process email splits
      if (hasEmails) {
        const newEmailParts: EmailParticipant[] = emailSplits.map((es) => ({
          email: es.email,
          name: es.name || es.email.split('@')[0],
        }));
        setEmailParticipants(newEmailParts);

        if (isExactOrPct) {
          const amtMap: Record<string, string> = {};
          for (const es of emailSplits) {
            if (es.amount != null) amtMap[es.email] = String(es.amount);
            else if (es.percentage != null) amtMap[es.email] = String(es.percentage);
          }
          setEmailSplitAmounts(amtMap);
        } else {
          setEmailSplitAmounts({});
        }
      } else {
        setEmailParticipants([]);
        setEmailSplitAmounts({});
      }

      // Process named splits — match to friends or add as email participants
      const friendAmtMap: Record<string, string> = {};
      const nonMeSplits = (namedSplits || []).filter((s) => s.name !== 'me');

      for (const ns of nonMeSplits) {
        const friendMatch = friends.find(
          (f) =>
            f.name?.toLowerCase().trim() === ns.name?.toLowerCase().trim() ||
            f.email?.toLowerCase().split('@')[0] === ns.name?.toLowerCase().trim() ||
            f.email?.toLowerCase() === ns.name?.toLowerCase()
        );
        if (friendMatch) {
          if (!selectedFriends.includes(friendMatch.id)) {
            setSelectedFriends((prev) => [...prev, friendMatch.id]);
          }
          // For share type, set the friend's share value
          if (sType === 'share' && ns.share != null && ns.share > 0) {
            // We'll apply share values after the useEffect sets up splits
            friendAmtMap[friendMatch.id] = String(ns.share);
          } else if (isExactOrPct && (ns.amount != null || ns.percentage != null)) {
            friendAmtMap[friendMatch.id] = String(ns.amount ?? ns.percentage);
          }
        } else if (ns.name?.includes('@')) {
          // Named person looks like an email — add as email participant
          const emailAddr = ns.name.toLowerCase();
          if (!emailSplits?.some((es) => es.email.toLowerCase() === emailAddr)) {
            setEmailParticipants((prev) => [...prev, { email: emailAddr, name: ns.name.split('@')[0] }]);
            if (isExactOrPct && (ns.amount != null || ns.percentage != null)) {
              setEmailSplitAmounts((prev) => ({ ...prev, [emailAddr]: String(ns.amount ?? ns.percentage) }));
            }
          }
        }
        // If not a friend and not an email, we skip them — user can add manually
        // (non-registered users need an email to track)
      }

      if (Object.keys(friendAmtMap).length > 0) {
        setPendingFriendSplitValues(friendAmtMap);
      } else {
        setPendingFriendSplitValues({});
      }

      // Handle split type
      if (isExactOrPct) {
        setSplitType(sType as 'exact' | 'percentage');
      } else if (sType === 'share') {
        setSplitType('share');
        // Set owner share from AI parse if available
        const meSplit = namedSplits?.find((s) => s.name === 'me');
        if (meSplit?.share && typeof meSplit.share === 'number' && meSplit.share > 0) {
          setOwnerShare(meSplit.share);
        }
      } else if (sType === 'equal') {
        setSplitType('equal');
      } else if (sType === 'single') {
        setSplitType('equal');
      }

      toast.success('Expense parsed! Review the details and submit.');
    } catch (err: any) {
      console.error('[AI Parse] Client error:', err);
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setNlpLoading(false);
    }
  };

  // AI categorize
  const handleCategorize = async () => {
    if (!description.trim()) {
      toast.error('Enter a description first');
      return;
    }
    setCategorizeLoading(true);
    try {
      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          toast.error(data.error || 'Failed to categorize');
        } else if (data.category) {
          setCategory(data.category);
          toast.success(`Categorized as ${data.category}`);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to categorize');
      }
    } catch {
      toast.error('Failed to categorize');
    } finally {
      setCategorizeLoading(false);
    }
  };

  // Receipt upload
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Receipt image must be under 10MB');
      return;
    }
    setReceiptPreview(URL.createObjectURL(file));
    setReceiptLoading(true);
    try {
      const formData = new FormData();
      formData.append('receipt', file);
      const res = await fetch('/api/ai/receipt', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        if (data.description) { setDescription(data.description); setDescError(''); }
        if (data.amount) { setAmount(String(data.amount)); setAmountError(''); }
        if (data.category) setCategory(data.category);
        if (data.date) setDate(data.date);
        toast.success('Receipt scanned successfully!');
      } else {
        toast.error('Could not read receipt. Try a clearer photo.');
      }
    } catch {
      toast.error('Failed to scan receipt');
    } finally {
      setReceiptLoading(false);
    }
  };

  // Add email participant
  const addEmailParticipant = () => {
    if (!newEmail.trim()) return;
    const email = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (emailParticipants.some((p) => p.email === email)) {
      toast.error('This email is already added');
      return;
    }
    setEmailParticipants([...emailParticipants, { email, name: newName.trim() || email.split('@')[0] }]);
    setNewEmail('');
    setNewName('');
  };

  // Remove email participant
  const removeEmail = (email: string) => {
    setEmailParticipants(emailParticipants.filter((p) => p.email !== email));
    setEmailSplitAmounts((prev) => { const n = { ...prev }; delete n[email]; return n; });
  };

  // Toggle friend selection
  const toggleFriend = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  // Total participants in direct mode
  const totalDirectParticipants = 1 + selectedFriends.length + emailParticipants.length;
  const perPersonDirect = amount && !isNaN(parseFloat(amount)) && totalDirectParticipants > 0
    ? (parseFloat(amount) / totalDirectParticipants).toFixed(2)
    : '0.00';

  // Update split value
  const updateSplit = (userId: string, value: string) => {
    setSplits((prev) => prev.map((s) => (s.userId === userId ? { ...s, value } : s)));
  };

  const updateSplitShare = (userId: string, share: number) => {
    setSplits((prev) => prev.map((s) => (s.userId === userId ? { ...s, share: Math.max(1, share) } : s)));
  };

  // Validate form
  const validate = () => {
    let valid = true;
    if (!description.trim()) {
      setDescError('Please enter what the expense was for');
      valid = false;
    } else {
      setDescError('');
    }
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setAmountError('Please enter a valid amount greater than ₹0');
      valid = false;
    } else {
      setAmountError('');
    }
    if (mode === 'group' && !groupId) {
      toast.error('Please select a group');
      valid = false;
    }
    if (mode === 'direct' && selectedFriends.length === 0 && emailParticipants.length === 0 && splitType !== 'equal') {
      toast.error('Select at least one friend or add an email to split with');
      valid = false;
    }
    // For equal split with no participants, auto-switch to owner-only (no splits needed)
    if (mode === 'direct' && selectedFriends.length === 0 && emailParticipants.length === 0 && splitType === 'equal') {
      // Personal expense — submit without splits
    }
    return valid;
  };

  // Open email client with pre-drafted HTML for non-registered users
  const openEmailForNonRegistered = (participants: EmailParticipant[], desc: string, amt: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://splitflow-1.vercel.app';
    const landingUrl = `${baseUrl}/landing`;
    const toEmails = participants.map((p) => p.email).join(',');
    const names = participants.map((p) => p.name).join(', ');
    const userName = user?.name || 'Someone';

    const htmlBody = `
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#059669,#0d9488);padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#059669,#0d9488);padding:40px 30px;text-align:center;">
          <div style="font-size:36px;margin-bottom:10px;">💰</div>
          <h1 style="margin:0;color:white;font-size:24px;font-weight:800;">Split<span style="color:#a7f3d0;">Flow</span></h1>
          <p style="margin:8px 0 0;color:#a7f3d0;font-size:14px;">AI-Powered Expense Splitting</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:35px 30px;">
          <h2 style="margin:0 0 15px;color:#111827;font-size:20px;">Hey ${names}! 👋</h2>
          <p style="margin:0 0 20px;color:#4b5563;font-size:15px;line-height:1.6;">
            <strong>${userName}</strong> just added an expense on SplitFlow and split it with you!
          </p>
          <!-- Expense Card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:16px;padding:20px;margin-bottom:25px;">
            <tr>
              <td style="padding:5px 0;color:#059669;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Expense</td>
            </tr>
            <tr>
              <td style="padding:5px 0;color:#111827;font-size:22px;font-weight:700;">${desc}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;color:#059669;font-size:28px;font-weight:800;">₹${amt}</td>
            </tr>
          </table>
          <p style="margin:0 0 25px;color:#4b5563;font-size:15px;line-height:1.6;">
            Sign up for <strong>SplitFlow</strong> to see your balance, track shared expenses, and settle up easily. It's <strong>100% free</strong>!
          </p>
          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${landingUrl}" style="display:inline-block;background:linear-gradient(135deg,#059669,#0d9488);color:white;text-decoration:none;padding:16px 40px;border-radius:14px;font-size:16px;font-weight:700;box-shadow:0 10px 30px rgba(5,150,105,0.3);">
                Join SplitFlow Free →
              </a>
            </td></tr>
          </table>
          <!-- Features -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:30px;border-top:1px solid #f3f4f6;padding-top:25px;">
            <tr>
              <td width="33%" style="text-align:center;padding:10px;">
                <div style="font-size:24px;">🤖</div>
                <p style="margin:5px 0 0;color:#6b7280;font-size:11px;font-weight:600;">AI-Powered</p>
              </td>
              <td width="33%" style="text-align:center;padding:10px;">
                <div style="font-size:24px;">📊</div>
                <p style="margin:5px 0 0;color:#6b7280;font-size:11px;font-weight:600;">Analytics</p>
              </td>
              <td width="33%" style="text-align:center;padding:10px;">
                <div style="font-size:24px;">🧾</div>
                <p style="margin:5px 0 0;color:#6b7280;font-size:11px;font-weight:600;">Receipt Scan</p>
              </td>
            </tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 30px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Split expenses, not friendships. • <a href="${landingUrl}" style="color:#059669;">splitflow-1.vercel.app</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const subject = encodeURIComponent(`You've been added to an expense on SplitFlow - ${desc}`);
    const bodyParam = encodeURIComponent(htmlBody);
    window.open(`mailto:${toEmails}?subject=${subject}&body=${bodyParam}`, '_self');
  };

  // Submit expense
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const body: any = {
        description: description.trim(),
        amount: parseFloat(amount),
        category,
        date,
        paidById,
        splitType,
        note: note.trim(),
      };

      if (mode === 'group') {
        body.groupId = groupId;
        if (splitType === 'share') {
          // Send share values — backend handles proportional calculation
          body.splitType = 'equal';
          body.splits = splits.map((s) => ({
            userId: s.userId,
            share: s.share || 1,
          }));
        } else if (splitType === 'exact') {
          body.splits = splits.map((s) => ({
            userId: s.userId,
            amount: parseFloat(s.value) || 0,
          }));
        } else if (splitType === 'percentage') {
          body.splits = splits.map((s) => ({
            userId: s.userId,
            percentage: parseFloat(s.value) || 0,
          }));
        }
      } else {
        // Direct expense
        if (splitType === 'equal') {
          body.splits = selectedFriends.map((id) => ({ userId: id, share: 1 }));
          body.nonUserSplits = emailParticipants.map((p) => ({ email: p.email, name: p.name, share: 1 }));
        } else if (splitType === 'share') {
          body.splitType = 'equal';
          // Include owner's share in direct mode
          const ownerSplit = user?.id ? [{ userId: user.id, share: ownerShare }] : [];
          body.splits = [...ownerSplit, ...splits.map((s) => ({
            userId: s.userId,
            share: s.share || 1,
          }))];
          body.nonUserSplits = emailParticipants.map((p) => ({ email: p.email, name: p.name, share: 1 }));
        } else if (splitType === 'exact') {
          // Include user's own split
          const userAmt = parseFloat(userSplitValue) || 0;
          const bodySplits: any[] = [];
          if (userAmt > 0) {
            bodySplits.push({ userId: user?.id, amount: userAmt });
          }
          bodySplits.push(...splits.map((s) => ({
            userId: s.userId,
            amount: parseFloat(s.value) || 0,
          })));
          body.splits = bodySplits;
          // Include email participant amounts
          if (emailParticipants.length > 0) {
            body.nonUserSplits = emailParticipants.map((p) => ({
              email: p.email,
              name: p.name,
              amount: parseFloat(emailSplitAmounts[p.email]) || 0,
            }));
          }
        } else if (splitType === 'percentage') {
          // Include user's own split
          const userPct = parseFloat(userSplitValue) || 0;
          const bodySplits: any[] = [];
          if (userPct > 0) {
            bodySplits.push({ userId: user?.id, percentage: userPct });
          }
          bodySplits.push(...splits.map((s) => ({
            userId: s.userId,
            percentage: parseFloat(s.value) || 0,
          })));
          body.splits = bodySplits;
          // Include email participant percentages
          if (emailParticipants.length > 0) {
            body.nonUserSplits = emailParticipants.map((p) => ({
              email: p.email,
              name: p.name,
              percentage: parseFloat(emailSplitAmounts[p.email]) || 0,
            }));
          }
        }
      }

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        // If there are non-registered email participants, open email client
        if (emailParticipants.length > 0) {
          openEmailForNonRegistered(emailParticipants, description, amount);
        }
        toast.success('Expense added!');
        if (mode === 'group' && groupId) {
          navigateToGroup(groupId);
        } else {
          setView('history');
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add expense. Please try again.');
      }
    } catch {
      toast.error('Network error. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const perPerson = amount && !isNaN(parseFloat(amount)) && members.length > 0
    ? (parseFloat(amount) / members.length).toFixed(2)
    : '0.00';

  // Computed total for direct exact/percentage split check
  const totalSplitAmount = (() => {
    const uv = parseFloat(userSplitValue) || 0;
    const friendsTotal = splits.reduce((s, sp) => s + (parseFloat(sp.value) || 0), 0);
    const emailTotal = Object.values(emailSplitAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    return uv + friendsTotal + emailTotal;
  })();
  const totalSplitOk = Math.abs(totalSplitAmount - (parseFloat(amount) || 0)) < 0.5;

  // User's own share count (for direct share mode)
  const [ownerShare, setOwnerShare] = useState(1);

  // Track previous split type for auto-fill when switching
  const prevSplitTypeRef = useRef<'equal' | 'share' | 'exact' | 'percentage'>('equal');

  // Auto-fill exact/percentage values when switching FROM share mode
  useEffect(() => {
    const prev = prevSplitTypeRef.current;
    prevSplitTypeRef.current = splitType;

    // Only auto-fill when switching FROM share TO exact or percentage
    if (prev === 'share' && (splitType === 'exact' || splitType === 'percentage')) {
      const numAmount = parseFloat(amount) || 0;
      if (numAmount <= 0) return;

      if (mode === 'direct') {
        // Calculate total shares in direct mode
        const totalShares =
          ownerShare +
          splits.reduce((sum, s) => sum + (s.share || 1), 0) +
          emailParticipants.length;
        if (totalShares <= 0) return;

        if (splitType === 'exact') {
          // Owner's exact amount
          const ownerAmt = Math.round((numAmount * ownerShare) / totalShares * 100) / 100;
          setUserSplitValue(String(ownerAmt));
          // Friends' exact amounts
          setSplits((prev) =>
            prev.map((s) => {
              const amt = Math.round((numAmount * (s.share || 1)) / totalShares * 100) / 100;
              return { ...s, value: String(amt) };
            })
          );
          // Email participants' exact amounts
          const emailAmt = Math.round((numAmount * 1) / totalShares * 100) / 100;
          setEmailSplitAmounts((prev) => {
            const next: Record<string, string> = {};
            emailParticipants.forEach((ep) => { next[ep.email] = String(emailAmt); });
            return next;
          });
        } else {
          // Percentage mode
          const ownerPct = Math.round((ownerShare / totalShares) * 1000) / 10;
          setUserSplitValue(String(ownerPct));
          setSplits((prev) =>
            prev.map((s) => {
              const pct = Math.round(((s.share || 1) / totalShares) * 1000) / 10;
              return { ...s, value: String(pct) };
            })
          );
          const emailPct = Math.round((1 / totalShares) * 1000) / 10;
          setEmailSplitAmounts((prev) => {
            const next: Record<string, string> = {};
            emailParticipants.forEach((ep) => { next[ep.email] = String(emailPct); });
            return next;
          });
        }
      } else if (mode === 'group' && members.length > 0) {
        // Group mode: calculate from share values
        const totalShares = members.reduce((sum, m) => {
          const s = splits.find((sp) => sp.userId === m.id);
          return sum + (s?.share || 1);
        }, 0);
        if (totalShares <= 0) return;

        if (splitType === 'exact') {
          setSplits((prev) =>
            prev.map((s) => {
              const amt = Math.round((numAmount * (s.share || 1)) / totalShares * 100) / 100;
              return { ...s, value: String(amt) };
            })
          );
        } else {
          setSplits((prev) =>
            prev.map((s) => {
              const pct = Math.round(((s.share || 1) / totalShares) * 1000) / 10;
              return { ...s, value: String(pct) };
            })
          );
        }
      }
    }
  }, [splitType, mode]);

  // Split participants for direct exact/percentage mode
  const directParticipants = [
    ...(friends.filter((f) => selectedFriends.includes(f.id)).map((f) => ({ id: f.id, name: f.name }))),
  ];
  // All participants including owner (for direct share mode display)
  const allDirectParticipants = [
    ...(user?.id ? [{ id: user.id, name: user?.name || 'You' }] : []),
    ...directParticipants,
  ];

  useEffect(() => {
    if (mode === 'direct' && (splitType === 'exact' || splitType === 'percentage' || splitType === 'share')) {
      const newSplits = directParticipants.map((p) => {
        const pendingById = pendingFriendSplitValues[p.id];
        const friend = friends.find((f) => f.id === p.id);
        const friendName = friend?.name?.toLowerCase();
        const pendingByName = friendName ? pendingFriendSplitValues[friendName] : undefined;
        const pendingValue = pendingById || pendingByName || '';
        // For share type, the pending value is the share count
        const pendingShare = splitType === 'share' ? (parseInt(pendingValue) || 1) : 1;
        return { userId: p.id, value: pendingValue, share: pendingShare };
      });
      setSplits(newSplits);
    }
  }, [mode, splitType, selectedFriends.length, pendingFriendSplitValues]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Add Expense</h2>
        <p className="text-sm text-muted-foreground mt-1">Record a new expense and split it.</p>
      </div>

      {/* AI Natural Language Input */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">Quick Add with AI</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-xs">
                  Describe your expense in plain English. AI will extract the amount, category, and split details.
                  <br /><br />
                  Examples: &quot;Paid ₹450 for pizza split equally with Alex and Sam&quot;
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder='e.g. "Paid ₹450 for pizza split 3 ways"'
                value={nlpInput}
                onChange={(e) => setNlpInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNlpSubmit()}
                className="h-11 bg-background"
                disabled={nlpLoading}
              />
            </div>
            <Button
              onClick={handleNlpSubmit}
              disabled={nlpLoading || !nlpInput.trim()}
              className="bg-primary hover:bg-primary/90 text-white h-11 px-4 shrink-0"
            >
              {nlpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Form */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Expense Mode Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Expense Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('direct')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                    mode === 'direct'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-muted-foreground/40'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Direct Split</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('group')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                    mode === 'group'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-muted-foreground/40'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Group Expense</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {mode === 'direct'
                  ? 'Split with friends or by email — no group needed'
                  : 'Split within an existing group'}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-sm">
                What was it for? <span className="text-red-400">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    id="desc"
                    placeholder="e.g., Dinner at Italian restaurant"
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); setDescError(''); }}
                    className={`h-11 ${descError ? 'border-red-300' : ''}`}
                    autoFocus
                  />
                  {descError && <p className="text-xs text-red-500 mt-1">{descError}</p>}
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0 h-11 w-11"
                        onClick={handleCategorize}
                        disabled={categorizeLoading || !description.trim()}
                      >
                        {categorizeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Auto-categorize using AI</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="amount" className="text-sm">
                  Amount <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">₹</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setAmountError(''); }}
                    className={`h-11 pl-7 ${amountError ? 'border-red-300' : ''}`}
                  />
                </div>
                {amountError && <p className="text-xs text-red-500 mt-1">{amountError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date" className="text-sm">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-sm">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group selector (only in group mode) */}
            {mode === 'group' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Group <span className="text-red-400">*</span></Label>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={groups.length === 0 ? 'Create a group first' : 'Select group'} />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.emoji} {g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {groups.length === 0 && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-primary" onClick={() => setView('groups')}>
                      Create a group first
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Paid by</Label>
                  <Select value={paidById} onValueChange={setPaidById}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={membersLoading ? 'Loading...' : 'Who paid?'} />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Direct mode: Select friends & add by email */}
            {mode === 'direct' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Split with Friends</Label>
                  {friends.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No friends yet. Add by email below or send a friend request from the Friends page.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {friends.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleFriend(f.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                            selectedFriends.includes(f.id)
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                              : 'bg-background border-border text-muted-foreground hover:border-muted-foreground/40'
                          }`}
                        >
                          {f.name || f.email}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Email participants */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    Add by Email
                    <span className="text-xs text-muted-foreground font-normal">(for non-users too)</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="friend@email.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="h-9 flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmailParticipant())}
                    />
                    <Input
                      placeholder="Name (optional)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="h-9 w-32"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmailParticipant())}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0"
                      onClick={addEmailParticipant}
                      disabled={!newEmail.trim()}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {emailParticipants.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {emailParticipants.map((p) => (
                        <Badge key={p.email} variant="secondary" className="gap-1.5 py-1 px-2.5">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          {p.name}
                          <span className="text-muted-foreground">({p.email})</span>
                          <button
                            type="button"
                            onClick={() => removeEmail(p.email)}
                            className="ml-1 text-muted-foreground hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {emailParticipants.length > 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                      Email participants who are not on SplitFlow will see the expense once they sign up with that email.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Split Type */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Split Type</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs max-w-xs">
                      <strong>Equal:</strong> Split evenly among all participants<br/>
                      <strong>By Share:</strong> Split by family/group size (e.g., 4 members vs 3 members = 4:3 ratio)<br/>
                      <strong>Exact:</strong> Enter specific amounts per person<br/>
                      <strong>Percentage:</strong> Enter percentage each person pays
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex gap-2">
                {(['equal', 'share', 'exact', 'percentage'] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={splitType === type ? 'default' : 'outline'}
                    className={
                      splitType === type
                        ? 'bg-primary hover:bg-primary/90 text-white'
                        : ''
                    }
                    onClick={() => setSplitType(type)}
                    size="sm"
                  >
                    {type === 'equal' ? 'Equal' : type === 'share' ? 'By Share 👨‍👩‍👧‍👦' : type === 'exact' ? 'Exact ₹' : 'Percentage %'}
                  </Button>
                ))}
              </div>
            </div>

            {/* Share split details — family/group size (both modes) */}
            {splitType === 'share' && (
              <div className="space-y-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Family / Group Size 👨‍👩‍👧‍👦
                  </Label>
                  {(() => {
                    const shareParticipants = mode === 'group'
                      ? members.map((m) => ({ id: m.id, name: m.name }))
                      : allDirectParticipants;
                    const totalShares = shareParticipants.reduce((sum, p) => {
                      if (p.id === user?.id && mode === 'direct') return sum + ownerShare;
                      const s = splits.find((sp) => sp.userId === p.id);
                      return sum + (s?.share || 1);
                    }, 0) + (mode === 'direct' ? emailParticipants.length : 0);
                    const ratioArr = shareParticipants.map((p) => {
                      if (p.id === user?.id && mode === 'direct') return ownerShare;
                      const s = splits.find((sp) => sp.userId === p.id);
                      return s?.share || 1;
                    });
                    if (mode === 'direct') {
                      emailParticipants.forEach(() => ratioArr.push(1));
                    }
                    const ratioStr = ratioArr.join(' : ');
                    return (
                      <span className="text-xs text-foreground font-medium bg-emerald-100 px-2 py-1 rounded-full">
                        Ratio: {ratioStr} = {totalShares} total shares
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Set how many people each participant represents. The expense will be split proportionally.
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {/* In direct mode, show owner first */}
                  {mode === 'direct' && user?.id && (() => {
                    const shareParticipants = allDirectParticipants;
                    const emailShareTotal = emailParticipants.length;
                    const totalShares = shareParticipants.reduce((sum, p) => {
                      if (p.id === user!.id) return sum + ownerShare;
                      const s = splits.find((sp) => sp.userId === p.id);
                      return sum + (s?.share || 1);
                    }, 0) + emailShareTotal;
                    const numAmount = parseFloat(amount) || 0;
                    const shareAmount = totalShares > 0
                      ? Math.round((numAmount * ownerShare) / totalShares * 100) / 100
                      : 0;
                    const sharePct = totalShares > 0
                      ? Math.round((ownerShare / totalShares) * 1000) / 10
                      : 0;
                    return (
                      <div key={user!.id} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 w-28 truncate shrink-0">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                            <User className="w-3 h-3 text-foreground" />
                          </div>
                          <span className="text-sm font-medium text-gray-700">You</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setOwnerShare(Math.max(1, ownerShare - 1))}
                            className="w-7 h-7 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30"
                            disabled={ownerShare <= 1}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={ownerShare}
                            onChange={(e) => setOwnerShare(parseInt(e.target.value) || 1)}
                            className="w-10 h-7 text-center text-sm font-medium border border-border rounded-md bg-background"
                          />
                          <button
                            type="button"
                            onClick={() => setOwnerShare(ownerShare + 1)}
                            className="w-7 h-7 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{ownerShare === 1 ? 'person' : 'people'}</span>
                        <div className="flex-1" />
                        <span className="text-sm font-semibold text-foreground shrink-0">₹{shareAmount.toFixed(2)}</span>
                        <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">{sharePct}%</span>
                      </div>
                    );
                  })()}
                  {(mode === 'group' ? members : directParticipants).map((p) => {
                    const split = splits.find((s) => s.userId === p.id);
                    const shareCount = split?.share || 1;
                    const shareParticipants = mode === 'group'
                      ? members
                      : allDirectParticipants;
                    const emailShareTotal = mode === 'direct' ? emailParticipants.length : 0;
                    const totalShares = shareParticipants.reduce((sum, pp) => {
                      if (pp.id === user?.id && mode === 'direct') return sum + ownerShare;
                      const s = splits.find((sp) => sp.userId === pp.id);
                      return sum + (s?.share || 1);
                    }, 0) + emailShareTotal;
                    const numAmount = parseFloat(amount) || 0;
                    const shareAmount = totalShares > 0
                      ? Math.round((numAmount * shareCount) / totalShares * 100) / 100
                      : 0;
                    const sharePct = totalShares > 0
                      ? Math.round((shareCount / totalShares) * 1000) / 10
                      : 0;
                    return (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-28 truncate shrink-0">{p.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateSplitShare(p.id, shareCount - 1)}
                            className="w-7 h-7 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30"
                            disabled={shareCount <= 1}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={shareCount}
                            onChange={(e) => updateSplitShare(p.id, parseInt(e.target.value) || 1)}
                            className="w-10 h-7 text-center text-sm font-medium border border-border rounded-md bg-background"
                          />
                          <button
                            type="button"
                            onClick={() => updateSplitShare(p.id, shareCount + 1)}
                            className="w-7 h-7 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{shareCount === 1 ? 'person' : 'people'}</span>
                        <div className="flex-1" />
                        <span className="text-sm font-semibold text-foreground shrink-0">₹{shareAmount.toFixed(2)}</span>
                        <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">{sharePct}%</span>
                      </div>
                    );
                  })}
                </div>
                {emailParticipants.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-emerald-200">
                    {emailParticipants.map((ep) => {
                      const shareParticipants = mode === 'group' ? members : allDirectParticipants;
                      const totalShares = shareParticipants.reduce((sum, p) => {
                        if (p.id === user?.id && mode === 'direct') return sum + ownerShare;
                        const s = splits.find((sp) => sp.userId === p.id);
                        return sum + (s?.share || 1);
                      }, 0) + emailParticipants.length;
                      const numAmount = parseFloat(amount) || 0;
                      const shareAmount = totalShares > 0
                        ? Math.round((numAmount * 1) / totalShares * 100) / 100
                        : 0;
                      const sharePct = totalShares > 0
                        ? Math.round((1 / totalShares) * 1000) / 10
                        : 0;
                      return (
                        <div key={ep.email} className="flex items-center gap-3 text-amber-700">
                          <div className="flex items-center gap-1.5 w-28 truncate shrink-0">
                            <Mail className="w-3.5 h-3.5" />
                            <span className="text-sm truncate">{ep.name}</span>
                          </div>
                          <span className="text-xs bg-amber-100 px-2 py-0.5 rounded-full">1 share</span>
                          <div className="flex-1" />
                          <span className="text-sm font-semibold text-amber-700 shrink-0">₹{shareAmount.toFixed(2)}</span>
                          <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">{sharePct}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Split Details for Group mode (exact/percentage) */}
            {mode === 'group' && splitType !== 'equal' && splitType !== 'share' && members.length > 0 && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <Label className="text-sm font-medium">
                  Split Details {splitType === 'percentage' ? '(%)' : '(₹)'}
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {members.map((m) => {
                    const split = splits.find((s) => s.userId === m.id);
                    return (
                      <div key={m.id} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-32 truncate shrink-0">{m.name}</span>
                        <Input
                          type="number"
                          step={splitType === 'percentage' ? '1' : '0.01'}
                          min="0"
                          placeholder="0"
                          value={split?.value || ''}
                          onChange={(e) => updateSplit(m.id, e.target.value)}
                          className="h-9"
                        />
                        <span className="text-xs text-muted-foreground w-4">{splitType === 'percentage' ? '%' : '₹'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Split Details for Direct mode (exact/percentage) */}
            {mode === 'direct' && (splitType === 'exact' || splitType === 'percentage') && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <Label className="text-sm font-medium">
                  Split Details {splitType === 'percentage' ? '(%)' : '(₹)'}
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {/* User (You) row — always shown */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-32 shrink-0">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                        <User className="w-3 h-3 text-foreground" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">You</span>
                    </div>
                    <Input
                      type="number"
                      step={splitType === 'percentage' ? '1' : '0.01'}
                      min="0"
                      placeholder="0"
                      value={userSplitValue}
                      onChange={(e) => setUserSplitValue(e.target.value)}
                      className="h-9"
                    />
                    <span className="text-xs text-muted-foreground w-4">{splitType === 'percentage' ? '%' : '₹'}</span>
                  </div>
                  {/* Selected friends */}
                  {directParticipants.length === 0 && emailParticipants.length === 0 && (
                    <p className="text-xs text-muted-foreground pl-9">Add friends or emails above to split with others.</p>
                  )}
                  {directParticipants.map((p) => {
                    const split = splits.find((s) => s.userId === p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-32 truncate shrink-0">{p.name}</span>
                        <Input
                          type="number"
                          step={splitType === 'percentage' ? '1' : '0.01'}
                          min="0"
                          placeholder="0"
                          value={split?.value || ''}
                          onChange={(e) => updateSplit(p.id, e.target.value)}
                          className="h-9"
                        />
                        <span className="text-xs text-muted-foreground w-4">{splitType === 'percentage' ? '%' : '₹'}</span>
                      </div>
                    );
                  })}
                  {/* Email participants */}
                  {emailParticipants.map((ep) => (
                    <div key={ep.email} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-32 shrink-0">
                        <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-sm text-gray-700 truncate">{ep.name}</span>
                      </div>
                      <Input
                        type="number"
                        step={splitType === 'percentage' ? '1' : '0.01'}
                        min="0"
                        placeholder="0"
                        value={emailSplitAmounts[ep.email] || ''}
                        onChange={(e) => setEmailSplitAmounts((prev) => ({ ...prev, [ep.email]: e.target.value }))}
                        className="h-9"
                      />
                      <span className="text-xs text-muted-foreground w-4">{splitType === 'percentage' ? '%' : '₹'}</span>
                    </div>
                  ))}
                </div>
                {/* Total check — always show when there's a value */}
                {(userSplitValue || directParticipants.length > 0 || emailParticipants.length > 0) && (
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className={`text-sm font-semibold ${totalSplitOk ? 'text-primary' : 'text-red-500'}`}>
                      {splitType === 'percentage'
                        ? `${totalSplitAmount.toFixed(1)}% / 100%`
                        : `₹${totalSplitAmount.toFixed(2)} / ₹${parseFloat(amount || '0').toFixed(2)}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Equal split summary */}
            {splitType === 'equal' && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                {mode === 'group' && members.length > 0 ? (
                  <p className="text-sm text-foreground">
                    Split equally among <strong>{members.length}</strong> member{members.length !== 1 ? 's' : ''}: <strong>₹{perPerson}</strong> each
                  </p>
                ) : mode === 'direct' && totalDirectParticipants > 1 ? (
                  <p className="text-sm text-foreground">
                    Split equally among <strong>{totalDirectParticipants}</strong> people: <strong>₹{perPersonDirect}</strong> each
                    {emailParticipants.length > 0 && (
                      <span className="block text-xs text-amber-600 mt-1">
                        Including {emailParticipants.length} email participant{emailParticipants.length > 1 ? 's' : ''} who will see this after signing up
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-foreground">
                    Add friends or email participants to split with
                  </p>
                )}
              </div>
            )}

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="note" className="text-sm">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="note"
                placeholder="Any additional details..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Receipt Upload */}
            <div className="space-y-1.5">
              <Label className="text-sm">Receipt <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleReceiptUpload}
                    disabled={receiptLoading}
                  />
                  <div className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/10/50 transition-colors">
                    {receiptLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <Camera className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground">Upload receipt photo</span>
                  </div>
                </label>
                {receiptPreview && (
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border">
                    <img src={receiptPreview} alt="Receipt" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-medium shadow-sm"
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding Expense...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Expense
                </div>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
