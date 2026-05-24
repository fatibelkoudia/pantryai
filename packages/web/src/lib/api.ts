import { PantryApiClient } from '@pantryai/shared';

/** Public API base URL, exposed to the browser. Defaults to the local API. */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Singleton client shared across the app. The access token is set by the AuthProvider. */
export const apiClient = new PantryApiClient(API_BASE_URL);
