'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ApiClientError,
  avatarPresets,
  getAvatarPreset,
  LOCALE_FLAGS,
  SETTINGS_LIMITS,
  SUPPORTED_LOCALES,
} from '@pantryai/shared';
import type { StockLocation, UpdateUserSettingsDto } from '@pantryai/shared';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const inputClass = 'rounded-md border border-border px-3 py-2';
const LOCATIONS: StockLocation[] = ['FRIDGE', 'FREEZER', 'PANTRY'];

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const challenges = useQuery({
    queryKey: ['challenges'],
    queryFn: () => apiClient.getChallenges(),
  });

  const xp = challenges.data?.xp ?? 0;
  const list = challenges.data?.challenges ?? [];
  const completed = list.filter((c) => c.completed).length;

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('profile.title')}</h1>

      <ProfileCard />
      <LanguageCard />

      <div className="flex items-center gap-3 rounded-card border border-border bg-surface-card p-5">
        <span aria-hidden className="text-3xl">
          ⭐
        </span>
        <div>
          <p className="text-2xl font-bold leading-none">{t('profile.xp', { count: xp })}</p>
          <p className="text-xs text-slate-500">
            {t('profile.challengesDone', { done: completed, total: list.length })}
          </p>
        </div>
        <Link href="/home" className="ml-auto text-sm font-medium text-brand hover:underline">
          {t('profile.viewChallenges')}
        </Link>
      </div>

      <SettingsCard />
      <ChangePasswordCard />
      {user ? <DangerZone /> : null}
    </section>
  );
}

