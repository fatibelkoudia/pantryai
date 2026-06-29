import {
  ApiClientError,
  avatarPresets,
  getAvatarPreset,
  getLevel,
  LOCALE_FLAGS,
  SETTINGS_LIMITS,
  SUPPORTED_LOCALES,
} from '@pantryai/shared';
import type { Locale, StockLocation, UpdateUserSettingsDto } from '@pantryai/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../src/api/client';
import { AvatarImage } from '../src/components/AvatarImage';
import { BottomSheet } from '../src/components/BottomSheet';
import { useAuthStore } from '../src/store/auth';
import { buttonLip, colors, font } from '../src/theme';

const LOCATIONS: StockLocation[] = ['FRIDGE', 'FREEZER', 'PANTRY'];

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [deleting, setDeleting] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);

  // leaving the screen with unsaved settings: hold the navigation and ask first
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!settingsDirty) return;
      e.preventDefault();
      Alert.alert(t('settings.unsavedTitle'), t('settings.unsavedBody'), [
        { text: t('settings.keepEditing'), style: 'cancel' },
        {
          text: t('settings.discard'),
          style: 'destructive',
          onPress: () => navigation.dispatch(e.data.action),
        },
      ]);
    });
    return unsubscribe;
  }, [navigation, settingsDirty, t]);

  const challenges = useQuery({
    queryKey: ['challenges'],
    queryFn: () => apiClient.getChallenges(),
  });

  const xp = challenges.data?.xp ?? 0;
  const list = challenges.data?.challenges ?? [];
  const completed = list.filter((c) => c.completed).length;

  // RGPD Article 17: wipe the account and everything tied to it, then drop to login.
  function confirmDelete() {
    Alert.alert(t('deleteAccount.confirmTitle'), t('deleteAccount.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('deleteAccount.title'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await apiClient.deleteAccount();
            await logout();
          } catch {
            setDeleting(false);
            Alert.alert(t('deleteAccount.failed'));
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ProfileCard />
      <LanguageCard />

      <View style={styles.xpCard}>
        <Text style={styles.star}>⭐</Text>
        <View>
          <Text style={styles.xp}>{t('profile.xp', { count: xp })}</Text>
          <Text style={styles.xpSub}>
            {t('learn.levelTitle', {
              level: getLevel(xp).level,
              title: t(getLevel(xp).titleKey),
            })}
          </Text>
          <Text style={styles.xpSub}>
            {t('profile.challengesDone', { done: completed, total: list.length })}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.linkCard} onPress={() => router.push('/rewards')}>
        <Text style={styles.linkText}>{t('profile.viewChallenges')}</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <SettingsCard onDirtyChange={setSettingsDirty} />
      <ChangePasswordCard />

      {user ? (
        <>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => logout()}
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>{t('profile.logout')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={confirmDelete}
            disabled={deleting}
            accessibilityRole="button"
          >
            <Text style={styles.deleteText}>
              {deleting ? t('deleteAccount.deleting') : t('deleteAccount.title')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.deleteHint}>{t('deleteAccount.hint')}</Text>
        </>
      ) : null}
    </ScrollView>
  );
}

