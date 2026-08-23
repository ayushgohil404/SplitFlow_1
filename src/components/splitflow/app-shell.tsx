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
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
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
};

const navItems: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & balances' },
  { view: 'history', label: 'History', icon: Clock, description: 'All expense records' },
  { view: 'groups', label: 'Groups', icon: Users, description: 'Manage groups' },
  { view: 'friends', label: 'Friends', icon: UserPlus, description: 'Friends & balances' },
  { view: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Spending insights' },
  { view: 'activity', label: 'Activity', icon: Activity, description: 'Recent actions' },
  { view: 'ai-assistant', label: 'AI Assistant', icon: Bot, description: 'Ask AI anything' },
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
      <div className="h-16 px-5 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <Wallet className="w-[18px] h-[18px] text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-foreground tracking-tight leading-tight">
            Split<span className="text-primary">Flow</span>
          </span>
          <span className="text-[10px] text-muted-foreground leading-tight">AI-Powered Splitting</span>
        </div>
      </div>

      <Separator />

      {/* Nav items */}
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-1" role="navigation" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive = view === item.view;
            return (
              <TooltipProvider key={item.view} delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNav(item.view)}
                      className={`w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium text-left transition-colors duration-150
                        ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-primary' : ''}`} />
                      <span className="flex-1">{item.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    <p className="font-medium">{item.label}</p>
                    <p className="text-muted-foreground">{item.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User info */}
      <Separator />
      <div className="p-3">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate leading-tight">{user?.name || 'User'}</p>
            <p className="text-[11px] text-muted-foreground truncate leading-tight">{user?.email || ''}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2 h-9"
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
      <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
        <AlertCircle className="w-7 h-7 text-destructive" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">Something went wrong</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">Failed to load {viewName}. Your data is safe.</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Try Again
        </Button>
        <Button size="sm" onClick={() => useAppStore.getState().setView('dashboard')} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5">
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
  static getDerivedStateFromError() { return { hasError: true }; }
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
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
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

  const handleMobileNav = () => setSidebarOpen(false);

  const handleBack = () => {
    if (view === 'group-detail') setView('groups');
    else if (view === 'add-expense') setView('dashboard');
    else setView('dashboard');
  };

  const showBack = detailViews.includes(view);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={(open) => setSidebarOpen(open)}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-border">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SidebarContent onNavigate={handleMobileNav} />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - fixed height, properly aligned */}
        <header className="h-14 shrink-0 border-b border-border bg-background flex items-center px-4 gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden -ml-1 shrink-0 h-9 w-9"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </Button>

          {showBack && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-9 -ml-1 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleBack}
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          )}

          <h1 className="text-base font-semibold text-foreground truncate">
            {viewLabels[view]}
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto bg-muted/30" role="main">
          <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            <ViewRouter />
          </div>
        </main>
      </div>

      {/* FAB - Add Expense — fixed bottom-right, properly positioned */}
      <button
        onClick={() => setView('add-expense')}
        className="fixed bottom-6 right-6 z-50
          h-14 w-14 sm:h-auto sm:w-auto sm:px-5 sm:py-3
          bg-primary hover:bg-primary/90 text-primary-foreground
          rounded-full sm:rounded-xl
          shadow-lg hover:shadow-xl
          flex items-center justify-center sm:gap-2.5
          transition-all duration-200 active:scale-95"
        aria-label="Add Expense"
      >
        <Plus className="w-5 h-5 shrink-0" />
        <span className="font-semibold text-sm hidden sm:inline">Add Expense</span>
      </button>

      {/* Floating AI Bubble - bottom-left */}
      <FloatingAIBubble />
    </div>
  );
}
