'use client';

import { useAuth } from '@/hooks/use-auth';
import { AuthPage } from '@/components/splitflow/auth-page';
import { AppShell } from '@/components/splitflow/app-shell';
import { ErrorBoundary } from '@/components/error-boundary';

export default function Home() {
  const { user, isLoading, checked } = useAuth();

  if (!checked || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading SplitFlow...</p>
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
