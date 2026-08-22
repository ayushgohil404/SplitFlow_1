'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Github, Chrome, Sparkles, ArrowRight, Wallet, Users, Shield, Bot, Camera, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export function AuthPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleDemoLogin = async () => {
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setDemoLoading(true);
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || email.split('@')[0] }),
      });
      if (res.ok) {
        toast.success('Welcome to SplitFlow!');
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Login failed. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleOAuthLogin = (provider: 'github' | 'google') => {
    // Use NextAuth signIn - but handle gracefully if OAuth isn't configured
    try {
      import('next-auth/react').then(({ signIn }) => {
        signIn(provider, { callbackUrl: '/' });
      });
    } catch {
      toast.info('OAuth is optional. Use the demo login below to get started instantly!');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !demoLoading) handleDemoLogin();
  };

  const features = [
    { icon: Wallet, title: 'Smart Splitting', desc: 'Equal, exact, or percentage splits with AI-powered debt simplification' },
    { icon: Bot, title: 'AI-Powered', desc: 'Natural language expense entry, smart categorization, and spending insights' },
    { icon: Camera, title: 'Receipt Scanning', desc: 'Upload receipt photos and let AI extract amount, date, and items' },
    { icon: Zap, title: 'Instant Settlement', desc: 'One-click debt simplification to minimize total transactions' },
    { icon: Users, title: 'Group Expenses', desc: 'Manage shared costs for trips, apartments, dinners, and more' },
    { icon: Shield, title: 'Free Forever', desc: 'No ads, no premium tiers, no hidden costs. Completely free' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 lg:gap-16 items-center"
        >
          {/* Left side - branding & features */}
          <div className="text-center lg:text-left space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-center lg:justify-start gap-2.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
                  Split<span className="text-emerald-600">Flow</span>
                </h1>
              </div>
              <p className="text-xl text-gray-700 font-medium">
                Split expenses, not friendships.
              </p>
              <p className="text-sm text-gray-500 max-w-md mx-auto lg:mx-0 leading-relaxed">
                The AI-powered expense splitting app that makes managing shared costs effortless. 
                Smarter than Splitwise, and completely free.
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-3"
            >
              {features.map((f, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <f.icon className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{f.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Right side - login card */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl">Get Started Free</CardTitle>
                <CardDescription>No account needed. Just enter your email to try SplitFlow.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* OAuth buttons */}
                <Button 
                  variant="outline" 
                  className="w-full h-11 text-sm gap-3" 
                  onClick={() => handleOAuthLogin('github')}
                >
                  <Github className="w-5 h-5" />
                  Continue with GitHub
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full h-11 text-sm gap-3" 
                  onClick={() => handleOAuthLogin('google')}
                >
                  <Chrome className="w-5 h-5" />
                  Continue with Google
                </Button>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-gray-400">or try instantly</span>
                  </div>
                </div>

                {/* Demo login form */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-name" className="text-sm">Name <span className="text-gray-400 font-normal">(optional)</span></Label>
                    <Input 
                      id="demo-name"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="h-11"
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="demo-email" className="text-sm">Email <span className="text-red-400">*</span></Label>
                    <Input 
                      id="demo-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      onKeyDown={handleKeyDown}
                      className={`h-11 ${error ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                      autoComplete="email"
                    />
                    {error && (
                      <p className="text-xs text-red-500 mt-1">{error}</p>
                    )}
                  </div>
                  <Button 
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-sm font-medium gap-2 shadow-sm" 
                    onClick={handleDemoLogin}
                    disabled={!email.trim() || demoLoading}
                  >
                    {demoLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Start Splitting
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                    By signing in, you agree to our terms. Your data stays on your server.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      <footer className="text-center py-4 text-xs text-gray-400">
        Free forever. No ads. No premium. Built with care
      </footer>
    </div>
  );
}
