'use client';

import { useEffect, useState, useCallback } from 'react';
import { signOut as nextAuthSignOut } from 'next-auth/react';
import { useAppStore } from '@/store/app-store';

export function useAuth() {
  const { user, setUser, isLoading } = useAppStore();
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

  const signOut = async () => {
    // Clear all auth cookies
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim();
      document.cookie = `${name}=; path=/; max-age=0; domain=${window.location.hostname}`;
      document.cookie = `${name}=; path=/; max-age=0`;
    });
    setUser(null);
    setChecked(false);
    // Use NextAuth's signOut which handles CSRF token properly
    await nextAuthSignOut({ redirect: false });
    window.location.href = '/app';
  };

  return { user, isLoading: isLoading && !checked, checked, signOut, checkSession };
}
