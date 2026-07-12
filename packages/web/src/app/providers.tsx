'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth-context';
import { makeQueryClient } from '@/lib/query-client';
import { LocaleSync } from '@/components/LocaleSync';
// side-effect import: sets up the i18next instance before anything renders
import '@/lib/i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocaleSync />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
