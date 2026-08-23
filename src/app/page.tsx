'use client';

import { useAuth } from '@/hooks/use-auth';
import { AuthPage } from '@/components/splitflow/auth-page';
import { AppShell } from '@/components/splitflow/app-shell';
import { ErrorBoundary } from '@/components/error-boundary';

export default function Home() {
  const { user, isLoading, checked } = useAuth();

  if (!checked || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading SplitFlow...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
