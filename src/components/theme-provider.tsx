'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeEffect() {
  const theme = useAppStore((s) => s.theme);
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  const applyTheme = useCallback((t: 'light' | 'dark') => {
    setResolved(t);
    const root = document.documentElement;
    if (t === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;
    applyTheme(resolvedTheme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme, applyTheme]);

  useEffect(() => {
    const stored = localStorage.getItem('splitflow-prefs');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const t = parsed.state?.theme;
        if (t) {
          const rt = t === 'system' ? getSystemTheme() : t;
          if (rt === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      } catch {}
    }
  }, []);

  return null;
}
