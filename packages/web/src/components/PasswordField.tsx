'use client';

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  autoComplete?: string;
  minLength?: number;
}

// Password input with a show/hide toggle. We draw the eye inline so we don't pull
// in an icon library for one glyph.
export function PasswordField({
  label,
  value,
  onChange,
  id,
  autoComplete,
  minLength,
}: PasswordFieldProps) {
  const { t } = useTranslation();
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-bold">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-input px-3 py-2 pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-expiry-none"
        >
          <EyeIcon off={visible} />
        </button>
      </div>
    </div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <line x1="3" y1="3" x2="21" y2="21" /> : null}
    </svg>
  );
}
