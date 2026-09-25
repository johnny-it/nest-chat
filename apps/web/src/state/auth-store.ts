import { create } from 'zustand';
import type { AuthResponse, UserDto } from '@nestchat/contracts';

interface AuthState {
  accessToken: string | null;
  user: UserDto | null;
  setAuth: (auth: AuthResponse) => void;
  setUser: (user: UserDto) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (auth) => set({ accessToken: auth.accessToken, user: auth.user }),
  setUser: (user) => set({ user }),
  clear: () => set({ accessToken: null, user: null }),
}));
