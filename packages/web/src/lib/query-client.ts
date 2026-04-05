import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@pantryai/shared';

/** Build a QueryClient. A 401 is handled globally by the AuthProvider, never retried here. */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiClientError && error.status === 401) {
            return false;
          }
          return failureCount < 2;
        },
      },
    },
  });
}
