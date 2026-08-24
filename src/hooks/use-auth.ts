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
      const data = await res.json();
      const session = data.session || data;
      if (session?.user) {
        setUser({
          id: (session.user as any).id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        });
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
    try {
      // Use NextAuth's signOut which handles CSRF token + server-side session invalidation
      await nextAuthSignOut({ redirect: false });
    } catch {
      // If NextAuth signOut fails, manually clear cookies as fallback
      document.cookie.split(';').forEach((c) => {
        const name = c.split('=')[0].trim();
        document.cookie = `${name}=; path=/; max-age=0; domain=${window.location.hostname}`;
        document.cookie = `${name}=; path=/; max-age=0`;
      });
    }
    setUser(null);
    setChecked(false);
    // Small delay to ensure cookies are cleared before redirect
    await new Promise((r) => setTimeout(r, 100));
    window.location.href = '/app';
  };

  return { user, isLoading: isLoading && !checked, checked, signOut, checkSession };
}
