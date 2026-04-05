'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiClientError } from '@pantryai/shared';
import type { RegisterDto } from '@pantryai/shared';
import { useAuth } from '@/lib/auth-context';

export default function RegisterPage() {
  const { register, status } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
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
      const dto: RegisterDto = { email, password };
      if (name.trim()) dto.name = name.trim();
      await register(dto);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Registration failed');
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="mb-4 text-xl font-bold">Create your PantryAI account</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium">
            Name <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-border px-3 py-2"
          />
        </div>
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
            autoComplete="new-password"
            required
            minLength={8}
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
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
