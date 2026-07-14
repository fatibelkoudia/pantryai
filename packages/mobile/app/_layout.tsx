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
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { syncPushRegistrationIfGranted } from '../src/lib/push';
import { LocaleSync } from '../src/components/LocaleSync';
import { useAuthStore } from '../src/store/auth';
import { colors } from '../src/theme';
// side-effect import: sets up the i18next instance before anything renders
import '../src/lib/i18n';

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();

  // recover a session from the persisted refresh token (runs once)
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // once we know the user is logged in, re-register this device for push alerts,
  // but only if they already granted permission. New users grant it from the
  // onboarding notifications step, so nobody gets prompted on launch.
  useEffect(() => {
    if (status === 'authed') {
      void syncPushRegistrationIfGranted();
    }
  }, [status]);

  // Three-way routing. We wait for navState.key so we don't navigate before the
  // navigator is ready. A user we couldn't load (getMe failed) counts as onboarded
  // so a network blip never traps them on the welcome flow.
  useEffect(() => {
    if (status === 'loading' || !navState?.key) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const needsOnboarding = user != null && user.onboardingCompletedAt == null;

    if (status === 'anon' && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (status === 'authed' && needsOnboarding && !inOnboarding) {
      router.replace('/onboarding');
    } else if (status === 'authed' && !needsOnboarding && (inAuthGroup || inOnboarding)) {
      router.replace('/(tabs)');
    }
  }, [status, user, segments, router, navState?.key]);

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
  const { t } = useTranslation();
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
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="add-stock"
            options={{ title: t('stackTitles.addToStock'), presentation: 'modal' }}
          />
          <Stack.Screen
            name="manual-entry"
            options={{ title: t('stackTitles.addManually'), presentation: 'modal' }}
          />
          <Stack.Screen
            name="scan-result"
            options={{ title: t('stackTitles.receiptResult'), presentation: 'modal' }}
          />
          <Stack.Screen name="scan" options={{ title: t('stackTitles.scan') }} />
          <Stack.Screen name="profile" options={{ title: t('stackTitles.profile') }} />
          <Stack.Screen name="expiring" options={{ title: t('stackTitles.expiringSoon') }} />
          <Stack.Screen name="mood" options={{ title: t('stackTitles.trashyMood') }} />
          <Stack.Screen name="rewards" options={{ title: t('stackTitles.rewards') }} />
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