// Avatar + name + email, with an edit sheet for all three.
function ProfileCard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const avatar = getAvatarPreset(user?.avatarId ?? null);
  const draftAvatar = getAvatarPreset(avatarId);

  const save = useMutation({
    mutationFn: () =>
      apiClient.updateProfile({
        name,
        email,
        ...(avatarId ? { avatarId } : {}),
      }),
    onSuccess: async () => {
      await refreshUser();
      setEditing(false);
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof ApiClientError && err.status === 409
          ? t('profile.emailTaken')
          : t('common.error'),
      );
    },
  });

  function openEditor() {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setAvatarId(user?.avatarId ?? null);
    setError(null);
    setEditing(true);
  }

  if (!user) return null;

  return (
    <View style={styles.card}>
      <View style={styles.profileRow}>
        <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
          <AvatarImage id={avatar.id} size={56} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.cardValue}>{user.name ?? user.email}</Text>
          <Text style={styles.cardMuted}>{user.email}</Text>
        </View>
        <TouchableOpacity onPress={openEditor} accessibilityRole="button" style={styles.editBtn}>
          <Text style={styles.editText}>{t('common.edit')}</Text>
        </TouchableOpacity>
      </View>

      <BottomSheet visible={editing} title={t('common.edit')} onClose={() => setEditing(false)}>
        <Text style={styles.fieldLabel}>{t('profile.chooseAvatar')}</Text>
        <View style={styles.avatarGrid}>
          {avatarPresets.map((preset) => (
            <View key={preset.id} style={styles.avatarItem}>
              <TouchableOpacity
                onPress={() => setAvatarId(preset.id)}
                accessibilityRole="button"
                accessibilityLabel={preset.name}
                accessibilityState={{ selected: draftAvatar.id === preset.id }}
                style={[
                  styles.avatarChoice,
                  { backgroundColor: preset.bg },
                  draftAvatar.id === preset.id && styles.avatarChoiceSelected,
                ]}
              >
                <AvatarImage id={preset.id} size={48} />
              </TouchableOpacity>
              <Text
                style={[
                  styles.avatarName,
                  draftAvatar.id === preset.id && styles.avatarNameSelected,
                ]}
                numberOfLines={1}
              >
                {preset.name}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.fieldLabel}>{t('profile.name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('profile.namePlaceholder')}
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.fieldLabel}>{t('profile.email')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={() => save.mutate()}
          disabled={save.isPending}
          accessibilityRole="button"
        >
          <Text style={styles.saveText}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Text>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
}

// The language sits in its own card, above the other settings, because it's the
// one people reach for most. Tapping a flag saves right away, no Save button.
function LanguageCard() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
  });

  const save = useMutation({
    mutationFn: (locale: Locale) => apiClient.updateSettings({ locale }),
    onSuccess: async (data) => {
      // switch the UI right away instead of waiting for the refetch
      await i18n.changeLanguage(data.locale);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  if (!settings.data) return null;
  const current = settings.data.locale;

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{t('settings.language')}</Text>
      <View style={styles.flagRow}>
        {SUPPORTED_LOCALES.map((locale) => (
          <TouchableOpacity
            key={locale}
            onPress={() => save.mutate(locale)}
            disabled={save.isPending}
            accessibilityRole="button"
            accessibilityState={{ selected: current === locale }}
            style={[styles.flagBtn, current === locale && styles.flagBtnSelected]}
          >
            <Text style={styles.flagEmoji}>{LOCALE_FLAGS[locale]}</Text>
            <Text style={styles.rowLabel}>{t(`settings.languages.${locale}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// All the knobs. Changes stay in a local draft until Save, so we don't fire a
// request every time a stepper is tapped. The parent gets told when the draft
// differs from the saved values, so it can warn before leaving the screen.
function SettingsCard({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<UpdateUserSettingsDto>({});
  const [saved, setSaved] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
  });

  // reset the draft whenever fresh settings come in
  useEffect(() => {
    if (settings.data) {
      setDraft({
        recipeMinMatchedItems: settings.data.recipeMinMatchedItems,
        recipeMatchThreshold: settings.data.recipeMatchThreshold,
        expiringSoonDays: settings.data.expiringSoonDays,
        lowStockThreshold: settings.data.lowStockThreshold,
        defaultStockLocation: settings.data.defaultStockLocation,
      });
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => apiClient.updateSettings(draft),
    onSuccess: async () => {
      setSaved(true);
      // thresholds change what recipes/shopping/stock queries return, so drop everything
      await queryClient.invalidateQueries();
    },
  });

  // the draft is dirty when any knob differs from what the server has
  const dirty =
    settings.data != null &&
    (draft.recipeMinMatchedItems !== settings.data.recipeMinMatchedItems ||
      draft.recipeMatchThreshold !== settings.data.recipeMatchThreshold ||
      draft.expiringSoonDays !== settings.data.expiringSoonDays ||
      draft.lowStockThreshold !== settings.data.lowStockThreshold ||
      draft.defaultStockLocation !== settings.data.defaultStockLocation);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  if (!settings.data) return null;

  function patch(changes: UpdateUserSettingsDto) {
    setSaved(false);
    setDraft((prev) => ({ ...prev, ...changes }));
  }

  const thresholdPercent = Math.round((draft.recipeMatchThreshold ?? 0.7) * 100);

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{t('settings.title')}</Text>

      <Stepper
        label={t('settings.recipeMinMatchedItems')}
        hint={t('settings.recipeMinMatchedItemsHint')}
        value={draft.recipeMinMatchedItems ?? 1}
        display={String(draft.recipeMinMatchedItems ?? 1)}
        min={SETTINGS_LIMITS.recipeMinMatchedItems.min}
        max={SETTINGS_LIMITS.recipeMinMatchedItems.max}
        step={1}
        onChange={(value) => patch({ recipeMinMatchedItems: value })}
      />

      <Stepper
        label={t('settings.recipeMatchThreshold')}
        hint={t('settings.recipeMatchThresholdHint')}
        value={thresholdPercent}
        display={`${thresholdPercent}%`}
        min={SETTINGS_LIMITS.recipeMatchThreshold.min * 100}
        max={SETTINGS_LIMITS.recipeMatchThreshold.max * 100}
        step={5}
        onChange={(value) => patch({ recipeMatchThreshold: value / 100 })}
      />

      <Stepper
        label={t('settings.expiringSoonDays')}
        hint={t('settings.expiringSoonDaysHint')}
        value={draft.expiringSoonDays ?? 3}
        display={t('settings.daysUnit', { count: draft.expiringSoonDays ?? 3 })}
        min={SETTINGS_LIMITS.expiringSoonDays.min}
        max={SETTINGS_LIMITS.expiringSoonDays.max}
        step={1}
        onChange={(value) => patch({ expiringSoonDays: value })}
      />

      <Stepper
        label={t('settings.lowStockThreshold')}
        hint={t('settings.lowStockThresholdHint')}
        value={draft.lowStockThreshold ?? 1}
        display={String(draft.lowStockThreshold ?? 1)}
        min={SETTINGS_LIMITS.lowStockThreshold.min}
        max={SETTINGS_LIMITS.lowStockThreshold.max}
        step={1}
        onChange={(value) => patch({ lowStockThreshold: value })}
      />

      <TouchableOpacity
        style={styles.pickerRow}
        onPress={() => setLocationOpen(true)}
        accessibilityRole="button"
      >
        <Text style={styles.rowLabel}>{t('settings.defaultStockLocation')}</Text>
        <Text style={styles.rowValue}>
          {t(`settings.locations.${draft.defaultStockLocation ?? 'PANTRY'}`)}
        </Text>
      </TouchableOpacity>

      {save.isError ? <Text style={styles.errorText}>{t('common.error')}</Text> : null}
      {dirty ? <Text style={styles.dirtyHint}>{t('settings.unsavedHint')}</Text> : null}

      <TouchableOpacity
        style={styles.saveBtn}
        onPress={() => save.mutate()}
        disabled={save.isPending}
        accessibilityRole="button"
      >
        <Text style={styles.saveText}>
          {save.isPending ? t('common.saving') : saved ? t('common.saved') : t('common.save')}
        </Text>
      </TouchableOpacity>

      <BottomSheet
        visible={locationOpen}
        title={t('settings.defaultStockLocation')}
        onClose={() => setLocationOpen(false)}
      >
        {LOCATIONS.map((location) => (
          <TouchableOpacity
            key={location}
            style={styles.sheetOption}
            accessibilityRole="button"
            onPress={() => {
              patch({ defaultStockLocation: location });
              setLocationOpen(false);
            }}
          >
            <Text style={styles.rowLabel}>{t(`settings.locations.${location}`)}</Text>
            {draft.defaultStockLocation === location ? (
              <Text style={styles.rowValue}>✓</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </BottomSheet>
    </View>
  );
}

// A plain - value + row. The value only moves inside its min/max bounds.
function Stepper({
  label,
  hint,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepperBlock}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`${label} -`}
        >
          <Text style={styles.stepperBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{display}</Text>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`${label} +`}
        >
          <Text style={styles.stepperBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

function ChangePasswordCard() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const change = useMutation({
    mutationFn: () => apiClient.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setMessage({ ok: true, text: t('password.success') });
    },
    onError: (err) => {
      setMessage({
        ok: false,
        text:
          err instanceof ApiClientError && err.status === 401
            ? t('password.wrongCurrent')
            : t('common.error'),
      });
    },
  });

  function submit() {
    if (newPassword.length < 8) {
      setMessage({ ok: false, text: t('password.tooShort') });
      return;
    }
    change.mutate();
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{t('password.title')}</Text>

      <Text style={styles.fieldLabel}>{t('password.current')}</Text>
      <TextInput
        style={styles.input}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
        autoComplete="current-password"
      />

      <Text style={styles.fieldLabel}>{t('password.new')}</Text>
      <TextInput
        style={styles.input}
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        autoComplete="new-password"
      />

      {message ? (
        <Text style={message.ok ? styles.okText : styles.errorText}>{message.text}</Text>
      ) : null}

      <TouchableOpacity
        style={styles.saveBtn}
        onPress={submit}
        disabled={change.isPending}
        accessibilityRole="button"
      >
        <Text style={styles.saveText}>
          {change.isPending ? t('common.saving') : t('password.submit')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.warmCream },
  content: { padding: 16, gap: 12 },
  xpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
  },
  star: { fontSize: 32 },
  xp: { fontSize: 26, fontFamily: font.bold, color: colors.charcoal },
  xpSub: { fontSize: 13, color: colors.textMuted },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
  },
  linkText: { fontSize: 15, fontFamily: font.semibold, color: colors.charcoal },
  chevron: { fontSize: 22, color: colors.textMuted },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, gap: 8 },
  cardLabel: {
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardValue: { fontSize: 15, fontFamily: font.semibold, color: colors.charcoal },
  cardMuted: { fontSize: 13, color: colors.textMuted },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileInfo: { flex: 1 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editText: { fontSize: 13, fontFamily: font.semibold, color: colors.charcoal },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarItem: { alignItems: 'center', gap: 4, width: 48 },
  avatarChoice: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarChoiceSelected: { borderWidth: 2, borderColor: colors.forestGreen },
  avatarName: { fontSize: 10, fontFamily: font.semibold, color: colors.textMuted },
  avatarNameSelected: { color: colors.forestGreen, fontFamily: font.bold },
  fieldLabel: {
    fontSize: 13,
    fontFamily: font.semibold,
    color: colors.charcoal,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.charcoal,
    backgroundColor: colors.creamSurface,
  },
  flagRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  flagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  flagBtnSelected: { borderColor: colors.leafGreen, backgroundColor: colors.softMint },
  flagEmoji: { fontSize: 20 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowLabel: { fontSize: 14, fontFamily: font.semibold, color: colors.charcoal },
  rowValue: { fontSize: 14, color: colors.forestGreen, fontFamily: font.semibold },
  stepperBlock: { paddingVertical: 4, gap: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.surfaceGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { fontSize: 18, fontFamily: font.bold, color: colors.charcoal },
  stepperValue: {
    fontSize: 15,
    fontFamily: font.bold,
    color: colors.charcoal,
    minWidth: 64,
    textAlign: 'center',
  },
  hint: { fontSize: 12, color: colors.textMuted },
  dirtyHint: { fontSize: 13, fontFamily: font.semibold, color: colors.amberText },
  okText: { fontSize: 13, color: colors.forestGreen },
  errorText: { fontSize: 13, color: colors.brickRed },
  saveBtn: {
    ...buttonLip,
    backgroundColor: colors.forestGreen,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveText: { fontSize: 15, fontFamily: font.bold, color: colors.onBrand },
  logoutBtn: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  logoutText: { fontSize: 15, fontFamily: font.semibold, color: colors.charcoal },
  deleteBtn: {
    ...buttonLip,
    backgroundColor: colors.coralOrange,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteText: { fontSize: 15, fontFamily: font.bold, color: colors.onBrand },
  deleteHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
