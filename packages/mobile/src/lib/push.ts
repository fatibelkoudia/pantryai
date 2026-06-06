import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

// Ask for notification permission, grab the device's Expo push token, and send it
// to the API so the daily expiration job can reach this device. This is all best-effort:
// on a simulator, when permission is denied, or without an EAS project set up, getting
// the token can fail, so we just log it and move on instead of crashing the app on boot.
// expo-notifications is imported dynamically because it crashes at module load time in Expo Go SDK 53+.
export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) {
    return;
  }

  try {
    const Notifications = await import('expo-notifications');

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) return;

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
    if (!expoPushToken) return;

    await apiClient.registerDevice({
      expoPushToken,
      platform: Platform.OS === 'android' ? 'android' : 'ios',
    });
  } catch (error) {
    console.warn('Push registration skipped:', error);
  }
}
