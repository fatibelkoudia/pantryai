import { Ionicons } from '@expo/vector-icons';
import { mascotMoodMeta, type WasteMood } from '@pantryai/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../src/api/client';
import { TrashyMood } from '../src/components/TrashyMood';
import { EXPIRY_COLORS, daysUntil, expiryLabel, expiryLevel } from '../src/lib/expiry';
import { categoryIcon } from '../src/lib/foodIcons';
import { buttonLip, colors, font } from '../src/theme';

// The five moods in order (best to worst): segment color for the meter and a
// readable text color for the label under it.
const MOOD_STEPS: { mood: WasteMood; color: string; text: string }[] = [
  { mood: 'EXCELLENT', color: colors.forestGreen, text: colors.forestGreen },
  { mood: 'GOOD', color: colors.leafGreen, text: colors.forestGreen },
  { mood: 'OKAY', color: colors.sunnyYellow, text: colors.amberText },
  { mood: 'BAD', color: colors.coralOrange, text: colors.brickRed },
  { mood: 'AWFUL', color: colors.brickRed, text: colors.brickRed },
];

// Hero card tint per mood, so the whole card reflects the waste level.
const MOOD_TINTS: Record<WasteMood, string> = {
  EXCELLENT: colors.heroMint,
  GOOD: colors.heroMint,
  OKAY: colors.paleYellow,
  BAD: colors.redTint,
  AWFUL: colors.redTint,
};

// One feeling line per mood for the hero headline.
const MOOD_FEELING: Record<WasteMood, string> = {
  EXCELLENT: 'Trashy is feeling fantastic!',
  GOOD: 'Trashy is feeling light today!',
  OKAY: 'Trashy is feeling so-so.',
  BAD: 'Trashy is getting heavy…',
  AWFUL: 'Trashy is overflowing!',
};

// How many expiring items to list in the "Keep Trashy small" card.
const EXPIRING_PREVIEW = 3;

