import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiClient } from '../api/client';
import { i18n } from '../lib/i18n';
import { useAuthStore } from '../store/auth';

// Fetches the signed-in user's settings once and switches the UI to their
// saved language. Renders nothing, it just has to live under the providers.
export function LocaleSync() {
  const status = useAuthStore((s) => s.status);

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
