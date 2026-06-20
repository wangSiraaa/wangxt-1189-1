import { create } from 'zustand';
import { User, UserRole } from '../types';

interface AppState {
  currentUser: User | null;
  currentRole: UserRole | null;
  setCurrentUser: (user: User | null) => void;
  setCurrentRole: (role: UserRole | null) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  currentRole: null,
  setCurrentUser: (user) => {
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
    set({ currentUser: user, currentRole: user?.role || null });
  },
  setCurrentRole: (role) => set({ currentRole: role }),
  logout: () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('auth_token');
    set({ currentUser: null, currentRole: null });
  },
}));

export const initializeAuth = () => {
  const stored = localStorage.getItem('currentUser');
  if (stored) {
    try {
      const user = JSON.parse(stored);
      useAppStore.getState().setCurrentUser(user);
    } catch (e) {
      localStorage.removeItem('currentUser');
    }
  }
};
