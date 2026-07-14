import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../../theme';
import { PrimaryButton } from '../PrimaryButton';
import { ConfettiBurst } from './ConfettiBurst';
import { MascotEntrance } from './MascotEntrance';
import { GlassCard } from './GlassCard';

interface DoneStepProps {
  onFinish: () => void;
  loading?: boolean;
}

// The finale: confetti, a very happy Trashy, and the door into the app.
export function DoneStep({ onFinish, loading = false }: DoneStepProps) {
  const { t } = useTranslation();

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <GlassCard style={styles.card}>
          <MascotEntrance mood="EXCELLENT" size={180} />
          <Text style={styles.title}>{t('onboarding.done.title')}</Text>
          <Text style={styles.body}>{t('onboarding.done.body')}</Text>
        </GlassCard>
      </View>
      <View style={styles.footer}>
        <PrimaryButton label={t('onboarding.done.cta')} onPress={onFinish} loading={loading} glow />
      </View>
      <ConfettiBurst />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  card: { alignItems: 'center', gap: spacing.md },
  title: {
    fontSize: 26,
    fontFamily: font.black,
    color: colors.forestGreen,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    fontFamily: font.regular,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
});
