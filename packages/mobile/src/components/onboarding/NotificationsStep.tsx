import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { requestPushPermissionsAndRegister } from '../../lib/push';
import { colors, font, spacing } from '../../theme';
import { PrimaryButton } from '../PrimaryButton';
import { MascotEntrance } from './MascotEntrance';
import { GlassCard } from './GlassCard';
import { StepProgress } from './StepProgress';

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
        <StepProgress stepIndex={stepIndex} totalSteps={totalSteps} />
        <View style={styles.heroWrap}>
          <GlassCard style={styles.hero}>
            <MascotEntrance mood="GOOD" size={150} />
            <Text style={styles.title}>{t('onboarding.notifications.title')}</Text>
            <Text style={styles.body}>{t('onboarding.notifications.body')}</Text>
            {denied ? (
              <Text style={styles.denied}>{t('onboarding.notifications.denied')}</Text>
            ) : null}
          </GlassCard>
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label={denied ? t('onboarding.finish') : t('onboarding.notifications.enable')}
          onPress={denied ? onAdvance : enable}
          loading={working}
          glow
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
  content: { flex: 1, padding: spacing.lg, gap: spacing.md },
  heroWrap: { flex: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: spacing.md },
  title: {
    fontSize: 24,
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
