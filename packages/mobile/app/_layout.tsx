import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add-stock" options={{ title: 'Add to Stock', presentation: 'modal' }} />
        <Stack.Screen
          name="scan-result"
          options={{ title: 'Receipt Result', presentation: 'modal' }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
