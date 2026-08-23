'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Github, Chrome, Sparkles, Wallet, Users, Shield, Bot, Camera, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export function AuthPage() {
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleOAuthLogin = (provider: 'github' | 'google') => {
    setOauthLoading(provider);
    try {
      import('next-auth/react').then(({ signIn }) => {
        signIn(provider, { callbackUrl: '/' });
      }).catch(() => {
        setOauthLoading(null);
      });
    } catch {
      setOauthLoading(null);
    }
    // Reset loading after 10s as fallback (in case redirect doesn't happen)
    setTimeout(() => setOauthLoading(null), 10000);
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
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
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Split<span className="text-emerald-600 dark:text-emerald-400">Flow</span>
                </h1>
              </div>
              <p className="text-xl text-gray-700 dark:text-gray-200 font-medium">
                Split expenses, not friendships.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto lg:mx-0 leading-relaxed">
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
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <f.icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{f.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Right side - OAuth login card */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="shadow-xl border border-gray-100 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl dark:text-white">Get Started Free</CardTitle>
                <CardDescription className="dark:text-gray-400">Sign in with your GitHub or Google account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* GitHub OAuth */}
                <Button 
                  variant="outline" 
                  className="w-full h-11 text-sm gap-3" 
                  onClick={() => handleOAuthLogin('github')}
                  disabled={oauthLoading !== null}
                >
                  {oauthLoading === 'github' ? (
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  ) : (
                    <Github className="w-5 h-5" />
                  )}
                  Continue with GitHub
                </Button>

                {/* Google OAuth */}
                <Button 
                  variant="outline" 
                  className="w-full h-11 text-sm gap-3" 
                  onClick={() => handleOAuthLogin('google')}
                  disabled={oauthLoading !== null}
                >
                  {oauthLoading === 'google' ? (
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  ) : (
                    <Chrome className="w-5 h-5" />
                  )}
                  Continue with Google
                </Button>

                <p className="text-[11px] text-gray-400 text-center leading-relaxed pt-2">
                  By continuing, you agree to our Terms of Service and Privacy Policy.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      <footer className="text-center py-4 text-xs text-gray-400 dark:text-gray-600">
        Free forever. No ads. No premium. Built with care
      </footer>
    </div>
  );
}
