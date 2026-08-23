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
  Camera,
  Moon,
  Link2,
  UserPlus,
  History,
  Bell,
  TrendingUp,
  Split,
  Check,
  X,
  DollarSign,
  type LucideIcon,
} from 'lucide-react';

const features = [
  { icon: Split, title: 'Flexible Splitting', description: 'Equal, exact amounts, percentages, or custom shares. AI suggests the best split based on context.' },
  { icon: Bot, title: 'AI Natural Language', description: 'Type "Paid $50 for pizza split 3 ways" and AI creates the expense with perfect splits automatically.' },
  { icon: Camera, title: 'Receipt Scanning', description: 'Snap a photo of any receipt. AI extracts amount, description, category, and even individual items.' },
  { icon: BarChart3, title: 'Spending Analytics', description: 'Beautiful charts showing spending by category, time period, group, and trends with AI-powered insights.' },
  { icon: Users, title: 'Groups & Friends', description: 'Create groups for trips, apartments, dinners. Manage friend requests and track balances across all contexts.' },
  { icon: Calculator, title: 'Debt Simplification', description: 'AI minimizes total transactions needed. Instead of 6 payments, settle with just 2.' },
  { icon: History, title: 'Expense History', description: 'Full searchable history with filters by group, category, date. Never lose track of a past expense.' },
  { icon: DollarSign, title: 'Multi-Currency', description: 'Support for INR, USD, EUR, GBP, JPY and more. Each group can use its own currency.' },
  { icon: UserPlus, title: 'Non-User Splitting', description: 'Split with people who don\'t have an account. They get notified via email and can settle later.' },
  { icon: Link2, title: 'Invite Links', description: 'Share a link to invite people to your group. No manual code entry needed — just tap and join.' },
  { icon: Bell, title: 'Activity Feed', description: 'Real-time feed of all group activity — new expenses, payments, members joining, and more.' },
  { icon: TrendingUp, title: 'Personal Tracking', description: 'Not just splitting! Track personal expenses too. A complete financial companion in one app.' },
  { icon: Moon, title: 'Dark Mode', description: 'Beautiful dark theme with multiple palette options. Easy on the eyes, day or night.' },
  { icon: Globe, title: 'Works Everywhere', description: 'Fully responsive web app. Use on desktop, tablet, or phone — no download required.' },
];

const competitors = [
  { name: 'SplitFlow', values: [true, true, true, true, true, true, true, true, true, true] },
  { name: 'Splitwise', values: [true, false, false, false, true, false, true, true, false, false] },
  { name: 'Tricount', values: [true, false, false, false, true, false, false, true, false, false] },
  { name: 'Splittr', values: [true, false, false, false, false, false, false, false, false, false] },
];

const compFeatures = [
  'Free Forever',
  'AI Expense Entry',
  'Receipt Scanning',
  'AI Analytics',
  'Group Management',
  'Debt Simplification',
  'Multi-Currency',
  'Dark Mode',
  'Invite Links',
  'Personal Tracking',
];

const steps = [
  { num: '1', title: 'Sign Up Free', desc: 'Create your account in seconds with Google or GitHub OAuth. No credit card, no strings attached.' },
  { num: '2', title: 'Add Expenses', desc: 'Enter manually, use AI natural language ("Lunch \u20b9300 split 4 ways"), or snap a receipt photo.' },
  { num: '3', title: 'Split Smartly', desc: 'Choose equal, exact, percentage, or custom shares. AI auto-detects the best split from your description.' },
  { num: '4', title: 'Settle Up', desc: 'See simplified debts at a glance. Record payments and keep everyone\'s balances clean.' },
];

function CheckIcon({ on }: { on: boolean }) {
  return on ? (
    <Check className="w-4 h-4 text-primary" />
  ) : (
    <X className="w-4 h-4 text-muted-foreground/40" />
  );
}

function FeatureCard({ f, i }: { f: { icon: LucideIcon; title: string; description: string }; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.04 }}
      className="p-5 rounded-xl bg-card border border-border hover:shadow-md transition-shadow duration-200"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
        <f.icon className="w-5 h-5 text-primary" />
      </div>
      <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
    </motion.div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
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
            The free AI-powered alternative to Splitwise. Split smarter with natural language entry, receipt scanning, debt simplification, and beautiful spending analytics.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row gap-3 justify-center"
          >
            <a
              href="/app"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-primary-foreground font-semibold text-sm bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200"
            >
              Open SplitFlow
              <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-primary" /><span>100% Free</span></div>
            <div className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-primary" /><span>AI-Powered</span></div>
            <div className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-primary" /><span>Works Everywhere</span></div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-3xl font-bold">
              Everything you need to{' '}
              <span className="text-primary">manage money together</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              From AI expense entry to debt simplification, SplitFlow covers every aspect of shared and personal finances.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <FeatureCard key={f.title} f={f} i={i} />
            ))}
          </div>
        </div>
      </section>

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

      <section className="py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-3xl font-bold">
              How does SplitFlow{' '}
              <span className="text-primary">compare?</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              A feature-by-feature comparison with the most popular expense splitting apps.
            </p>
          </motion.div>

          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 font-semibold text-foreground">Feature</th>
                  {competitors.map((c) => (
                    <th
                      key={c.name}
                      className={`py-3 px-3 text-center font-semibold ${c.name === 'SplitFlow' ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compFeatures.map((feat, fi) => (
                  <tr key={feat} className={fi % 2 === 0 ? 'bg-muted/30' : ''}>
                    <td className="py-2.5 px-3 text-foreground font-medium text-xs">{feat}</td>
                    {competitors.map((c) => (
                      <td key={c.name} className="py-2.5 px-3 text-center">
                        <div className="flex justify-center">
                          <CheckIcon on={c.values[fi]} />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid sm:grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl bg-card border border-border">
              <p className="text-2xl font-bold text-primary">0</p>
              <p className="text-xs text-muted-foreground mt-1">Cost forever</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <p className="text-2xl font-bold text-primary">14+</p>
              <p className="text-xs text-muted-foreground mt-1">Core features</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <p className="text-2xl font-bold text-primary">5</p>
              <p className="text-xs text-muted-foreground mt-1">Currencies supported</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-3xl font-bold">
              Why people choose{' '}
              <span className="text-primary">SplitFlow</span>
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: 'No subscription traps', desc: 'Splitwise charges $5/month for Pro features like receipt scanning and currency conversion. SplitFlow gives you all of that for free.' },
              { title: 'AI does the heavy lifting', desc: 'Instead of tapping through 10 fields, just type what happened in plain English. AI creates the expense, picks the category, and calculates splits.' },
              { title: 'Split with anyone', desc: 'Other apps require everyone to sign up. SplitFlow lets you split with non-users via email — they get a beautiful summary and can join later.' },
              { title: 'Beautiful dark mode', desc: 'Most expense apps look like spreadsheets. SplitFlow has a premium dark theme with multiple palettes — use it at night without straining your eyes.' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl bg-card border border-border"
              >
                <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

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
              Free forever, no ads, no data selling. Just a better way to split expenses.
            </p>
            <a
              href="/app"
              className="inline-flex items-center gap-2 mt-8 px-8 py-3.5 rounded-xl text-primary-foreground font-semibold text-sm bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200"
            >
              Open SplitFlow Now
              <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>
        </div>
      </section>

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
