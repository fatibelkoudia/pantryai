'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@pantryai/shared';
import type { LoginDto, RegisterDto, User } from '@pantryai/shared';
import { apiClient } from './api';

type AuthStatus = 'loading' | 'authed' | 'anon';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (dto: LoginDto) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistRefreshToken(refreshToken: string): Promise<void> {
  await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
}

/** Exchange the HttpOnly refresh cookie for a fresh access token. Returns true on success. */
async function fetchAccessToken(): Promise<string | null> {
  const res = await fetch('/api/session', { method: 'GET' });
  if (!res.ok) {
    return null;
  }
  const body = (await res.json().catch(() => null)) as { data?: { accessToken: string } } | null;
  return body?.data?.accessToken ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const lastRefreshRef = useRef(0);
  const refreshingRef = useRef(false);

  const clearSession = useCallback(async () => {
    apiClient.setAccessToken(null);
    setUser(null);
    setStatus('anon');
    queryClient.clear();
    await fetch('/api/session', { method: 'DELETE' });
  }, [queryClient]);

  const logout = useCallback(async () => {
    await clearSession();
    router.push('/login');
  }, [clearSession, router]);

  // Cold-start rehydrate: try to recover an access token from the refresh cookie.
  useEffect(() => {
    let active = true;
    void (async () => {
      const token = await fetchAccessToken();
      if (!active) return;
      if (token) {
        apiClient.setAccessToken(token);
        lastRefreshRef.current = Date.now();
        // The refresh cookie only gives us a token back, not the user, so go fetch it
        // so the greeting and profile aren't blank after a page reload.
        const me = await apiClient.getMe().catch(() => null);
        if (!active) return;
        if (me) setUser(me);
        setStatus('authed');
      } else {
        setStatus('anon');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Single 401 → refresh → retry: watch the query cache for auth failures.
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      const error = event.query.state.error;
      if (!(error instanceof ApiClientError) || error.status !== 401) return;
      if (status !== 'authed' || refreshingRef.current) return;
      // Cooldown stops an infinite refresh loop if the new token still 401s.
      if (Date.now() - lastRefreshRef.current < 3_000) return;

      refreshingRef.current = true;
      void (async () => {
        try {
          const token = await fetchAccessToken();
          if (token) {
            apiClient.setAccessToken(token);
            lastRefreshRef.current = Date.now();
            await queryClient.invalidateQueries();
          } else {
            await logout();
          }
        } finally {
          refreshingRef.current = false;
        }
      })();
    });
    return unsubscribe;
  }, [queryClient, status, logout]);

  const login = useCallback(
    async (dto: LoginDto) => {
      const res = await apiClient.login(dto);
      apiClient.setAccessToken(res.accessToken);
      await persistRefreshToken(res.refreshToken);
      lastRefreshRef.current = Date.now();
      setUser(res.user);
      setStatus('authed');
      router.push('/home');
    },
    [router],
  );

  // Re-fetch the signed-in user, e.g. right after the profile page saved a change,
  // so the navbar and greetings show the new name/avatar without a reload.
  const refreshUser = useCallback(async () => {
    const me = await apiClient.getMe().catch(() => null);
    if (me) setUser(me);
  }, []);

  const register = useCallback(
    async (dto: RegisterDto) => {
      const res = await apiClient.register(dto);
      apiClient.setAccessToken(res.accessToken);
      await persistRefreshToken(res.refreshToken);
      lastRefreshRef.current = Date.now();
      setUser(res.user);
      setStatus('authed');
      router.push('/home');
    },
    [router],
  );

  return (
    <AuthContext.Provider value={{ status, user, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
