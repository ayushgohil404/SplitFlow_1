'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Loader2, Sparkles } from 'lucide-react';
import { useAppStore } from '@/store/app-store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function FloatingAIBubble() {
  const { setView } = useAppStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const fab = document.getElementById('ai-bubble-fab');
        if (fab && !fab.contains(e.target as Node)) {
          setOpen(false);
        }
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setIsTyping(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, messages }),
      });
      const data = await res.json();
      setIsTyping(false);
      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.error || 'Sorry, I could not process that.' }]);
      }
    } catch {
      setIsTyping(false);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Network error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={[
              'fixed z-[60] w-[360px] max-w-[calc(100vw-2rem)]',
              'bg-card border border-border rounded-2xl shadow-2xl',
              'overflow-hidden flex flex-col',
              'bottom-20 left-4',
              'lg:bottom-20 lg:right-56 lg:left-auto',
            ].join(' ')}
            style={{ height: 'min(480px, calc(100vh - 7rem))' }}
          >
            <div className="flex items-center gap-2.5 h-12 px-4 bg-primary text-primary-foreground shrink-0">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-sm font-semibold">SplitFlow AI</span>
              <button
                onClick={() => { setOpen(false); setView('ai-assistant'); }}
                className="text-xs font-medium bg-primary-foreground/15 hover:bg-primary-foreground/25 rounded-md px-2.5 py-1 transition-colors"
              >
                Full View
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-md bg-primary-foreground/15 hover:bg-primary-foreground/25 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Hey! I&apos;m SplitFlow AI</p>
                  <p className="text-xs text-muted-foreground mt-1">Ask about expenses, tips, or anything</p>
                  <div className="mt-4 space-y-2">
                    {['How to split rent fairly?', 'Show me spending tips', 'Categorize my expenses'].map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="block w-full text-left text-xs px-3.5 py-2.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-3 pb-3 pt-2 shrink-0">
              <div className="flex items-center gap-2 bg-background border border-input rounded-xl px-1.5 py-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask AI anything..."
                  className="flex-1 h-8 px-2 text-sm bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        id="ai-bubble-fab"
        onClick={() => setOpen(!open)}
        className={[
          'fixed z-50 bottom-5 left-5 h-12 w-12',
          'lg:bottom-6 lg:right-56 lg:h-12 lg:w-12',
          'rounded-full bg-primary hover:bg-primary/90 text-primary-foreground',
          'shadow-lg hover:shadow-xl hover:scale-105',
          'flex items-center justify-center transition-all duration-200 active:scale-95',
        ].join(' ')}
        aria-label="AI Assistant"
      >
        {open ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </button>
    </>
  );
}
