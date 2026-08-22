'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  HandCoins,
  BarChart3,
  Activity,
  Bot,
  UserCircle,
  Plus,
  Wallet,
  Menu,
  LogOut,
  UserPlus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

type NavItem = {
  view: View;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'groups', label: 'Groups', icon: Users },
  { view: 'friends', label: 'Friends', icon: UserPlus },
  { view: 'settle', label: 'Settle Up', icon: HandCoins },
  { view: 'analytics', label: 'Analytics', icon: BarChart3 },
  { view: 'activity', label: 'Activity', icon: Activity },
  { view: 'ai-assistant', label: 'AI Assistant', icon: Bot },
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
};

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
        <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900 tracking-tight">
          Split<span className="text-emerald-600">Flow</span>
        </span>
      </div>

      <Separator className="mx-3 my-2" />

      {/* Nav items */}
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = view === item.view;
            return (
              <button
                key={item.view}
                onClick={() => handleNav(item.view)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left
                  ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <item.icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive ? 'text-emerald-600' : 'text-gray-400'
                  }`}
                />
                {item.label}
              </button>
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

function ViewRouter() {
  const { view } = useAppStore();

  const viewComponents: Record<View, React.ReactNode> = {
    dashboard: <DashboardView />,
    groups: <GroupsView />,
    'group-detail': <GroupDetailView />,
    'add-expense': <AddExpenseView />,
    settle: <SettleView />,
    analytics: <AnalyticsView />,
    activity: <ActivityView />,
    'ai-assistant': <AIAssistantView />,
    friends: <FriendsView />,
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.2 }}
      >
        {viewComponents[view]}
      </motion.div>
    </AnimatePresence>
  );
}

export function AppShell() {
  const { view, setView, setSidebarOpen, sidebarOpen } = useAppStore();

  const handleMobileNav = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-gray-200 bg-white">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={sidebarOpen} onOpenChange={(open) => {
        setSidebarOpen(open);
      }}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={handleMobileNav} />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-gray-200 bg-white flex items-center px-4 gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden -ml-1"
            onClick={() => {
              setSheetOpen(true);
              setSidebarOpen(true);
            }}
          >
            <Menu className="w-5 h-5" />
          </Button>

          <h2 className="text-lg font-semibold text-gray-900 truncate">
            {viewLabels[view]}
          </h2>

          <div className="ml-auto">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setView('add-expense')}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Expense
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-6xl mx-auto">
            <ViewRouter />
          </div>
        </main>
      </div>
    </div>
  );
}