// Avatar + name + email, with a small inline edit mode.
function ProfileCard() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const avatar = getAvatarPreset(editing ? avatarId : (user?.avatarId ?? null));

  const save = useMutation({
    mutationFn: () =>
      apiClient.updateProfile({
        name,
        email,
        ...(avatarId ? { avatarId } : {}),
      }),
    onSuccess: async () => {
      await refreshUser();
      setEditing(false);
      setError(null);
    },
    onError: (err) => {
      // 409 is the "email already used" case, anything else gets the generic message
      setError(
        err instanceof ApiClientError && err.status === 409
          ? t('profile.emailTaken')
          : t('common.error'),
      );
    },
  });

  function startEditing() {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setAvatarId(user?.avatarId ?? null);
    setError(null);
    setEditing(true);
  }

  if (!user) return null;

  return (
    <div className="rounded-card border border-border bg-surface-card p-5">
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
          style={{ backgroundColor: avatar.bg }}
        >
          {avatar.emoji}
        </span>
        {editing ? null : (
          <div>
            <p className="font-semibold">{user.name ?? user.email}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        )}
        {editing ? null : (
          <button
            type="button"
            onClick={startEditing}
            className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            {t('common.edit')}
          </button>
        )}
      </div>

      {editing ? (
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t('profile.chooseAvatar')}</span>
            <div className="flex flex-wrap gap-2">
              {avatarPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAvatarId(preset.id)}
                  aria-pressed={avatarId === preset.id}
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
                    avatarId === preset.id ? 'ring-2 ring-brand' : ''
                  }`}
                  style={{ backgroundColor: preset.bg }}
                >
                  {preset.emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="profile-name" className="text-sm font-medium">
              {t('profile.name')}
            </label>
            <input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('profile.namePlaceholder')}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="profile-email" className="text-sm font-medium">
              {t('profile.email')}
            </label>
            <input
              id="profile-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-expiry-expired">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-60"
            >
              {save.isPending ? t('common.saving') : t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

// The language sits in its own card, above the other settings, because it's the
// one people reach for most. Tapping a flag saves right away, no Save button.
function LanguageCard() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
  });

  const save = useMutation({
    mutationFn: (locale: (typeof SUPPORTED_LOCALES)[number]) =>
      apiClient.updateSettings({ locale }),
    onSuccess: async (data) => {
      // switch the UI right away instead of waiting for the refetch
      await i18n.changeLanguage(data.locale);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  if (!settings.data) return null;
  const current = settings.data.locale;

  return (
    <div className="rounded-card border border-border bg-surface-card p-5">
      <h2 className="font-semibold">{t('settings.language')}</h2>
      <div className="mt-3 flex gap-2">
        {SUPPORTED_LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            onClick={() => save.mutate(locale)}
            disabled={save.isPending}
            aria-pressed={current === locale}
            className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60 ${
              current === locale ? 'border-brand bg-mint' : 'border-border hover:bg-slate-50'
            }`}
          >
            <span aria-hidden className="text-xl">
              {LOCALE_FLAGS[locale]}
            </span>
            {t(`settings.languages.${locale}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

// All the knobs. Values live in local state while editing and are pushed with
// one save so we don't fire a request per keystroke.
function SettingsCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<UpdateUserSettingsDto>({});
  const [saved, setSaved] = useState(false);

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
  });

  // reset the draft whenever fresh settings come in
  useEffect(() => {
    if (settings.data) {
      setDraft({
        recipeMinMatchedItems: settings.data.recipeMinMatchedItems,
        recipeMatchThreshold: settings.data.recipeMatchThreshold,
        expiringSoonDays: settings.data.expiringSoonDays,
        lowStockThreshold: settings.data.lowStockThreshold,
        defaultStockLocation: settings.data.defaultStockLocation,
      });
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => apiClient.updateSettings(draft),
    onSuccess: async () => {
      setSaved(true);
      // thresholds change what recipes/shopping/stock queries return, so drop everything
      await queryClient.invalidateQueries();
    },
  });

  // the draft is dirty when any knob differs from what the server has
  const dirty =
    settings.data != null &&
    (draft.recipeMinMatchedItems !== settings.data.recipeMinMatchedItems ||
      draft.recipeMatchThreshold !== settings.data.recipeMatchThreshold ||
      draft.expiringSoonDays !== settings.data.expiringSoonDays ||
      draft.lowStockThreshold !== settings.data.lowStockThreshold ||
      draft.defaultStockLocation !== settings.data.defaultStockLocation);

  // closing or reloading the tab with unsaved changes: the browser asks first
  useEffect(() => {
    if (!dirty) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // in-app navigation (navbar links) with unsaved changes: ask before following
  // the link. Next.js has no official route blocker in the App Router, so we
  // catch the click on the anchor itself, in the capture phase, before Next does.
  useEffect(() => {
    if (!dirty) return;
    function onClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor || anchor.target === '_blank') return;
      if (!window.confirm(t('settings.unsavedBody'))) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty, t]);

  if (!settings.data) return null;

  const thresholdPercent = Math.round((draft.recipeMatchThreshold ?? 0.7) * 100);

  function patch(changes: UpdateUserSettingsDto) {
    setSaved(false);
    setDraft((prev) => ({ ...prev, ...changes }));
  }

  return (
    <div className="rounded-card border border-border bg-surface-card p-5">
      <h2 className="font-semibold">{t('settings.title')}</h2>
      <div className="mt-4 flex flex-col gap-5">
        <NumberSetting
          id="settings-min-items"
          label={t('settings.recipeMinMatchedItems')}
          hint={t('settings.recipeMinMatchedItemsHint')}
          value={draft.recipeMinMatchedItems ?? 1}
          min={SETTINGS_LIMITS.recipeMinMatchedItems.min}
          max={SETTINGS_LIMITS.recipeMinMatchedItems.max}
          onChange={(value) => patch({ recipeMinMatchedItems: value })}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="settings-threshold" className="text-sm font-medium">
            {t('settings.recipeMatchThreshold')} — {thresholdPercent}%
          </label>
          <input
            id="settings-threshold"
            type="range"
            min={SETTINGS_LIMITS.recipeMatchThreshold.min * 100}
            max={SETTINGS_LIMITS.recipeMatchThreshold.max * 100}
            step={5}
            value={thresholdPercent}
            onChange={(e) => patch({ recipeMatchThreshold: Number(e.target.value) / 100 })}
          />
          <p className="text-xs text-slate-500">{t('settings.recipeMatchThresholdHint')}</p>
        </div>

        <NumberSetting
          id="settings-expiring-days"
          label={t('settings.expiringSoonDays')}
          hint={t('settings.expiringSoonDaysHint')}
          value={draft.expiringSoonDays ?? 3}
          min={SETTINGS_LIMITS.expiringSoonDays.min}
          max={SETTINGS_LIMITS.expiringSoonDays.max}
          onChange={(value) => patch({ expiringSoonDays: value })}
        />

        <NumberSetting
          id="settings-low-stock"
          label={t('settings.lowStockThreshold')}
          hint={t('settings.lowStockThresholdHint')}
          value={draft.lowStockThreshold ?? 1}
          min={SETTINGS_LIMITS.lowStockThreshold.min}
          max={SETTINGS_LIMITS.lowStockThreshold.max}
          onChange={(value) => patch({ lowStockThreshold: value })}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="settings-location" className="text-sm font-medium">
            {t('settings.defaultStockLocation')}
          </label>
          <select
            id="settings-location"
            value={draft.defaultStockLocation ?? 'PANTRY'}
            onChange={(e) => patch({ defaultStockLocation: e.target.value as StockLocation })}
            className={inputClass}
          >
            {LOCATIONS.map((location) => (
              <option key={location} value={location}>
                {t(`settings.locations.${location}`)}
              </option>
            ))}
          </select>
        </div>

        {save.isError ? (
          <p role="alert" className="text-sm text-expiry-expired">
            {t('common.error')}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="self-start rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-60"
          >
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
          {dirty ? (
            <p className="text-sm font-medium text-expiry-soon">{t('settings.unsavedHint')}</p>
          ) : saved ? (
            <p className="text-sm text-slate-500">{t('common.saved')}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NumberSetting({
  id,
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (!Number.isNaN(parsed)) {
            onChange(Math.min(max, Math.max(min, Math.round(parsed))));
          }
        }}
        className={`${inputClass} w-24`}
      />
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function ChangePasswordCard() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const change = useMutation({
    mutationFn: () => apiClient.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setMessage({ kind: 'ok', text: t('password.success') });
    },
    onError: (err) => {
      setMessage({
        kind: 'error',
        text:
          err instanceof ApiClientError && err.status === 401
            ? t('password.wrongCurrent')
            : t('common.error'),
      });
    },
  });

  return (
    <div className="rounded-card border border-border bg-surface-card p-5">
      <h2 className="font-semibold">{t('password.title')}</h2>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (newPassword.length < 8) {
            setMessage({ kind: 'error', text: t('password.tooShort') });
            return;
          }
          change.mutate();
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="current-password" className="text-sm font-medium">
            {t('password.current')}
          </label>
          <input
            id="current-password"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="new-password" className="text-sm font-medium">
            {t('password.new')}
          </label>
          <input
            id="new-password"
            type="password"
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        {message ? (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`text-sm ${message.kind === 'error' ? 'text-expiry-expired' : 'text-slate-500'}`}
          >
            {message.text}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={change.isPending}
          className="self-start rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-60"
        >
          {change.isPending ? t('common.saving') : t('password.submit')}
        </button>
      </form>
    </div>
  );
}

// Log out + RGPD Article 17 deletion, same behaviour as before the redesign.
function DangerZone() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(t('deleteAccount.confirmBody'))) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await apiClient.deleteAccount();
      await logout();
    } catch {
      setDeleting(false);
      setError(t('deleteAccount.failed'));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => void logout()}
        className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-slate-50"
      >
        {t('profile.logout')}
      </button>

      <div className="rounded-card border border-coral/40 bg-surface-card p-5">
        <h2 className="font-semibold">{t('deleteAccount.title')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('deleteAccount.hint')}</p>
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
          {deleting ? t('deleteAccount.deleting') : t('deleteAccount.confirm')}
        </button>
      </div>
    </div>
  );
}
