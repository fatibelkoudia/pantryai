'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiClientError } from '@pantryai/shared';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const { login, status } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authed') router.replace('/stocks');
  }, [status, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ email, password });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Login failed');
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="mb-4 text-xl font-bold">Log in to PantryAI</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-border px-3 py-2"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-expiry-expired">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand px-4 py-2 font-medium text-brand-fg disabled:opacity-60"
        >
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        No account?{' '}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
