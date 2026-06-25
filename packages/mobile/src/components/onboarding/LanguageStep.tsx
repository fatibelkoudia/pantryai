import { LOCALE_FLAGS, SUPPORTED_LOCALES } from '@pantryai/shared';
import type { Locale } from '@pantryai/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiClient } from '../../api/client';
import { colors, font, glass, glow, radii, spacing } from '../../theme';
import { StepScaffold } from './StepScaffold';

interface StepProps {
  stepIndex: number;
  totalSteps: number;
  onAdvance: () => void;
}

// Pick a language. Tapping a card switches the UI right away so the rest of the
// onboarding shows in that language; Continue saves it to the server.
export function LanguageStep({ stepIndex, totalSteps, onAdvance }: StepProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Locale>(
    (SUPPORTED_LOCALES as readonly string[]).includes(i18n.language)
      ? (i18n.language as Locale)
      : 'en',
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => apiClient.updateSettings({ locale: selected }),
    onSuccess: (data) => {
      // Seed the settings cache so LocaleSync can't flip the language back to the
      // value it fetched at login.
      queryClient.setQueryData(['settings'], data);
      onAdvance();
    },
    onError: () => setError(t('onboarding.saveFailed')),
  });

  function pick(locale: Locale) {
    void Haptics.selectionAsync();
    setSelected(locale);
    void i18n.changeLanguage(locale);
  }

  return (
    <StepScaffold
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      title={t('onboarding.language.title')}
      subtitle={t('onboarding.language.subtitle')}
      continueLabel={t('onboarding.continue')}
      onContinue={() => {
        setError(null);
        save.mutate();
      }}
      onSkip={onAdvance}
      loading={save.isPending}
      error={error}
    >
      <View style={styles.cards}>
        {SUPPORTED_LOCALES.map((locale) => (
          <TouchableOpacity
            key={locale}
            onPress={() => pick(locale)}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === locale }}
            style={[styles.card, selected === locale && styles.cardSelected]}
          >
            <Text style={styles.flag}>{LOCALE_FLAGS[locale]}</Text>
            <Text style={styles.label}>{t(`settings.languages.${locale}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  cards: { flexDirection: 'row', gap: spacing.md },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    backgroundColor: glass.bg,
  },
  cardSelected: {
    borderColor: colors.leafGreen,
    backgroundColor: colors.softMint,
    boxShadow: `0 0 24px ${glow.brand}`,
  },
  flag: { fontSize: 40 },
  label: { fontSize: 15, fontFamily: font.bold, color: colors.charcoal },
});
