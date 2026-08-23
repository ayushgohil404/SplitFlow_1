'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  Sparkles,
  Users,
  Bot,
  BarChart3,
  Receipt,
  Shield,
  Zap,
  Globe,
  Star,
  Calculator,
  Wallet,
} from 'lucide-react';

const features = [
  { icon: Wallet, title: 'Smart Expense Splitting', description: 'Split equally, by exact amounts, percentages, or custom shares. The most flexible splitting engine available.' },
  { icon: Bot, title: 'AI-Powered', description: 'Just type "Paid $50 for pizza split 3 ways" and AI handles everything. Natural language expense entry.' },
  { icon: Receipt, title: 'Receipt Scanning', description: 'Snap a photo of any receipt and AI automatically extracts amount, description, and category.' },
  { icon: Users, title: 'Groups & Friends', description: 'Create groups for trips, apartments, or events. Track who owes whom across multiple contexts.' },
  { icon: BarChart3, title: 'Spending Analytics', description: 'Beautiful charts and insights showing your spending patterns by category, time, and group.' },
  { icon: Calculator, title: 'Personal Tracking', description: 'Not just splitting! Track your personal expenses too. A complete financial companion.' },
];

const steps = [
  { num: '1', title: 'Sign Up Free', desc: 'Create your account in seconds with Google or GitHub. No credit card needed.' },
  { num: '2', title: 'Add Expenses', desc: 'Enter expenses manually, use AI natural language, or scan receipts.' },
  { num: '3', title: 'Split Smartly', desc: 'Choose equal, exact, percentage, or share-based splitting. AI helps.' },
  { num: '4', title: 'Stay Balanced', desc: 'See who owes whom, simplify debts, and settle up easily.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">AI-Powered Expense Splitting</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight"
          >
            Split Expenses,{' '}
            <span className="text-primary">Not Friendships</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            You have been added to an expense on SplitFlow! Join now to see what you owe, track shared expenses, and manage your personal finances — all powered by AI.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row gap-3 justify-center"
          >
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-primary-foreground font-semibold text-sm
                bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-10 flex items-center justify-center gap-6 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-primary" /><span>100% Free</span></div>
            <div className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-primary" /><span>AI-Powered</span></div>
            <div className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-primary" /><span>Works Everywhere</span></div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-3xl font-bold">
              Everything you need to{' '}
              <span className="text-primary">manage money together</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Whether you are splitting dinner with friends, managing shared rent, or tracking personal expenses.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="p-5 rounded-xl bg-card border border-border hover:shadow-md transition-shadow duration-200"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-3xl font-bold">Get started in seconds</h2>
            <p className="mt-3 text-muted-foreground">Four simple steps to never lose track of shared expenses again.</p>
          </motion.div>

          <div className="space-y-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-4 p-4 rounded-xl hover:bg-muted/50 transition-colors duration-150"
              >
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 text-xs">
                  {step.num}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{step.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="inline-flex items-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-4 h-4 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <h2 className="text-3xl font-bold">
              Stop chasing people for money.
              <br />
              <span className="text-primary">Let SplitFlow handle it.</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              Join thousands of users who split expenses the smart way. Free forever, no strings attached.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 mt-8 px-8 py-3.5 rounded-xl text-primary-foreground font-semibold text-sm
                bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200"
            >
              Start Using SplitFlow
              <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-border">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-[10px] font-bold">SF</span>
            </div>
            <span className="text-sm font-semibold">SplitFlow</span>
          </div>
          <p className="text-xs text-muted-foreground">Split expenses, not friendships. AI-powered expense splitting.</p>
        </div>
      </footer>
    </div>
  );
}
