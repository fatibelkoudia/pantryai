import { ApiClientError } from '@pantryai/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { TextField } from '../../src/components/TextField';
import { TrashyMood } from '../../src/components/TrashyMood';
import { useAuthStore } from '../../src/store/auth';
import { colors, font, radii, spacing } from '../../src/theme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError(t('auth.missingFields'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login({ email: email.trim(), password });
      // once we're logged in the auth gate in _layout routes us onward
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.status === 401
          ? t('auth.badCredentials')
          : err instanceof ApiClientError
            ? err.message
            : t('auth.loginFailed'),
      );
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <TrashyMood mood="EXCELLENT" size={110} showLabel={false} />
          <Text style={styles.title}>{t('auth.loginTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>
        </View>

        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.emailPlaceholder')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          editable={!submitting}
        />

        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          editable={!submitting}
        />

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <PrimaryButton
          label={t('auth.loginCta')}
          onPress={handleSubmit}
          loading={submitting}
          style={styles.submit}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.noAccount')} </Text>
          <Link href="/(auth)/register" style={styles.footerLink}>
            {t('auth.createOne')}
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.warmCream },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  hero: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  title: { fontSize: 28, fontFamily: font.black, color: colors.forestGreen, textAlign: 'center' },
  subtitle: {
    fontSize: 15,
    fontFamily: font.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: colors.redTint,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  errorText: { fontSize: 14, fontFamily: font.semibold, color: colors.redText },
  submit: { marginTop: spacing.xs },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xs },
  footerText: { fontSize: 14, fontFamily: font.regular, color: colors.textMuted },
  footerLink: { fontSize: 14, fontFamily: font.bold, color: colors.forestGreen },
});
