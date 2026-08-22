'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';

export function useAuth() {
  const { user, setUser, setLoading, isLoading } = useAppStore();
  const [checked, setChecked] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      const session = await res.json();
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setChecked(true);
    }
  }, [setUser]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const signIn = async (provider: string, credentials?: { email: string; name: string }) => {
    if (provider === 'credentials' && credentials) {
      const res = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: credentials.email,
          name: credentials.name,
          csrfToken: document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || 'dummy',
        }),
      });
      if (res.ok) {
        await checkSession();
        return;
      }
    }
    window.location.href = `/api/auth/signin/${provider}`;
  };

  const signOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    setUser(null);
    setChecked(false);
    window.location.href = '/';
  };

  return { user, isLoading: isLoading && !checked, checked, signIn, signOut, checkSession };
}