// "Trashy's Mood" screen: the Waste Level over the last 30 days, plus what to do
// about it. Reached by tapping the mascot on Home.
export default function MoodScreen() {
  const router = useRouter();

  const waste = useQuery({
    queryKey: ['waste'],
    queryFn: () => apiClient.getWasteLevel(),
  });
  const expiring = useQuery({
    queryKey: ['stocks', 'expiring'],
    queryFn: () => apiClient.listStocks({ expiringSoon: true }),
  });
  const challenges = useQuery({
    queryKey: ['challenges'],
    queryFn: () => apiClient.getChallenges(),
  });

  if (waste.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.leafGreen} />
      </View>
    );
  }

  if (waste.isError || !waste.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not check on Trashy</Text>
        <TouchableOpacity style={styles.button} onPress={() => waste.refetch()}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { score, mood, counts } = waste.data;
  const meta = mascotMoodMeta[mood];
  const expiringItems = expiring.data?.items ?? [];
  const earnedBadges = (challenges.data?.challenges ?? []).filter((c) => c.completed);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mascot hero, tinted by the current waste level */}
      <View style={[styles.heroCard, { backgroundColor: MOOD_TINTS[mood] }]}>
        <View style={styles.moodChip}>
          <Text style={styles.moodChipText}>{meta.label}</Text>
        </View>
        <TrashyMood mood={mood} size={160} showLabel={false} />
        <Text style={styles.heroTitle}>{MOOD_FEELING[mood]}</Text>
        {counts.total > 0 ? (
          <Text style={styles.heroCounts}>
            Last 30 days: {counts.consumed} used · {counts.discarded} thrown out · {counts.expired}{' '}
            expired
          </Text>
        ) : (
          <Text style={styles.heroCounts}>
            No items resolved yet. Mark what you use or toss to see your level move.
          </Text>
        )}
      </View>

      {/* Waste level meter: the five moods, current one highlighted */}
      <View style={styles.card}>
        <View style={styles.meterHeader}>
          <Text style={styles.meterLabel}>Waste Level</Text>
          <Text style={styles.meterScore}>{Math.round(score)}/100</Text>
        </View>
        <View style={styles.meterRow}>
          {MOOD_STEPS.map((step) => {
            const active = step.mood === mood;
            return (
              <View key={step.mood} style={styles.meterCol}>
                <View style={active ? null : styles.meterFaded}>
                  <TrashyMood mood={step.mood} size={40} showLabel={false} />
                </View>
                <View
                  style={[
                    styles.meterSegment,
                    { backgroundColor: step.color },
                    active ? styles.meterSegmentActive : styles.meterSegmentInactive,
                  ]}
                />
                <Text
                  style={[
                    styles.meterStepText,
                    active && { color: step.text, fontFamily: font.bold },
                  ]}
                >
                  {mascotMoodMeta[step.mood].label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 30-day impact */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.heroMint }]}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.forestGreen} />
          </View>
          <Text style={styles.statValue}>{counts.consumed}</Text>
          <Text style={styles.statLabel}>items used</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.paleYellow }]}>
            <Ionicons name="trash-outline" size={20} color={colors.amberText} />
          </View>
          <Text style={styles.statValue}>{counts.discarded}</Text>
          <Text style={styles.statLabel}>thrown out</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.redTint }]}>
            <Ionicons name="cloud-outline" size={20} color={colors.redText} />
          </View>
          {/* real CO2 math lands in a follow-up commit, placeholder until then */}
          <Text style={styles.statValue}>–</Text>
          <Text style={styles.statLabel}>CO2 avoided</Text>
        </View>
      </View>

      {/* Keep Trashy small: what to use next + where to act */}
      <View style={styles.card}>
        <View style={styles.actionHeader}>
          <Ionicons name="bulb-outline" size={20} color={colors.forestGreen} />
          <Text style={styles.actionTitle}>Keep Trashy small</Text>
        </View>
        {expiringItems.length > 0 ? (
          <>
            <Text style={styles.actionSub}>Use these items before they expire:</Text>
            <View style={styles.expiringList}>
              {expiringItems.slice(0, EXPIRING_PREVIEW).map((item) => {
                const days = daysUntil(item.expirationDate);
                const palette = EXPIRY_COLORS[expiryLevel(days)];
                return (
                  <View key={item.id} style={styles.expiringRow}>
                    <View style={[styles.itemIcon, { backgroundColor: palette.bg }]}>
                      <Ionicons
                        name={categoryIcon(item.product.category)}
                        size={18}
                        color={palette.fg}
                      />
                    </View>
                    <Text style={styles.itemName}>{item.product.name}</Text>
                    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
                      <Text style={[styles.badgeText, { color: palette.fg }]}>
                        {expiryLabel(days)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <Text style={styles.actionSub}>Nothing expiring soon. Trashy stays tiny!</Text>
        )}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/(tabs)/recipes')}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>Find recipes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/(tabs)/inventory')}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>View inventory</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Earned badges (completed challenges) */}
      {earnedBadges.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.badgeRail}>
            {earnedBadges.map((badge) => (
              <TouchableOpacity
                key={badge.key}
                style={styles.badgeCard}
                onPress={() => router.push('/rewards')}
                accessibilityRole="button"
              >
                <Ionicons name="ribbon-outline" size={26} color={colors.amberText} />
                <Text style={styles.badgeTitle}>{badge.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.warmCream },
  content: { padding: 16, gap: 14 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warmCream,
    gap: 12,
  },
  heroCard: {
    // bg color comes from MOOD_TINTS; the darker bottom edge gives the card
    // the same squishy depth as the buttons
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  moodChip: {
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  moodChipText: {
    fontSize: 12,
    fontFamily: font.bold,
    color: colors.charcoal,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: { fontSize: 20, fontFamily: font.black, color: colors.charcoal, textAlign: 'center' },
  heroCounts: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 16, gap: 10 },
  meterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meterLabel: {
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  meterScore: { fontSize: 13, fontFamily: font.bold, color: colors.forestGreen },
  meterRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  meterCol: { flex: 1, alignItems: 'center', gap: 4 },
  meterFaded: { opacity: 0.35 },
  meterSegment: { width: '100%', height: 8, borderRadius: 999 },
  meterSegmentActive: { height: 12 },
  meterSegmentInactive: { opacity: 0.3 },
  meterStepText: { fontSize: 9, color: colors.textMuted, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 18, fontFamily: font.black, color: colors.charcoal },
  statLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  actionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionTitle: { fontSize: 17, fontFamily: font.bold, color: colors.charcoal },
  actionSub: { fontSize: 13, color: colors.textMuted },
  expiringList: { gap: 8 },
  expiringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.creamSurface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { flex: 1, fontSize: 14, fontFamily: font.semibold, color: colors.charcoal },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: font.bold },
  actionButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryBtn: {
    ...buttonLip,
    flex: 1,
    backgroundColor: colors.forestGreen,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.onBrand, fontSize: 13, fontFamily: font.bold },
  secondaryBtn: {
    ...buttonLip,
    flex: 1,
    backgroundColor: colors.surfaceGray,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.textMuted, fontSize: 13, fontFamily: font.bold },
  badgeRail: { flexDirection: 'row', gap: 10 },
  badgeCard: {
    width: 116,
    backgroundColor: colors.paleYellow,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  badgeTitle: {
    fontSize: 12,
    fontFamily: font.bold,
    color: colors.amberText,
    textAlign: 'center',
  },
  errorTitle: { fontSize: 16, fontFamily: font.bold, color: colors.charcoal, textAlign: 'center' },
  button: {
    ...buttonLip,
    backgroundColor: colors.forestGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: { color: colors.onBrand, fontSize: 15, fontFamily: font.semibold },
});
