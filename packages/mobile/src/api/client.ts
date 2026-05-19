import { PantryApiClient } from '@pantryai/shared';

// Set EXPO_PUBLIC_API_URL in packages/mobile/.env
// Physical device / Expo Go: use your machine's LAN IP, e.g. http://192.168.1.42:3001
// Android emulator: http://10.0.2.2:3001
// iOS simulator: http://localhost:3001
const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export const apiClient = new PantryApiClient(API_BASE_URL);
