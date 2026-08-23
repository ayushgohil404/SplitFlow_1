'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { motion, AnimatePresence } from 'framer-motion';

export function ThemeToggle() {
  const { theme, setTheme } = useAppStore();

  const cycle = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  return (
    <button
      onClick={cycle}
      className="relative w-8 h-8 rounded-lg flex items-center justify-center
        bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
        transition-all duration-200 group"
      aria-label={`Current theme: ${theme}. Click to switch.`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {theme === 'light' && (
          <motion.span
            key="light"
            initial={{ rotate: -90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Sun className="w-4 h-4 text-amber-500" />
          </motion.span>
        )}
        {theme === 'dark' && (
          <motion.span
            key="dark"
            initial={{ rotate: 90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: -90, scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Moon className="w-4 h-4 text-blue-400" />
          </motion.span>
        )}
        {theme === 'system' && (
          <motion.span
            key="system"
            initial={{ y: -8, scale: 0, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Monitor className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
