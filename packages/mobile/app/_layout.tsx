import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { registerForPushNotifications } from '../src/lib/push';
import { LocaleSync } from '../src/components/LocaleSync';
import { useAuthStore } from '../src/store/auth';
import { colors } from '../src/theme';
// side-effect import: sets up the i18next instance before anything renders
import '../src/lib/i18n';

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();

  // recover a session from the persisted refresh token (runs once)
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // once we know the user is logged in, register this device for push alerts
  useEffect(() => {
    if (status === 'authed') {
      void registerForPushNotifications();
    }
  }, [status]);

  // send people to the login screen if they're not logged in, or to the tabs if they are
  // we wait for navState.key so we don't try to navigate before the navigator is ready
  useEffect(() => {
    if (status === 'loading' || !navState?.key) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (status === 'anon' && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (status === 'authed' && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [status, segments, router, navState?.key]);

  if (status === 'loading') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.leafGreen} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  // hold render until Nunito is ready so we never flash the system font
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.leafGreen} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <LocaleSync />
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="add-stock"
            options={{ title: 'Add to Stock', presentation: 'modal' }}
          />
          <Stack.Screen
            name="manual-entry"
            options={{ title: 'Add manually', presentation: 'modal' }}
          />
          <Stack.Screen
            name="scan-result"
            options={{ title: 'Receipt Result', presentation: 'modal' }}
          />
          <Stack.Screen name="scan" options={{ title: 'Scan' }} />
          <Stack.Screen name="profile" options={{ title: 'Profile' }} />
          <Stack.Screen name="expiring" options={{ title: 'Expiring soon' }} />
          <Stack.Screen name="mood" options={{ title: "Trashy's Mood" }} />
          <Stack.Screen name="rewards" options={{ title: 'Rewards' }} />
        </Stack>
      </AuthGate>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warmCream,
  },
});
