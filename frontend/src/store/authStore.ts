import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  login: (user, token, refreshToken) => set({ user, token, refreshToken, isAuthenticated: true }),
  logout: () => set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),
  updateUser: (user) => set((state) => ({ user: { ...state.user!, ...user } })),
}));
