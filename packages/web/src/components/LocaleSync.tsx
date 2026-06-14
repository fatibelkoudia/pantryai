'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { i18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth-context';

// Fetches the signed-in user's settings once and switches the UI to their
// saved language. Renders nothing, it just has to live under the providers.
export function LocaleSync() {
  const { status } = useAuth();

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
    enabled: status === 'authed',
  });

  const locale = settings.data?.locale;

  useEffect(() => {
    if (locale && i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [locale]);

  return null;
}
