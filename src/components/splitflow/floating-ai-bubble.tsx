'use client';

import { useState, useRef, useEffect } from 'react';
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
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
      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-20 left-5 z-[60] w-[340px] max-w-[calc(100vw-2.5rem)]
              bg-card border border-border rounded-xl shadow-2xl
              overflow-hidden flex flex-col"
            style={{ height: 'min(460px, calc(100vh - 8rem))' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 h-12 px-4 bg-primary text-primary-foreground shrink-0">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-sm font-semibold">SplitFlow AI</span>
              <button
                onClick={() => { setOpen(false); setView('ai-assistant'); }}
                className="text-xs font-medium bg-primary-foreground/15 hover:bg-primary-foreground/25 rounded-md px-2 py-1 transition-colors"
              >
                Full View
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-md bg-primary-foreground/15 hover:bg-primary-foreground/25 flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Hey! I'm SplitFlow AI</p>
                  <p className="text-xs text-muted-foreground mt-1">Ask about expenses, tips, or anything</p>
                  <div className="mt-4 space-y-1.5">
                    {['How to split rent fairly?', 'Show me spending tips', 'Categorize my expenses'].map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="block w-full text-left text-xs px-3 py-2 rounded-lg
                          bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
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
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="h-14 px-3 border-t border-border flex items-center gap-2 shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask AI anything..."
                className="flex-1 h-9 px-3 rounded-lg text-sm bg-background border border-input
                  focus:outline-none focus:ring-2 focus:ring-ring
                  text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="h-9 w-9 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground
                  flex items-center justify-center transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 left-5 z-50 h-12 w-12 rounded-full
          bg-primary hover:bg-primary/90 text-primary-foreground
          shadow-lg hover:shadow-xl
          flex items-center justify-center
          transition-all duration-200 active:scale-95"
        aria-label="AI Assistant"
      >
        {open ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </button>
    </>
  );
}
