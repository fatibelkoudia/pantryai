import { avatarPresets, getAvatarPreset } from '@pantryai/shared';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AvatarImage } from '../AvatarImage';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { colors, font, glow, radii, spacing } from '../../theme';
import { TextField } from '../TextField';
import { StepScaffold } from './StepScaffold';

interface StepProps {
  stepIndex: number;
  totalSteps: number;
  onAdvance: () => void;
}

// Pick an avatar and a display name. Only sends the fields the user actually set.
export function ProfileStep({ stepIndex, totalSteps, onAdvance }: StepProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState(user?.name ?? '');
  const [avatarId, setAvatarId] = useState<string | null>(user?.avatarId ?? null);
  const [error, setError] = useState<string | null>(null);

  const selected = getAvatarPreset(avatarId);

  const save = useMutation({
    mutationFn: () =>
      apiClient.updateProfile({
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(avatarId ? { avatarId } : {}),
      }),
    onSuccess: (updated) => {
      setUser(updated);
      onAdvance();
    },
    onError: () => setError(t('onboarding.saveFailed')),
  });

  return (
    <StepScaffold
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      title={t('onboarding.profile.title')}
      subtitle={t('onboarding.profile.subtitle')}
      continueLabel={t('onboarding.continue')}
      onContinue={() => {
        setError(null);
        save.mutate();
      }}
      onSkip={onAdvance}
      loading={save.isPending}
      error={error}
    >
      <Text style={styles.fieldLabel}>{t('profile.chooseAvatar')}</Text>
      <View style={styles.avatarGrid}>
        {avatarPresets.map((preset) => (
          <View key={preset.id} style={styles.avatarItem}>
            <TouchableOpacity
              onPress={() => {
                void Haptics.selectionAsync();
                setAvatarId(preset.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={preset.name}
              accessibilityState={{ selected: selected.id === preset.id }}
              style={[
                styles.avatarChoice,
                { backgroundColor: preset.bg },
                selected.id === preset.id && styles.avatarChoiceSelected,
              ]}
            >
              <AvatarImage id={preset.id} size={56} />
            </TouchableOpacity>
            <Text
              style={[styles.avatarName, selected.id === preset.id && styles.avatarNameSelected]}
              numberOfLines={1}
            >
              {preset.name}
            </Text>
          </View>
        ))}
      </View>

      <TextField
        label={t('profile.name')}
        value={name}
        onChangeText={setName}
        placeholder={t('profile.namePlaceholder')}
        autoComplete="name"
      />
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 14, fontFamily: font.bold, color: colors.charcoal },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  avatarItem: { alignItems: 'center', gap: 4, width: 56 },
  avatarChoice: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarChoiceSelected: {
    borderWidth: 2,
    borderColor: colors.forestGreen,
    boxShadow: `0 0 20px ${glow.brand}`,
  },
  avatarName: { fontSize: 11, fontFamily: font.semibold, color: colors.textMuted },
  avatarNameSelected: { color: colors.forestGreen, fontFamily: font.bold },
});
