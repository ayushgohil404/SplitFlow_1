'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  TrendingUp,
  PiggyBank,
  Users,
  CalendarDays,
  User,
  CheckCircle2,
  X,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actionLabel?: string;
  pendingExpense?: {
    description: string;
    amount: number;
    category: string;
    splitType: string;
    groupId: string | null;
    splits?: any[];
    emailSplits?: any[];
  };
}

interface Group {
  id: string;
  name: string;
  emoji: string;
}

interface Friend {
  id: string;
  name: string;
  email: string;
}

const QUICK_ACTIONS = [
  { label: 'Analyze my spending', icon: TrendingUp, prompt: 'Analyze my spending patterns and give me insights on where my money is going.' },
  { label: 'Suggest savings', icon: PiggyBank, prompt: 'Suggest ways I can save money based on my recent expenses.' },
  { label: 'Who owes me?', icon: Users, prompt: 'Tell me who owes me the most money and my total to get back.' },
  { label: 'This month summary', icon: CalendarDays, prompt: 'Give me a summary of all my expenses this month.' },
];

export function AIAssistantView() {
  const { user, setView } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
          if (list.length > 0) {
            setSelectedGroupId(list[0].id);
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
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const confirmExpense = useCallback(async (msgId: string, expense: Message['pendingExpense']) => {
    if (!expense) return;
    try {
      let groupId: string | undefined;
      if (expense.groupId) {
        const matched = groups.find((g) => g.name.toLowerCase() === expense.groupId!.toLowerCase());
        groupId = matched?.id;
      }
      const body: any = {
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        splitType: expense.splitType === 'single' ? 'equal' : expense.splitType,
      };
      // For single/personal expenses, don't send splits — backend creates a self-only split
      if (expense.splitType !== 'single') {
      if (groupId) { body.groupId = groupId; }
      if (expense.splitType === 'exact' && expense.splits) {
        // Resolve friend names to userIds — include "me" so the backend creates the user's split too
        const allSplits = expense.splits
          .map((s: any) => {
            if (s.name === 'me') return { userId: user?.id, amount: s.amount || 0 };
            const friend = friends.find((f) => f.name?.toLowerCase() === s.name?.toLowerCase() || f.email?.split('@')[0].toLowerCase() === s.name?.toLowerCase());
            return friend ? { userId: friend.id, amount: s.amount || 0 } : null;
          })
          .filter((s: any) => s?.userId);
        if (allSplits.length > 0) body.splits = allSplits;
      } else if (expense.splitType === 'percentage' && expense.splits) {
        const allSplits = expense.splits
          .map((s: any) => {
            if (s.name === 'me') return { userId: user?.id, percentage: s.percentage || 0 };
            const friend = friends.find((f) => f.name?.toLowerCase() === s.name?.toLowerCase() || f.email?.split('@')[0].toLowerCase() === s.name?.toLowerCase());
            return friend ? { userId: friend.id, percentage: s.percentage || 0 } : null;
          })
          .filter((s: any) => s?.userId);
        if (allSplits.length > 0) body.splits = allSplits;
      } else if (expense.splitType === 'share' && expense.splits) {
        body.splitType = 'equal';
        const shareSplits = expense.splits
          .map((s: any) => {
            if (s.name === 'me') return { userId: user?.id, share: s.share || 1 };
            const friend = friends.find((f) => f.name?.toLowerCase() === s.name?.toLowerCase() || f.email?.split('@')[0].toLowerCase() === s.name?.toLowerCase());
            return friend ? { userId: friend.id, share: s.share || 1 } : null;
          })
          .filter(Boolean);
        if (shareSplits.length > 0) body.splits = shareSplits;
      } else if (expense.splitType === 'equal' && expense.splits) {
        const nonMeSplits = expense.splits
          .filter((s: any) => s.name !== 'me')
          .map((s: any) => {
            const friend = friends.find((f) => f.name?.toLowerCase() === s.name?.toLowerCase() || f.email?.split('@')[0].toLowerCase() === s.name?.toLowerCase());
            return friend ? { userId: friend.id, share: 1 } : null;
          })
          .filter(Boolean);
        if (nonMeSplits.length > 0) body.splits = nonMeSplits;
      }
      if (expense.emailSplits && expense.emailSplits.length > 0) {
        body.nonUserSplits = expense.emailSplits.map((es: any) => ({
          email: es.email,
          name: es.name || es.email.split('@')[0],
          amount: es.amount,
          percentage: es.percentage,
          share: es.share || 1,
        }));
      }
      } // end if (expense.splitType !== 'single')
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success('Expense added: ' + expense.description + ' - ₹' + expense.amount);
        setMessages((prev) => prev.map((m) =>
          m.id === msgId
            ? { ...m, pendingExpense: undefined, actionLabel: 'Added: ' + expense.description + ' - ₹' + expense.amount }
            : m
        ));
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to add expense.');
        setMessages((prev) => prev.map((m) =>
          m.id === msgId ? { ...m, pendingExpense: undefined } : m
        ));
      }
    } catch {
      toast.error('Network error. Could not add expense.');
      setMessages((prev) => prev.map((m) =>
        m.id === msgId ? { ...m, pendingExpense: undefined } : m
      ));
    }
  }, [groups, friends, user]);

  const dismissExpense = useCallback((msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, pendingExpense: undefined } : m)
    );
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build conversation history (exclude system messages, just user/assistant pairs)
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text.trim(),
          groupId: selectedGroupId !== 'all' ? selectedGroupId : undefined,
          history,
        }),
      });

      const data = await res.json().catch(() => ({ error: 'Failed to get response' }));
      if (data.error) {
        const errMsg = data.code === 'NOT_CONFIGURED'
          ? 'AI is not set up yet. Go to Vercel Dashboard > Settings > Environment Variables and add GEMINI_API_KEY (free from aistudio.google.com).'
          : (data.error || 'Something went wrong.');
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: errMsg,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else if (data.createExpense) {
        const ce = data.createExpense;
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.text || `I have prepared an expense: ₹${ce.amount} (${ce.splitType} split). Review and confirm to add it!`,
          timestamp: new Date(),
          pendingExpense: ce,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.text || 'No response.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, selectedGroupId, messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-[calc(100vh-10rem)]">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <Bot className="w-4 h-4 text-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Assistant</h3>
            <p className="text-xs text-muted-foreground">Ask anything or add expenses</p>
          </div>
        </div>
        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.emoji} {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Hi, {user?.name || 'there'}!
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                I can help you analyze spending, check who owes you, and log expenses. Try a quick action or ask anything!
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {QUICK_ACTIONS.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => sendMessage(qa.prompt)}
                    className="flex items-center gap-2 px-3 py-2.5 text-left rounded-lg border border-border hover:border-emerald-300 hover:bg-primary/10/50 transition-colors text-sm"
                  >
                    <qa.icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-foreground">{qa.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarFallback
                  className={
                    msg.role === 'user'
                      ? 'bg-muted text-foreground'
                      : 'bg-emerald-100 text-foreground'
                  }
                >
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="max-w-[75%]">
                <div
                  className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i} className={line.trim() === '' ? 'h-2' : ''}>
                      {line.startsWith('#') ? (
                        <span className="font-bold">{line.replace(/^#+\s*/, '')}</span>
                      ) : (
                        line
                      )}
                    </p>
                  ))}
                </div>
                {/* Pending expense approval card */}
                {msg.pendingExpense && (
                  <div className="mt-2 p-3 bg-background border-2 border-emerald-200 rounded-xl shadow-sm space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Confirm Expense</p>
                        <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                          <p><strong>{msg.pendingExpense.description}</strong> - ₹{msg.pendingExpense.amount}</p>
                          <p>Category: {msg.pendingExpense.category} | Split: {msg.pendingExpense.splitType}</p>
                          {msg.pendingExpense.groupId && (
                            <p>Group: {msg.pendingExpense.groupId}</p>
                          )}
                          {msg.pendingExpense.splits && msg.pendingExpense.splits.length > 0 && (
                            <p className="text-muted-foreground">
                              With: {msg.pendingExpense.splits.map((s: any) => s.name).join(', ')}
                            </p>
                          )}
                          {msg.pendingExpense.emailSplits && msg.pendingExpense.emailSplits.length > 0 && (
                            <p className="text-muted-foreground">
                              Email: {msg.pendingExpense.emailSplits.map((s: any) => s.email).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-8 bg-primary hover:bg-primary/90 text-white text-xs"
                        onClick={() => confirmExpense(msg.id, msg.pendingExpense)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirm & Add
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => dismissExpense(msg.id)}
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Dismiss
                      </Button>
                    </div>
                  </div>
                )}

                {/* Confirmed expense indicator */}
                {msg.actionLabel && !msg.pendingExpense && (
                  <div className="flex items-center gap-1.5 mt-1.5 ml-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs text-primary font-medium">{msg.actionLabel}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarFallback className="bg-emerald-100 text-foreground">
                  <Bot className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-xl px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Ask anything or say 'add 500 for food'..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 h-10"
            />
            <Button
              type="submit"
              disabled={!input.trim() || loading}
              className="bg-primary hover:bg-primary/90 text-white h-10 px-4"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </Card>
    </motion.div>
  );
}
