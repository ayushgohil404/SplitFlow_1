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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/app-store';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Group {
  id: string;
  name: string;
  emoji: string;
}

const QUICK_ACTIONS = [
  { label: 'Analyze my spending', icon: TrendingUp, prompt: 'Analyze my spending patterns and give me insights on where my money is going.' },
  { label: 'Suggest savings', icon: PiggyBank, prompt: 'Suggest ways I can save money based on my recent expenses.' },
  { label: 'Who owes me the most?', icon: Users, prompt: 'Tell me who owes me the most money across all groups.' },
  { label: 'Summarize this month', icon: CalendarDays, prompt: 'Give me a summary of all my expenses this month.' },
];

export function AIAssistantView() {
  const { user } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('/api/groups');
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.groups || [];
          setGroups(list);
          if (list.length > 0) {
            setSelectedGroupId(list[0].id);
          }
        }
      } catch {
        // silent
      }
    }
    fetchGroups();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroupId !== 'all' ? selectedGroupId : undefined,
          query: text.trim(),
        }),
      });

      let aiContent = 'Sorry, I could not process your request.';
      if (res.ok) {
        const data = await res.json();
        aiContent = data.insights || data.text || data.message || 'No response.';
      }

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: aiContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
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
  }, [loading, selectedGroupId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Group selector + header */
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <Bot className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">AI Assistant</h3>
            <p className="text-xs text-gray-500">Ask about your expenses</p>
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

      {/* Messages */}
      <Card className="flex-1 flex flex-col min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Hi, {user?.name || 'there'}! 👋
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm">
                I can help you analyze spending, find who owes you, and suggest savings. Try a quick action or ask anything!
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {QUICK_ACTIONS.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => sendMessage(qa.prompt)}
                    className="flex items-center gap-2 px-3 py-2.5 text-left rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors text-sm"
                  >
                    <qa.icon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-gray-700">{qa.label}</span>
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
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }
                >
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div
                className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-800'
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
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarFallback className="bg-emerald-100 text-emerald-700">
                  <Bot className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-gray-100 rounded-xl px-4 py-3">
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
              placeholder="Ask about your expenses..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 h-10"
            />
            <Button
              type="submit"
              disabled={!input.trim() || loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-4"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </Card>
    </motion.div>
  );
}
