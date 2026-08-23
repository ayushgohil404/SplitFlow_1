'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Activity,
  Bot,
  UserPlus,
  Plus,
  Wallet,
  Menu,
  LogOut,
  ArrowLeft,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppStore, type View } from '@/store/app-store';
import { useAuth } from '@/hooks/use-auth';
import { DashboardView } from './dashboard-view';
import { GroupsView } from './groups-view';
import { GroupDetailView } from './group-detail-view';
import { AddExpenseView } from './add-expense-view';
import { AnalyticsView } from './analytics-view';
import { ActivityView } from './activity-view';
import { AIAssistantView } from './ai-assistant-view';
import { FriendsView } from './friends-view';
import { HistoryView } from './history-view';
import { ThemeToggle } from './theme-toggle';
import { FloatingAIBubble } from './floating-ai-bubble';

type NavItem = {
  view: View;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  gradient?: string;
};

const navItems: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & balances', gradient: 'from-blue-500 to-indigo-600' },
  { view: 'history', label: 'History', icon: Clock, description: 'All expense records', gradient: 'from-amber-500 to-orange-600' },
  { view: 'groups', label: 'Groups', icon: Users, description: 'Manage groups', gradient: 'from-purple-500 to-pink-600' },
  { view: 'friends', label: 'Friends', icon: UserPlus, description: 'Friends & balances', gradient: 'from-cyan-500 to-blue-600' },
  { view: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Spending insights', gradient: 'from-emerald-500 to-teal-600' },
  { view: 'activity', label: 'Activity', icon: Activity, description: 'Recent actions', gradient: 'from-rose-500 to-red-600' },
  { view: 'ai-assistant', label: 'AI Assistant', icon: Bot, description: 'Ask AI anything', gradient: 'from-violet-500 to-purple-600' },
];

const viewLabels: Record<View, string> = {
  dashboard: 'Dashboard',
  groups: 'Groups',
  'group-detail': 'Group Details',
  'add-expense': 'Add Expense',
  analytics: 'Analytics',
  activity: 'Activity',
  'ai-assistant': 'AI Assistant',
  friends: 'Friends',
  history: 'History',
};

const detailViews: View[] = ['group-detail', 'add-expense'];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { view, setView, user } = useAppStore();
  const { signOut } = useAuth();

  const handleNav = (v: View) => {
    setView(v);
    onNavigate?.();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
          <Wallet className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
            Split<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600">Flow</span>
          </span>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 -mt-0.5 font-medium">AI-Powered Splitting</p>
        </div>
      </div>

      <Separator className="mx-3 my-2 bg-gray-100 dark:bg-gray-800" />

      {/* Nav items */}
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="space-y-1" role="navigation" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive = view === item.view;
            return (
              <TooltipProvider key={item.view} delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={() => handleNav(item.view)}
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.15 }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left relative overflow-hidden
                        transition-all duration-200
                        ${
                          isActive
                            ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/20 text-emerald-700 dark:text-emerald-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
                        }`
                      }
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeNav"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-to-b from-emerald-500 to-teal-500"
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      )}
                      <item.icon
                        className={`w-5 h-5 shrink-0 transition-colors duration-200 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                        />
                      )}
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    <p className="font-medium">{item.label}</p>
                    <p className="text-gray-400">{item.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User info */}
      <Separator className="mx-3 bg-gray-100 dark:bg-gray-800" />
      <div className="px-3 py-3">
        <div className="flex items-center gap-3 px-2 mb-2">
          <Avatar className="w-9 h-9 ring-2 ring-emerald-100 dark:ring-emerald-900/50">
            <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || ''}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start gap-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 rounded-xl transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

function ViewErrorFallback({ viewName, onReset }: { viewName: string; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-3">
        <AlertCircle className="w-7 h-7 text-red-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Something went wrong</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">Failed to load {viewName}. Your data is safe.</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5 rounded-xl">
          <RefreshCw className="w-3.5 h-3.5" /> Try Again
        </Button>
        <Button size="sm" onClick={() => useAppStore.getState().setView('dashboard')} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 rounded-xl">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

class ViewErrorBoundary extends React.Component<
  { children: React.ReactNode; viewName: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; viewName: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[SplitFlow] ${this.props.viewName} crashed:`, error, errorInfo);
  }
  handleReset = () => this.setState({ hasError: false });
  render() {
    if (this.state.hasError) {
      return <ViewErrorFallback viewName={this.props.viewName} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

function ViewRouter() {
  const { view } = useAppStore();

  const viewConfig: Record<View, { label: string; component: React.ReactNode }> = {
    dashboard: { label: 'Dashboard', component: <DashboardView /> },
    groups: { label: 'Groups', component: <GroupsView /> },
    'group-detail': { label: 'Group Details', component: <GroupDetailView /> },
    'add-expense': { label: 'Add Expense', component: <AddExpenseView /> },
    analytics: { label: 'Analytics', component: <AnalyticsView /> },
    activity: { label: 'Activity', component: <ActivityView /> },
    'ai-assistant': { label: 'AI Assistant', component: <AIAssistantView /> },
    friends: { label: 'Friends', component: <FriendsView /> },
    history: { label: 'History', component: <HistoryView /> },
  };

  const current = viewConfig[view];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <ViewErrorBoundary key={view} viewName={current.label}>
          {current.component}
        </ViewErrorBoundary>
      </motion.div>
    </AnimatePresence>
  );
}

export function AppShell() {
  const { view, setView, setSidebarOpen, sidebarOpen } = useAppStore();

  const handleMobileNav = () => {
    setSidebarOpen(false);
  };

  const handleBack = () => {
    if (view === 'group-detail') {
      setView('groups');
    } else if (view === 'add-expense') {
      setView('dashboard');
    } else {
      setView('dashboard');
    }
  };

  const showBack = detailViews.includes(view);

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-950 overflow-hidden transition-colors duration-300">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors duration-300">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={sidebarOpen} onOpenChange={(open) => setSidebarOpen(open)}>
        <SheetContent side="left" className="w-72 p-0 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SidebarContent onNavigate={handleMobileNav} />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl flex items-center px-4 gap-2 shrink-0 transition-colors duration-300">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden -ml-1 shrink-0 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </Button>

          {showBack && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 -ml-1 rounded-xl transition-colors"
              onClick={handleBack}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          )}

          <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {viewLabels[view]}
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto" role="main">
          <div className="p-4 sm:p-6 max-w-6xl mx-auto">
            <ViewRouter />
          </div>
        </main>
      </div>

      {/* FAB - Add Expense (bottom-right) */}
      <motion.button
        onClick={() => setView('add-expense')}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 group
          bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600
          text-white rounded-2xl px-5 py-3.5
          shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40
          flex items-center gap-2.5
          transition-shadow duration-300"
        aria-label="Add Expense"
      >
        <motion.div
          animate={{ rotate: view === 'add-expense' ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          <Plus className="w-5 h-5" />
        </motion.div>
        <span className="font-semibold text-sm hidden sm:inline">Add Expense</span>
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-2xl bg-emerald-500/30 animate-pulse pointer-events-none" />
      </motion.button>

      {/* Floating AI Bubble (bottom-left) */}
      <FloatingAIBubble />
    </div>
  );
}