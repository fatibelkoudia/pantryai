import type { LoginDto, RegisterDto, User } from '@pantryai/shared';
import { create } from 'zustand';
import { apiClient } from '../api/client';
import {
  deleteStoredRefreshToken,
  getStoredRefreshToken,
  storeRefreshToken,
} from '../lib/secure-store';

type AuthStatus = 'loading' | 'authed' | 'anon';

interface AuthStore {
  status: AuthStatus;
  accessToken: string | null;
  user: User | null;
  // keep the token in the store and the api client the same
  setAccessToken: (token: string | null) => void;
  // replace the cached user after a screen already has a fresh copy (onboarding
  // steps do this so the auth gate re-routes without another /auth/me call)
  setUser: (user: User) => void;
  // when the app starts, try to log back in with the saved refresh token
  hydrate: () => Promise<void>;
  login: (dto: LoginDto) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  // re-fetch the user after the profile screen saved a change
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  status: 'loading',
  accessToken: null,
  user: null,

  setAccessToken: (token) => {
    apiClient.setAccessToken(token);
    set({ accessToken: token });
  },

  setUser: (user) => set({ user }),

  hydrate: async () => {
    const refreshToken = await getStoredRefreshToken();
    if (!refreshToken) {
      set({ status: 'anon' });
      return;
    }
    try {
      const { accessToken } = await apiClient.refresh(refreshToken);
      apiClient.setAccessToken(accessToken);
      // grab the user too so the Home greeting and Profile aren't blank on a cold start
      const user = await apiClient.getMe().catch(() => null);
      set({ accessToken, user, status: 'authed' });
    } catch {
      // the refresh token doesn't work anymore, so clear it and go back to login
      await deleteStoredRefreshToken();
      apiClient.setAccessToken(null);
      set({ accessToken: null, user: null, status: 'anon' });
    }
  },

  login: async (dto) => {
    const res = await apiClient.login(dto);
    apiClient.setAccessToken(res.accessToken);
    await storeRefreshToken(res.refreshToken);
    set({ accessToken: res.accessToken, user: res.user, status: 'authed' });
  },

  register: async (dto) => {
    const res = await apiClient.register(dto);
    apiClient.setAccessToken(res.accessToken);
    await storeRefreshToken(res.refreshToken);
    set({ accessToken: res.accessToken, user: res.user, status: 'authed' });
  },

  logout: async () => {
    await deleteStoredRefreshToken();
    apiClient.setAccessToken(null);
    set({ accessToken: null, user: null, status: 'anon' });
  },

  refreshUser: async () => {
    const user = await apiClient.getMe().catch(() => null);
    if (user) set({ user });
  },
}));

// if a request fails with 401 the client calls this to get a new access token and try again
// we set it up here so the shared client doesn't have to know about the store or secure storage
// if we return null nothing gets retried and the user is logged out
apiClient.setRefreshHandler(async () => {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;
  try {
    const { accessToken } = await apiClient.refresh(refreshToken);
    useAuthStore.getState().setAccessToken(accessToken);
    return accessToken;
  } catch {
    await useAuthStore.getState().logout();
    return null;
  }
});
