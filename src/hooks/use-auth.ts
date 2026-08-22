'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';

export function useAuth() {
  const { user, setUser, isLoading } = useAppStore();
  const [checked, setChecked] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      // Check NextAuth session first
      const res = await fetch('/api/auth/session');
      const session = await res.json();
      if (session?.user) {
        setUser(session.user);
        setChecked(true);
        return;
      }
      
      // Fallback: check demo session
      const demoRes = await fetch('/api/auth/demo-session');
      if (demoRes.ok) {
        const demoSession = await demoRes.json();
        if (demoSession?.user) {
          setUser(demoSession.user);
          setChecked(true);
          return;
        }
      }
      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setChecked(true);
    }
  }, [setUser]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const signOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    // Clear demo cookie
    document.cookie = 'sf-token=; path=/; max-age=0';
    setUser(null);
    setChecked(false);
    window.location.href = '/';
  };

  return { user, isLoading: isLoading && !checked, checked, signOut, checkSession };
}
