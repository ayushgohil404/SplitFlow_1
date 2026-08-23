'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  Sparkles,
  Users,
  Split,
  Bot,
  BarChart3,
  Receipt,
  Shield,
  Zap,
  Globe,
  ChevronRight,
  Star,
  TrendingUp,
  Calculator,
} from 'lucide-react';

const features = [
  {
    icon: Split,
    title: 'Smart Expense Splitting',
    description: 'Split equally, by exact amounts, percentages, or custom shares. The most flexible splitting engine available.',
    color: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  {
    icon: Bot,
    title: 'AI-Powered',
    description: 'Just type "Paid $50 for pizza split 3 ways" and AI handles everything. Natural language expense entry.',
    color: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
  },
  {
    icon: Receipt,
    title: 'Receipt Scanning',
    description: 'Snap a photo of any receipt and AI automatically extracts amount, description, and category.',
    color: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
  },
  {
    icon: Users,
    title: 'Groups & Friends',
    description: 'Create groups for trips, apartments, or events. Track who owes whom across multiple group contexts.',
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    icon: BarChart3,
    title: 'Spending Analytics',
    description: 'Beautiful charts and insights showing your spending patterns by category, time, and group.',
    color: 'from-rose-500 to-pink-600',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
  },
  {
    icon: Calculator,
    title: 'Personal Expense Tracking',
    description: 'Not just splitting! Track your personal expenses too. A complete financial companion.',
    color: 'from-cyan-500 to-teal-600',
    bg: 'bg-cyan-50 dark:bg-cyan-900/20',
  },
];

const steps = [
  { num: '1', title: 'Sign Up Free', desc: 'Create your account in seconds with Google or GitHub. No credit card needed.' },
  { num: '2', title: 'Add Expenses', desc: 'Enter expenses manually, use AI natural language, or scan receipts.' },
  { num: '3', title: 'Split Smartly', desc: 'Choose equal, exact, percentage, or share-based splitting. AI helps.' },
  { num: '4', title: 'Stay Balanced', desc: 'See who owes whom, simplify debts, and settle up easily.' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-300">
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-200/40 dark:bg-emerald-900/20 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-teal-200/30 dark:bg-teal-900/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-violet-200/20 dark:bg-violet-900/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 mb-6">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">AI-Powered Expense Splitting</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight"
          >
            Split Expenses,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500">
              Not Friendships
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed"
          >
            {`You've been added to an expense on SplitFlow! Join now to see what you owe, track shared expenses, and manage your personal finances — all powered by AI.`}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-white font-semibold text-base
                bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700
                shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/35
                transition-all duration-300 hover:-translate-y-0.5"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-base
                bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300
                hover:bg-gray-200 dark:hover:bg-gray-700
                transition-all duration-300 hover:-translate-y-0.5"
            >
              See Features
              <ChevronRight className="w-4 h-4" />
            </a>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12 flex items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400"
          >
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>100% Free</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>AI-Powered</span>
            </div>
            <div className="flex items-center gap-1">
              <Globe className="w-4 h-4 text-blue-500" />
              <span>Works Everywhere</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-gray-50/50 dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold">
              Everything you need to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">
                manage money together
              </span>
            </h2>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Whether you're splitting dinner with friends, managing shared rent, or tracking personal expenses — SplitFlow handles it all.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="relative p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800
                  hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-black/30
                  transition-all duration-300 group"
              >
                <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4
                  group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-6 h-6 bg-gradient-to-br ${feature.color} bg-clip-text`} style={{ color: 'transparent', background: 'none' }} />
                  <feature.icon className={`w-6 h-6 absolute`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold">Get started in seconds</h2>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">Four simple steps to never lose track of shared expenses again.</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
            className="space-y-6"
          >
            {steps.map((step) => (
              <motion.div
                key={step.num}
                variants={fadeUp}
                className="flex items-start gap-5 p-5 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors duration-200"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">
                  {step.num}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{step.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gray-50/50 dark:bg-gray-900/50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
            <div className="inline-flex items-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-5 h-5 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Stop chasing people for money.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">
                Let SplitFlow handle it.
              </span>
            </h2>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
              Join thousands of users who split expenses the smart way. Free forever, no strings attached.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 mt-8 px-10 py-4 rounded-2xl text-white font-semibold text-base
                bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700
                shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/35
                transition-all duration-300 hover:-translate-y-0.5"
            >
              Start Using SplitFlow
              <ArrowRight className="w-5 h-5" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">SF</span>
            </div>
            <span className="font-semibold text-sm">SplitFlow</span>
          </div>
          <p className="text-xs text-gray-400">Split expenses, not friendships. AI-powered expense splitting.</p>
        </div>
      </footer>
    </div>
  );
}
