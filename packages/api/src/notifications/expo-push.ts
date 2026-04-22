// Small helper to send push messages through Expo. Expo only takes up to 100
// messages per request, so we send them in batches of 100.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_BATCH = 100;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  for (let i = 0; i < messages.length; i += MAX_BATCH) {
    const batch = messages.slice(i, i + MAX_BATCH);
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(batch),
    });
  }
}
