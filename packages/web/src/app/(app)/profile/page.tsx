'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const challenges = useQuery({
    queryKey: ['challenges'],
    queryFn: () => apiClient.getChallenges(),
  });

  const xp = challenges.data?.xp ?? 0;
  const list = challenges.data?.challenges ?? [];
  const completed = list.filter((c) => c.completed).length;

  // RGPD Article 17: wipe the account and everything tied to it, then log out.
  async function handleDelete() {
    if (
      !window.confirm(
        'This permanently deletes your account and all your data. This cannot be undone. Continue?',
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await apiClient.deleteAccount();
      await logout();
    } catch {
      setDeleting(false);
      setError('Could not delete your account. Please try again.');
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      <div className="flex items-center gap-3 rounded-card border border-border bg-surface-card p-5">
        <span aria-hidden className="text-3xl">
          ⭐
        </span>
        <div>
          <p className="text-2xl font-bold leading-none">{xp} XP</p>
          <p className="text-xs text-slate-500">
            {completed} / {list.length} challenges done
          </p>
        </div>
        <Link href="/home" className="ml-auto text-sm font-medium text-brand hover:underline">
          View challenges
        </Link>
      </div>

      {user ? (
        <div className="rounded-card border border-border bg-surface-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</p>
          <p className="font-semibold">{user.email}</p>
          {user.name ? <p className="text-sm text-slate-500">{user.name}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Log out
        </button>

        <div className="rounded-card border border-coral/40 bg-surface-card p-5">
          <h2 className="font-semibold">Delete account</h2>
          <p className="mt-1 text-sm text-slate-600">
            Permanently removes your account and all your data (RGPD Article 17).
          </p>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-expiry-expired">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="mt-3 rounded-md bg-coral px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </div>
    </section>
  );
}
