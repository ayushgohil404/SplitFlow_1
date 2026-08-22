'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Github, Chrome, Sparkles, ArrowRight, Wallet, Users, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

export function AuthPage() {
  const { signIn, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);

  const handleDemoLogin = async () => {
    if (!email) return;
    setDemoLoading(true);
    await signIn('credentials', { email, name: name || email.split('@')[0] });
    setTimeout(() => setDemoLoading(false), 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleDemoLogin();
  };

  const features = [
    { icon: Wallet, title: 'Smart Splitting', desc: 'Equal, exact, or percentage splits with AI-powered suggestions' },
    { icon: Users, title: 'Group Expenses', desc: 'Manage shared costs for trips, apartments, and more' },
    { icon: Shield, title: 'Free Forever', desc: 'No ads, no premium tiers, completely open source' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 lg:gap-16 items-center"
        >
          {/* Left: Branding */}
          <div className="text-center lg:text-left space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-center lg:justify-start gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                  SplitFlow
                </h1>
              </div>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                Split expenses, not friendships.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto lg:mx-0">
                The AI-powered expense splitting app that makes managing shared costs effortless. Smarter than Splitwise, completely free.
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-4"
            >
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                    <f.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{f.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{f.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: Login Card */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl">Get Started</CardTitle>
                <CardDescription>Choose how you&apos;d like to sign in</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* OAuth Buttons */}
                <Button 
                  variant="outline" 
                  className="w-full h-12 text-base gap-3" 
                  onClick={() => signIn('github')}
                  disabled={isLoading}
                >
                  <Github className="w-5 h-5" />
                  Continue with GitHub
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full h-12 text-base gap-3" 
                  onClick={() => signIn('google')}
                  disabled={isLoading}
                >
                  <Chrome className="w-5 h-5" />
                  Continue with Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or try demo</span>
                  </div>
                </div>

                {/* Demo Login */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="demo-name">Name</Label>
                    <Input 
                      id="demo-name"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <div>
                    <Label htmlFor="demo-email">Email</Label>
                    <Input 
                      id="demo-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  <Button 
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-base gap-2" 
                    onClick={handleDemoLogin}
                    disabled={!email || demoLoading}
                  >
                    {demoLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Start Splitting
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
        Free forever. No ads. No premium. Built with 💚
      </footer>
    </div>
  );
}
