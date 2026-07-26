import { create } from 'zustand';
import type { AuthResponse, PublicUser } from '@/lib/api/types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  status: AuthStatus;
  setSession: (session: AuthResponse) => void;
  setUser: (user: PublicUser) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;
}

/**
 * The access token intentionally lives in memory only. The refresh token is an
 * httpOnly cookie, so a page reload restores the session through /auth/refresh.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'loading',
  setSession: (session) =>
    set({ user: session.user, accessToken: session.accessToken, status: 'authenticated' }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  clear: () => set({ user: null, accessToken: null, status: 'anonymous' }),
}));
