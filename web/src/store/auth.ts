import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'ADMIN' | 'DISPATCHER' | 'DRIVER';

interface User {
  id: string;
  nickname: string;
  role: Role;
  locale: string;
  available?: boolean;
  email?: string;
  phone?: string;
  driverId?: string;
  carType?: string;
  carPlateNumber?: string;
  carCapacity?: number;
  carModelAndYear?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setAuth: (accessToken: string, refreshToken: string, user: User) => void;
  setUser: (user: User | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (accessToken, refreshToken, user) => {
        localStorage.setItem('relaxdrive-access-token', accessToken);
        localStorage.setItem('relaxdrive-refresh-token', refreshToken);
        set({ accessToken, refreshToken, user });
      },
      setUser: (user) => set({ user }),
      clearAuth: () => {
        localStorage.removeItem('relaxdrive-access-token');
        localStorage.removeItem('relaxdrive-refresh-token');
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    {
      name: 'relaxdrive-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) localStorage.setItem('relaxdrive-access-token', state.accessToken);
        if (state?.refreshToken) localStorage.setItem('relaxdrive-refresh-token', state.refreshToken);
      },
    },
  ),
);
