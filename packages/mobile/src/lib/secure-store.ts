import * as SecureStore from 'expo-secure-store';

// we only save the refresh token here, the access token just stays in memory
// SecureStore puts it in the phone's keychain so it's not stored as plain text
const REFRESH_TOKEN_KEY = 'pantryai.refreshToken';

export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function storeRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function deleteStoredRefreshToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // nothing to delete or the store isn't working, just ignore it
  }
}
