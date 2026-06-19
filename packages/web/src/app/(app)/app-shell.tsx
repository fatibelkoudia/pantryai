'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/lib/auth-context';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anon') {
      router.replace('/login');
    } else if (status === 'authed' && user && !user.onboardingCompletedAt) {
      // a new account that lands here (e.g. reload mid-flow) is sent to finish onboarding
      router.replace('/welcome');
    }
  }, [status, user, router]);

  if (status !== 'authed') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status" className="text-slate-500">
          Loading…
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
