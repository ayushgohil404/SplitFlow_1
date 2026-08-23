'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { AnimatePresence, motion } from 'framer-motion';

export function ThemeToggle() {
  const { theme, setTheme } = useAppStore();

  const cycle = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  return (
    <button
      onClick={cycle}
      className="relative h-9 w-9 rounded-lg flex items-center justify-center
        hover:bg-accent active:bg-accent
        text-muted-foreground hover:text-foreground
        transition-colors duration-150"
      aria-label={`Theme: ${theme}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {theme === 'light' && (
          <motion.span
            key="light"
            initial={{ rotate: -90, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            exit={{ rotate: 90, scale: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Sun className="w-[18px] h-[18px]" />
          </motion.span>
        )}
        {theme === 'dark' && (
          <motion.span
            key="dark"
            initial={{ rotate: 90, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            exit={{ rotate: -90, scale: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Moon className="w-[18px] h-[18px]" />
          </motion.span>
        )}
        {theme === 'system' && (
          <motion.span
            key="system"
            initial={{ y: -6, scale: 0 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 6, scale: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Monitor className="w-[18px] h-[18px]" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
