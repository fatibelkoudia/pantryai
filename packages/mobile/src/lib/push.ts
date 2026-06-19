import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

// Grab the device's Expo push token and send it to the API so the daily expiration
// job can reach this device. Best-effort: on a simulator or without an EAS project
// this can fail, so we log and move on instead of crashing.
// expo-notifications is imported dynamically because it crashes at module load time in Expo Go SDK 53+.
async function registerToken(): Promise<void> {
  const Notifications = await import('expo-notifications');
  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
  if (!expoPushToken) return;
  await apiClient.registerDevice({
    expoPushToken,
    platform: Platform.OS === 'android' ? 'android' : 'ios',
  });
}

// Runs on every boot once the user is logged in. It only re-registers the token
// when permission was already granted, so it never shows a prompt on launch. New
// users grant permission from the onboarding step below instead.
export async function syncPushRegistrationIfGranted(): Promise<void> {
  if (!Device.isDevice) return;
  try {
    const Notifications = await import('expo-notifications');
    const existing = await Notifications.getPermissionsAsync();
    if (!existing.granted) return;
    await registerToken();
  } catch (error) {
    console.warn('Push sync skipped:', error);
  }
}

// Called from the onboarding notifications step, where we ask for permission on
// purpose with a screen explaining why first. Returns whether it ended up granted.
export async function requestPushPermissionsAndRegister(): Promise<boolean> {
  if (!Device.isDevice) return false;
  try {
    const Notifications = await import('expo-notifications');
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) return false;
    await registerToken();
    return true;
  } catch (error) {
    console.warn('Push registration skipped:', error);
    return false;
  }
}
