'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  HandCoins,
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
import { SettleView } from './settle-view';
import { AnalyticsView } from './analytics-view';
import { ActivityView } from './activity-view';
import { AIAssistantView } from './ai-assistant-view';
import { FriendsView } from './friends-view';
import { HistoryView } from './history-view';

type NavItem = {
  view: View;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
};

const navItems: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & balances' },
  { view: 'history', label: 'History', icon: Clock, description: 'All expense records' },
  { view: 'groups', label: 'Groups', icon: Users, description: 'Manage groups' },
  { view: 'friends', label: 'Friends', icon: UserPlus, description: 'Friends & balances' },
  { view: 'settle', label: 'Settle Up', icon: HandCoins, description: 'Record payments' },
  { view: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Spending insights' },
  { view: 'activity', label: 'Activity', icon: Activity, description: 'Recent actions' },
  { view: 'ai-assistant', label: 'AI Assistant', icon: Bot, description: 'Ask AI anything' },
];

const viewLabels: Record<View, string> = {
  dashboard: 'Dashboard',
  groups: 'Groups',
  'group-detail': 'Group Details',
  'add-expense': 'Add Expense',
  settle: 'Settle Up',
  analytics: 'Analytics',
  activity: 'Activity',
  'ai-assistant': 'AI Assistant',
  friends: 'Friends',
  history: 'History',
};

// Views that show a back button
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
        <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm">
          <Wallet className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">
            Split<span className="text-emerald-600">Flow</span>
          </span>
          <p className="text-[10px] text-gray-400 -mt-0.5">AI-Powered Splitting</p>
        </div>
      </div>

      <Separator className="mx-3 my-2" />

      {/* Nav items */}
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="space-y-0.5" role="navigation" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive = view === item.view;
            return (
              <TooltipProvider key={item.view} delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNav(item.view)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left
                        ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`
                      }
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <item.icon
                        className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {isActive && (
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
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
      <Separator className="mx-3" />
      <div className="px-3 py-3">
        <div className="flex items-center gap-3 px-2 mb-2">
          <Avatar className="w-9 h-9">
            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-semibold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start gap-2 text-gray-500 hover:text-red-600 hover:bg-red-50 px-2"
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
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-3">
        <AlertCircle className="w-7 h-7 text-red-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">Something went wrong</h3>
      <p className="text-sm text-gray-500 mb-4 max-w-xs">Failed to load {viewName}. Your data is safe.</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Try Again
        </Button>
        <Button size="sm" onClick={() => useAppStore.getState().setView('dashboard')} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
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
    settle: { label: 'Settle Up', component: <SettleView /> },
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
        transition={{ duration: 0.15, ease: 'easeOut' }}
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
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-gray-200 bg-white">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={sidebarOpen} onOpenChange={(open) => setSidebarOpen(open)}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SidebarContent onNavigate={handleMobileNav} />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-gray-200 bg-white flex items-center px-4 gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden -ml-1 shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </Button>

          {showBack && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-gray-500 hover:text-gray-900 -ml-1"
              onClick={handleBack}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          )}

          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {viewLabels[view]}
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    onClick={() => setView('add-expense')}
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    <span className="hidden sm:inline">Add Expense</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  Record a new expense to split with friends or group
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto" role="main">
          <div className="p-4 sm:p-6 max-w-6xl mx-auto">
            <ViewRouter />
          </div>
        </main>
      </div>
    </div>
  );
}
