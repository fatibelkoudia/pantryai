import { SETTINGS_LIMITS } from '@pantryai/shared';
import type { StockLocation } from '@pantryai/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiClient } from '../../api/client';
import { colors, font, radii, spacing } from '../../theme';
import { StepScaffold } from './StepScaffold';

interface StepProps {
  stepIndex: number;
  totalSteps: number;
  onAdvance: () => void;
}

const LOCATIONS: StockLocation[] = ['FRIDGE', 'FREEZER', 'PANTRY'];

// The two pantry settings a new user actually feels: where food usually goes and
// how many days ahead we warn them about expiry.
export function PantryStep({ stepIndex, totalSteps, onAdvance }: StepProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<StockLocation>('PANTRY');
  const [days, setDays] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      apiClient.updateSettings({ defaultStockLocation: location, expiringSoonDays: days }),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      onAdvance();
    },
    onError: () => setError(t('onboarding.saveFailed')),
  });

  const { min, max } = SETTINGS_LIMITS.expiringSoonDays;

  return (
    <StepScaffold
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      title={t('onboarding.pantry.title')}
      subtitle={t('onboarding.pantry.subtitle')}
      continueLabel={t('onboarding.continue')}
      onContinue={() => {
        setError(null);
        save.mutate();
      }}
      onSkip={onAdvance}
      loading={save.isPending}
      error={error}
    >
      <Text style={styles.fieldLabel}>{t('onboarding.pantry.defaultLocation')}</Text>
      <View style={styles.segment}>
        {LOCATIONS.map((loc) => (
          <TouchableOpacity
            key={loc}
            onPress={() => {
              void Haptics.selectionAsync();
              setLocation(loc);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: location === loc }}
            style={[styles.segmentItem, location === loc && styles.segmentItemSelected]}
          >
            <Text style={[styles.segmentLabel, location === loc && styles.segmentLabelSelected]}>
              {t(`settings.locations.${loc}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>{t('onboarding.pantry.expiringWindow')}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => {
            void Haptics.selectionAsync();
            setDays((d) => Math.max(min, d - 1));
          }}
          disabled={days <= min}
          accessibilityRole="button"
          accessibilityLabel={`${t('onboarding.pantry.expiringWindow')} -`}
        >
          <Text style={styles.stepperBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{t('settings.daysUnit', { count: days })}</Text>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => {
            void Haptics.selectionAsync();
            setDays((d) => Math.min(max, d + 1));
          }}
          disabled={days >= max}
          accessibilityRole="button"
          accessibilityLabel={`${t('onboarding.pantry.expiringWindow')} +`}
        >
          <Text style={styles.stepperBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 14, fontFamily: font.bold, color: colors.charcoal },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: radii.card,
    padding: spacing.xs,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
  },
  segmentItemSelected: { backgroundColor: colors.softMint },
  segmentLabel: { fontSize: 14, fontFamily: font.semibold, color: colors.textMuted },
  segmentLabelSelected: { color: colors.forestGreen, fontFamily: font.bold },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { fontSize: 20, fontFamily: font.bold, color: colors.charcoal },
  stepperValue: {
    fontSize: 16,
    fontFamily: font.bold,
    color: colors.charcoal,
    minWidth: 80,
    textAlign: 'center',
  },
});
