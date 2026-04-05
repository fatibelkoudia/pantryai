import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Session route — keeps the refresh token in an HttpOnly cookie (never exposed to JS).
 * The access token lives only in browser memory (AuthProvider).
 *
 *  POST   { refreshToken }  → store the refresh token in the cookie (after login/register)
 *  GET                      → exchange the cookie for a fresh access token via the API
 *  DELETE                   → clear the cookie (logout)
 */

const COOKIE_NAME = 'pantry_rt';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days, matching the API refresh token TTL

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE,
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const { refreshToken } = (await request.json()) as { refreshToken?: string };
  if (!refreshToken) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Missing refreshToken' } },
      { status: 400 },
    );
  }
  const store = await cookies();
  store.set(COOKIE_NAME, refreshToken, cookieOptions());
  return NextResponse.json({ success: true });
}

export async function GET(): Promise<NextResponse> {
  const store = await cookies();
  const refreshToken = store.get(COOKIE_NAME)?.value;
  if (!refreshToken) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'No session' } },
      { status: 401 },
    );
  }

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: { accessToken: string };
  } | null;

  if (!res.ok || !body?.success || !body.data) {
    // Stale/invalid refresh token — clear it so the client falls back to login.
    store.delete(COOKIE_NAME);
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired' } },
      { status: 401 },
    );
  }

  return NextResponse.json({ success: true, data: { accessToken: body.data.accessToken } });
}

export async function DELETE(): Promise<NextResponse> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  return NextResponse.json({ success: true });
}
