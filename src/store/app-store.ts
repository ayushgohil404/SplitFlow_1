import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type View = 
  | 'dashboard' 
  | 'groups' 
  | 'group-detail' 
  | 'add-expense' 
  | 'analytics' 
  | 'activity' 
  | 'ai-assistant'
  | 'friends'
  | 'history';

interface AppState {
  view: View;
  selectedGroupId: string | null;
  sidebarOpen: boolean;
  user: any | null;
  isLoading: boolean;
  theme: 'light' | 'dark' | 'system';
  
  setView: (view: View) => void;
  selectGroup: (groupId: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setUser: (user: any | null) => void;
  setLoading: (loading: boolean) => void;
  navigateToGroup: (groupId: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      view: 'dashboard',
      selectedGroupId: null,
      sidebarOpen: true,
      user: null,
      isLoading: true,
      theme: 'system',
      
      setView: (view) => set({ view }),
      selectGroup: (groupId) => set({ selectedGroupId: groupId }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setUser: (user) => set({ user, isLoading: false }),
      setLoading: (loading) => set({ isLoading: loading }),
      navigateToGroup: (groupId) => set({ view: 'group-detail', selectedGroupId: groupId }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'splitflow-prefs',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);