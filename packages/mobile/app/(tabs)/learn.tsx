import { Ionicons } from '@expo/vector-icons';
import type { TipCategory } from '@pantryai/shared';
import { TIP_CATEGORIES } from '@pantryai/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../src/api/client';
import { TrashyMood } from '../../src/components/TrashyMood';
import type { IoniconName } from '../../src/lib/foodIcons';
import { buttonLip, colors, font } from '../../src/theme';

// Friendlier labels for the raw category slugs the API uses.
const CATEGORY_LABELS: Record<TipCategory, string> = {
  fruits: 'Fruit',
  legumes: 'Veg',
  'produits-laitiers': 'Dairy',
  viande: 'Meat & fish',
  cereales: 'Grains',
};

const CATEGORY_ICONS: Record<TipCategory, IoniconName> = {
  fruits: 'nutrition-outline',
  legumes: 'leaf-outline',
  'produits-laitiers': 'egg-outline',
  viande: 'fish-outline',
  cereales: 'restaurant-outline',
};

type Filter = TipCategory | 'all';

export default function LearnScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');

  const tips = useQuery({
    queryKey: ['learning', 'tips', filter],
    queryFn: () => apiClient.getTips(filter === 'all' ? undefined : filter),
  });
  // Same key as Home so the daily tip is the same everywhere for 24h.
  const dailyTip = useQuery({
    queryKey: ['learning', 'tip', 'today'],
    queryFn: () => apiClient.getRandomTip(),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const challenges = useQuery({
    queryKey: ['challenges'],
    queryFn: () => apiClient.getChallenges(),
  });
  const waste = useQuery({
    queryKey: ['waste'],
    queryFn: () => apiClient.getWasteLevel(),
  });

  const items = tips.data?.tips ?? [];
  const xp = challenges.data?.xp ?? 0;
  const challengeList = challenges.data?.challenges ?? [];
  const completedCount = challengeList.filter((c) => c.completed).length;
  const progressFraction = challengeList.length > 0 ? completedCount / challengeList.length : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Learn</Text>
          <Text style={styles.subtitle}>Build smarter food habits</Text>
        </View>
        <TouchableOpacity
          style={styles.xpPill}
          onPress={() => router.push('/rewards')}
          accessibilityRole="button"
          accessibilityLabel="See your rewards"
        >
          <Text style={styles.xpPillText}>⭐ {xp} XP</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(tip) => tip.id}
        contentContainerStyle={styles.list}
        onRefresh={() => {
          void tips.refetch();
          void challenges.refetch();
        }}
        refreshing={tips.isRefetching}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Today's mission: the daily tip, front and center */}
            {dailyTip.data?.tip ? (
              <View style={styles.heroCard}>
                <View style={styles.heroIcon}>
                  <Ionicons name="sparkles-outline" size={20} color={colors.forestGreen} />
                </View>
                <View style={styles.heroText}>
                  <Text style={styles.heroKicker}>Today&apos;s Food Mission</Text>
                  <Text style={styles.heroTitle}>{dailyTip.data.tip.title}</Text>
                  <Text style={styles.heroBody}>{dailyTip.data.tip.body}</Text>
                  <Text style={styles.heroSource}>Source: {dailyTip.data.tip.source}</Text>
                </View>
              </View>
            ) : null}

            {/* Challenge progress, tap through to Rewards */}
            {challengeList.length > 0 ? (
              <TouchableOpacity
                style={styles.pathCard}
                onPress={() => router.push('/rewards')}
                accessibilityRole="button"
                accessibilityLabel="See all challenges"
              >
                <View style={styles.pathHeader}>
                  <Text style={styles.pathLabel}>Your progress</Text>
                  <Text style={styles.pathCount}>
                    {completedCount}/{challengeList.length} challenges
                  </Text>
                </View>
                <View style={styles.pathRow}>
                  <View style={styles.pathIcon}>
                    <Ionicons name="school-outline" size={20} color={colors.forestGreen} />
                  </View>
                  <Text style={styles.pathTitle}>
                    {completedCount === challengeList.length
                      ? 'All challenges done!'
                      : 'Keep the streak going'}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(progressFraction * 100)}%` },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            ) : null}

            {/* Category chips */}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={['all', ...TIP_CATEGORIES] as Filter[]}
              keyExtractor={(c) => c}
              contentContainerStyle={styles.chips}
              renderItem={({ item: cat }) => {
                const active = filter === cat;
                return (
                  <TouchableOpacity
                    onPress={() => setFilter(cat)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        }
        ListEmptyComponent={
          tips.isLoading ? (
            <ActivityIndicator size="large" color={colors.leafGreen} style={styles.spinner} />
          ) : tips.isError ? (
            <View style={styles.centered}>
              <Text style={styles.errorTitle}>Could not load tips</Text>
              <TouchableOpacity style={styles.button} onPress={() => tips.refetch()}>
                <Text style={styles.buttonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.muted}>No tips in this category yet.</Text>
          )
        }
        renderItem={({ item: tip }) => (
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name={CATEGORY_ICONS[tip.category]} size={20} color={colors.forestGreen} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardKicker}>{CATEGORY_LABELS[tip.category]}</Text>
              <Text style={styles.cardTitle}>{tip.title}</Text>
              <Text style={styles.cardBody}>{tip.body}</Text>
              <Text style={styles.cardSource}>Source: {tip.source}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.listFooter}>
            {/* Challenges rail */}
            {challengeList.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Challenges</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={challengeList}
                  keyExtractor={(c) => c.key}
                  contentContainerStyle={styles.challengeRail}
                  renderItem={({ item: challenge }) => (
                    <TouchableOpacity
                      style={styles.challengeCard}
                      onPress={() => router.push('/rewards')}
                      accessibilityRole="button"
                    >
                      <View style={styles.challengeIcon}>
                        <Ionicons
                          name={challenge.completed ? 'checkmark-circle-outline' : 'trophy-outline'}
                          size={20}
                          color={challenge.completed ? colors.leafGreen : colors.charcoal}
                        />
                      </View>
                      <Text style={styles.challengeTitle} numberOfLines={1}>
                        {challenge.title}
                      </Text>
                      <Text style={styles.challengeBody} numberOfLines={2}>
                        {challenge.description}
                      </Text>
                      <View style={styles.challengeFooter}>
                        <Text style={styles.challengeProgress}>
                          {challenge.completed
                            ? 'Done!'
                            : `${challenge.progress}/${challenge.target}`}
                        </Text>
                        <View style={styles.xpChip}>
                          <Text style={styles.xpChipText}>+{challenge.xp} XP</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </>
            ) : null}

            {/* Trashy banner */}
            <TouchableOpacity
              style={styles.banner}
              onPress={() => router.push('/mood')}
              accessibilityRole="button"
              accessibilityLabel="See Trashy's mood"
            >
              {waste.data ? (
                <TrashyMood mood={waste.data.mood} size={64} showLabel={false} />
              ) : null}
              <View style={styles.bannerText}>
                <Text style={styles.bannerTitle}>Help Trashy stay small</Text>
                <Text style={styles.bannerBody}>Good habits keep waste down and Trashy happy.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.brickRed} />
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.warmCream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: { fontSize: 22, fontFamily: font.black, color: colors.forestGreen },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  xpPill: {
    backgroundColor: colors.sunnyYellow,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  xpPillText: { fontSize: 13, fontFamily: font.bold, color: colors.amberText },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  listHeader: { gap: 12, marginBottom: 4 },
  heroCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.heroMint,
    borderRadius: 20,
    padding: 16,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: 2 },
  heroKicker: {
    fontSize: 12,
    fontFamily: font.bold,
    color: colors.forestGreen,
    letterSpacing: 0.5,
  },
  heroTitle: { fontSize: 16, fontFamily: font.bold, color: colors.charcoal },
  heroBody: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  heroSource: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  pathCard: { backgroundColor: colors.white, borderRadius: 20, padding: 16, gap: 10 },
  pathHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pathLabel: {
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pathCount: { fontSize: 12, fontFamily: font.bold, color: colors.forestGreen },
  pathRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pathIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathTitle: { fontSize: 16, fontFamily: font.bold, color: colors.charcoal },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.creamSurface,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.leafGreen },
  chips: { gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.sunnyYellow, borderColor: colors.sunnyYellow },
  chipText: { fontSize: 13, fontFamily: font.semibold, color: colors.textMuted },
  chipTextActive: { color: colors.amberText },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.creamSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2 },
  cardKicker: {
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.forestGreen,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: { fontSize: 15, fontFamily: font.bold, color: colors.charcoal },
  cardBody: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  cardSource: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  listFooter: { gap: 12, marginTop: 8 },
  sectionTitle: { fontSize: 17, fontFamily: font.bold, color: colors.charcoal },
  challengeRail: { gap: 10 },
  challengeCard: {
    width: 190,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    gap: 6,
  },
  challengeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.creamSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeTitle: { fontSize: 14, fontFamily: font.bold, color: colors.charcoal },
  challengeBody: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  challengeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  challengeProgress: { fontSize: 12, fontFamily: font.bold, color: colors.forestGreen },
  xpChip: {
    backgroundColor: colors.sunnyYellow,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  xpChipText: { fontSize: 11, fontFamily: font.bold, color: colors.amberText },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.redTint,
    borderRadius: 20,
    padding: 16,
  },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { fontSize: 15, fontFamily: font.bold, color: colors.charcoal },
  bannerBody: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  spinner: { marginTop: 24 },
  centered: { alignItems: 'center', padding: 24, gap: 12 },
  muted: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingTop: 24 },
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
