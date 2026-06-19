'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ApiClientError } from '@pantryai/shared';
import type { RegisterDto } from '@pantryai/shared';
import { useAuth } from '@/lib/auth-context';
import { PasswordField } from '@/components/PasswordField';

export default function RegisterPage() {
  const { t } = useTranslation();
  const { register, status, user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authed') {
      router.replace(user?.onboardingCompletedAt ? '/home' : '/welcome');
    }
  }, [status, user, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const dto: RegisterDto = { email, password };
      if (name.trim()) dto.name = name.trim();
      await register(dto);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t('auth.registerFailed'));
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-extrabold text-brand-deep">{t('auth.registerTitle')}</h1>
      <p className="mb-5 text-sm text-expiry-none">{t('auth.registerSubtitle')}</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-bold">
            {t('auth.name')}
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-border bg-surface-input px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-bold">
            {t('auth.email')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-border bg-surface-input px-3 py-2"
          />
        </div>
        <PasswordField
          id="password"
          label={t('auth.password')}
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={setPassword}
        />
        {error ? (
          <p
            role="alert"
            className="rounded-md bg-expiry-urgent-bg px-3 py-2 text-sm font-semibold text-expiry-urgent"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-deep px-4 py-2.5 font-bold text-brand-fg shadow-btn-lip disabled:opacity-60"
        >
          {submitting ? t('auth.creating') : t('auth.registerCta')}
        </button>
      </form>
      <p className="mt-4 text-sm text-expiry-none">
        {t('auth.haveAccount')}{' '}
        <Link href="/login" className="font-bold text-brand-deep hover:underline">
          {t('auth.logIn')}
        </Link>
      </p>
    </>
  );
}
