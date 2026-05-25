import { create } from 'zustand';
import api from '@/lib/api';

interface User {
  id: string;
  mobile: string;
  name?: string;
  email?: string;
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  login: (accessToken: string, user: User) => void;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  updateProfile: (data: { name?: string; email?: string; avatarUrl?: string }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),

  login: (accessToken, user) => {
    localStorage.setItem('accessToken', accessToken);
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Even if logout API fails, clear local state
    }
    localStorage.removeItem('accessToken');
    set({ user: null, isAuthenticated: false, isLoading: false });
    window.location.href = '/login';
  },

  fetchMe: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const { data } = await api.get('/auth/me');
      const normalizedUser = {
        ...data.user,
        id: data.user._id || data.user.id
      };
      set({ user: normalizedUser, isAuthenticated: true, isLoading: false });
    } catch (err) {
      localStorage.removeItem('accessToken');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateProfile: async (profileData) => {
    const { data } = await api.put('/auth/me', profileData);
    const normalizedUser = {
      ...data.user,
      id: data.user._id || data.user.id
    };
    set({ user: normalizedUser });
  },
}));
