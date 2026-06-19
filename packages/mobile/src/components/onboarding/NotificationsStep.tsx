import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { requestPushPermissionsAndRegister } from '../../lib/push';
import { colors, font, spacing } from '../../theme';
import { PrimaryButton } from '../PrimaryButton';
import { TrashyMood } from '../TrashyMood';

interface StepProps {
  stepIndex: number;
  totalSteps: number;
  onAdvance: () => void;
}

// The friendly pre-permission screen. The OS prompt only fires when the user taps
// "Enable", after they've read why. "Maybe later" never prompts.
export function NotificationsStep({ stepIndex, totalSteps, onAdvance }: StepProps) {
  const { t } = useTranslation();
  const [working, setWorking] = useState(false);
  const [denied, setDenied] = useState(false);

  async function enable() {
    setWorking(true);
    const granted = await requestPushPermissionsAndRegister();
    setWorking(false);
    if (granted) {
      onAdvance();
    } else {
      // Let them read that they can still turn it on later, then move on.
      setDenied(true);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.progress}>
          {t('onboarding.stepOf', { step: stepIndex + 1, total: totalSteps })}
        </Text>
        <View style={styles.hero}>
          <TrashyMood mood="GOOD" size={160} showLabel={false} />
          <Text style={styles.title}>{t('onboarding.notifications.title')}</Text>
          <Text style={styles.body}>{t('onboarding.notifications.body')}</Text>
          {denied ? (
            <Text style={styles.denied}>{t('onboarding.notifications.denied')}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label={denied ? t('onboarding.finish') : t('onboarding.notifications.enable')}
          onPress={denied ? onAdvance : enable}
          loading={working}
        />
        {denied ? null : (
          <PrimaryButton
            label={t('onboarding.notifications.later')}
            onPress={onAdvance}
            variant="ghost"
            disabled={working}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: spacing.lg },
  progress: {
    fontSize: 13,
    fontFamily: font.bold,
    color: colors.leafGreen,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
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
  denied: {
    fontSize: 14,
    fontFamily: font.semibold,
    color: colors.amberText,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
});
