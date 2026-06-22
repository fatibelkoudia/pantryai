import { Ionicons } from '@expo/vector-icons';
import {
  mascotMoodMeta,
  wasteMoodBands,
  wasteTrendMeta,
  type WasteMood,
  type WasteResolvedItem,
  type WasteTrend,
} from '@pantryai/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../src/api/client';
import { BottomSheet } from '../src/components/BottomSheet';
import { TrashyMood } from '../src/components/TrashyMood';
import { EXPIRY_COLORS, daysUntil, expiryLabel, expiryLevel } from '../src/lib/expiry';
import { categoryIcon } from '../src/lib/foodIcons';
import { buttonLip, colors, font, radii } from '../src/theme';

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

// Icon for each trend direction, next to the wasteTrendMeta label.
const TREND_ICONS: Record<WasteTrend, keyof typeof Ionicons.glyphMap> = {
  IMPROVING: 'trending-up',
  STEADY: 'remove',
  WORSENING: 'trending-down',
};

// How far the score has climbed inside its current mood band, 0 to 1.
// Used for the little "progress to the next mood" bar.
function bandProgress(score: number, mood: WasteMood): number {
  const index = wasteMoodBands.findIndex((band) => band.mood === mood);
  if (index === -1) return 0;
  const floor = wasteMoodBands[index].min;
  const ceil = index === 0 ? 100 : wasteMoodBands[index - 1].min;
  if (ceil === floor) return 1;
  return Math.min(1, Math.max(0, (score - floor) / (ceil - floor)));
}

// The mood accent color for a weekly bar, based on that week's score.
function accentForScore(score: number): string {
  const band = wasteMoodBands.find((b) => score >= b.min);
  return band ? mascotMoodMeta[band.mood].accent : colors.surfaceGray;
}

// Max bar height for the weekly chart, in px.
const WEEK_BAR_MAX = 48;
const WEEK_LABELS = ['3w ago', '2w', '1w', 'now'];

// Which stat card detail sheet is open.
type StatSheet = 'used' | 'tossed' | 'co2';

const SHEET_TITLES: Record<StatSheet, string> = {
  used: 'Items used',
  tossed: 'Thrown out',
  co2: 'CO2 avoided',
};

// Readable names for the CO2 factor table categories.
const CATEGORY_LABELS: Record<string, string> = {
  viande: 'Meat',
  'produits-laitiers': 'Dairy',
  cereales: 'Grains',
  fruits: 'Fruit',
  legumes: 'Vegetables',
};

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// 'YYYY-MM' -> 'Mar', with the year added on January so long ranges stay readable.
function monthLabel(month: string, first: boolean): string {
  const mm = Number(month.slice(5));
  const name = MONTHS_SHORT[mm - 1] ?? month;
  if (first || mm === 1) return `${name} ${month.slice(2, 4)}`;
  return name;
}

// '2026-07-05T…' -> 'Jul 5'
function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS_SHORT[d.getMonth()] ?? '?'} ${d.getDate()}`;
}

// Four little bars, one per week, oldest on the left. Quiet weeks get a gray stub.
function WeeklyBars({ scores }: { scores: (number | null)[] }) {
  const summary = scores
    .map((s, i) => `${WEEK_LABELS[i]}: ${s === null ? 'no items' : s}`)
    .join(', ');
  return (
    <View
      style={styles.weekRow}
      accessibilityRole="image"
      accessibilityLabel={`Weekly waste scores. ${summary}`}
    >
      {scores.map((score, i) => (
        <View key={WEEK_LABELS[i]} style={styles.weekCol}>
          <Text style={styles.weekValue}>{score === null ? '–' : score}</Text>
          <View
            style={[
              styles.weekBar,
              score === null
                ? { height: 6, backgroundColor: colors.surfaceGray }
                : {
                    height: Math.max(6, (score / 100) * WEEK_BAR_MAX),
                    backgroundColor: accentForScore(score),
                  },
            ]}
          />
          <Text style={styles.weekLabel}>{WEEK_LABELS[i]}</Text>
        </View>
      ))}
    </View>
  );
}

// The all-time view: one bar per month, oldest on the left, scrolls sideways.
function MonthlyBars({ months }: { months: { month: string; score: number | null }[] }) {
  if (months.length === 0) {
    return <Text style={styles.actionSub}>No history yet. Resolve some items first!</Text>;
  }
  const summary = months
    .map((m) => `${m.month}: ${m.score === null ? 'no items' : m.score}`)
    .join(', ');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View
        style={styles.weekRow}
        accessibilityRole="image"
        accessibilityLabel={`Monthly waste scores out of 100. ${summary}`}
      >
        {months.map((m, i) => (
          <View key={m.month} style={styles.monthCol}>
            <Text style={styles.weekValue}>{m.score === null ? '–' : m.score}</Text>
            <View
              style={[
                styles.weekBar,
                m.score === null
                  ? { height: 6, backgroundColor: colors.surfaceGray }
                  : {
                      height: Math.max(6, (m.score / 100) * WEEK_BAR_MAX),
                      backgroundColor: accentForScore(m.score),
                    },
              ]}
            />
            <Text style={styles.weekLabel}>{monthLabel(m.month, i === 0)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// One row in a detail sheet's item list.
function SheetItemRow({ item, right }: { item: WasteResolvedItem; right?: string }) {
  return (
    <View style={styles.sheetRow}>
      <View style={styles.sheetRowMain}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.sheetRowSub}>
          {item.quantity} {item.unit} · {shortDate(item.resolvedAt)}
        </Text>
      </View>
      {item.rescued ? (
        <View style={[styles.badge, { backgroundColor: colors.heroMint }]}>
          <Text style={[styles.badgeText, { color: colors.forestGreen }]}>Rescue</Text>
        </View>
      ) : null}
      {right ? <Text style={styles.sheetRowRight}>{right}</Text> : null}
    </View>
  );
}

// The hero mascot slowly floats up and down. Small and slow on purpose, and
// skipped entirely when the user prefers reduced motion.
function BouncingTrashy({ mood }: { mood: WasteMood }) {
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(shift, {
            toValue: -6,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(shift, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [shift]);

  return (
    <Animated.View style={{ transform: [{ translateY: shift }] }}>
      <TrashyMood mood={mood} size={160} showLabel={false} />
    </Animated.View>
  );
}

// "Trashy's Mood" screen: the Waste Level over the last 30 days, plus what to do
// about it. Reached by tapping the mascot on Home.
export default function MoodScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [sheet, setSheet] = useState<StatSheet | null>(null);
  const [historyTab, setHistoryTab] = useState<'weeks' | 'all'>('weeks');

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
  // only fetched once a detail sheet is opened
  const details = useQuery({
    queryKey: ['waste', 'items'],
    queryFn: () => apiClient.getWasteItems(),
    enabled: sheet !== null,
  });
  // only fetched once the All time tab is opened
  const history = useQuery({
    queryKey: ['waste', 'history'],
    queryFn: () => apiClient.getWasteHistory(),
    enabled: historyTab === 'all',
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

  const {
    score,
    mood,
    counts,
    co2AvoidedKg,
    nextMood,
    itemsToNextMood,
    pantryBlocked,
    rescuedCount,
    trend,
    weeklyScores,
  } = waste.data;
  const meta = mascotMoodMeta[mood];
  const trendMeta = trend ? wasteTrendMeta[trend] : null;
  const expiringItems = expiring.data?.items ?? [];
  const earnedBadges = (challenges.data?.challenges ?? []).filter((c) => c.completed);
  const detailItems = details.data?.items ?? [];
  const usedItems = detailItems.filter((d) => d.disposition === 'CONSUMED');
  const tossedItems = detailItems.filter((d) => d.disposition !== 'CONSUMED');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mascot hero, tinted by the current waste level */}
      <View style={[styles.heroCard, { backgroundColor: MOOD_TINTS[mood] }]}>
        <View style={styles.chipRow}>
          <View style={styles.moodChip}>
            <Text style={styles.moodChipText}>{t(`waste.moods.${mood}`)}</Text>
          </View>
          {trend && trendMeta ? (
            <View style={[styles.moodChip, { backgroundColor: trendMeta.bg }]}>
              <Ionicons name={TREND_ICONS[trend]} size={12} color={trendMeta.fg} />
              <Text style={[styles.moodChipText, { color: trendMeta.fg }]}>
                {t(`waste.trend.${trend}`)}
              </Text>
            </View>
          ) : null}
        </View>
        <BouncingTrashy mood={mood} />
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
                  {t(`waste.moods.${step.mood}`)}
                </Text>
              </View>
            );
          })}
        </View>
        {nextMood !== null ? (
          <View style={styles.nextMoodBlock}>
            {pantryBlocked || itemsToNextMood === null ? (
              <Text style={styles.nextMoodText}>{t('waste.pantryBlockedHint')}</Text>
            ) : (
              <Text style={styles.nextMoodText}>
                Use <Text style={styles.nextMoodStrong}>~{itemsToNextMood} more items</Text> and
                Trashy feels{' '}
                <Text style={styles.nextMoodStrong}>{t(`waste.moods.${nextMood}`)}</Text>
              </Text>
            )}
            <View style={styles.nextMoodTrack}>
              <View
                style={[
                  styles.nextMoodFill,
                  {
                    width: `${Math.round(bandProgress(score, mood) * 100)}%`,
                    backgroundColor: meta.accent,
                  },
                ]}
              />
            </View>
          </View>
        ) : null}
      </View>

      {/* 30-day impact: tap a card for the items and the math behind it */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => setSheet('used')}
          accessibilityRole="button"
          accessibilityLabel={`${counts.consumed} items used, tap for details`}
        >
          <View style={[styles.statIcon, { backgroundColor: colors.heroMint }]}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.forestGreen} />
          </View>
          <Text style={styles.statValue}>{counts.consumed}</Text>
          <Text style={styles.statLabel}>items used</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => setSheet('tossed')}
          accessibilityRole="button"
          accessibilityLabel={`${counts.discarded} items thrown out, tap for details`}
        >
          <View style={[styles.statIcon, { backgroundColor: colors.paleYellow }]}>
            <Ionicons name="trash-outline" size={20} color={colors.amberText} />
          </View>
          <Text style={styles.statValue}>{counts.discarded}</Text>
          <Text style={styles.statLabel}>thrown out</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => setSheet('co2')}
          accessibilityRole="button"
          accessibilityLabel={`${co2AvoidedKg} kilograms of CO2 avoided, tap for details`}
        >
          <View style={[styles.statIcon, { backgroundColor: colors.redTint }]}>
            <Ionicons name="cloud-outline" size={20} color={colors.redText} />
          </View>
          <Text style={styles.statValue}>{co2AvoidedKg} kg</Text>
          <Text style={styles.statLabel}>CO2 avoided</Text>
        </TouchableOpacity>
      </View>

      {/* History: the last four weeks, or every month since the start */}
      <View style={styles.card}>
        <View style={styles.meterHeader}>
          <Text style={styles.meterLabel}>
            {historyTab === 'weeks' ? 'Last 4 weeks' : 'All time'}
          </Text>
          <Text style={styles.meterScore}>score /100</Text>
        </View>
        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segment, historyTab === 'weeks' && styles.segmentActive]}
            onPress={() => setHistoryTab('weeks')}
            accessibilityRole="button"
            accessibilityState={{ selected: historyTab === 'weeks' }}
          >
            <Text style={[styles.segmentText, historyTab === 'weeks' && styles.segmentTextActive]}>
              4 weeks
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, historyTab === 'all' && styles.segmentActive]}
            onPress={() => setHistoryTab('all')}
            accessibilityRole="button"
            accessibilityState={{ selected: historyTab === 'all' }}
          >
            <Text style={[styles.segmentText, historyTab === 'all' && styles.segmentTextActive]}>
              All time
            </Text>
          </TouchableOpacity>
        </View>
        {historyTab === 'weeks' ? (
          <WeeklyBars scores={weeklyScores} />
        ) : history.isLoading ? (
          <ActivityIndicator color={colors.leafGreen} />
        ) : (
          <MonthlyBars months={history.data?.months ?? []} />
        )}
        <Text style={styles.forgivenessHint}>{t('waste.forgivenessHint')}</Text>
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
                        {expiryLabel(days, t)}
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

      {/* Detail sheet for whichever stat card was tapped */}
      <BottomSheet
        visible={sheet !== null}
        title={sheet ? SHEET_TITLES[sheet] : ''}
        onClose={() => setSheet(null)}
      >
        {details.isLoading ? (
          <ActivityIndicator color={colors.leafGreen} />
        ) : sheet === 'used' ? (
          <>
            <Text style={styles.sheetExplain}>
              Everything you marked as used in the last 30 days. Rescues (items eaten with 3 days or
              less left before expiry) count extra toward Trashy&apos;s mood.
            </Text>
            {rescuedCount > 0 ? (
              <Text style={styles.sheetHighlight}>
                {rescuedCount} of them {rescuedCount === 1 ? 'was a rescue' : 'were rescues'}. Nice
                save!
              </Text>
            ) : null}
            {usedItems.length === 0 ? (
              <Text style={styles.actionSub}>Nothing used yet.</Text>
            ) : (
              usedItems.map((item) => <SheetItemRow key={item.id} item={item} />)
            )}
          </>
        ) : sheet === 'tossed' ? (
          <>
            <Text style={styles.sheetExplain}>
              Items that got thrown out or expired in the last 30 days. Both count as waste and pull
              the score down, and fresher waste weighs more than old waste.
            </Text>
            <Text style={styles.sheetHighlight}>
              {counts.discarded} thrown out · {counts.expired} expired
            </Text>
            {tossedItems.length === 0 ? (
              <Text style={styles.actionSub}>Nothing wasted. Trashy approves!</Text>
            ) : (
              tossedItems.map((item) => (
                <SheetItemRow
                  key={item.id}
                  item={item}
                  right={item.disposition === 'EXPIRED' ? 'expired' : 'tossed'}
                />
              ))
            )}
          </>
        ) : sheet === 'co2' ? (
          <>
            <Text style={styles.sheetExplain}>
              Producing food costs CO2, so every item you eat instead of tossing is production CO2
              that wasn&apos;t wasted. We turn each item into kilograms (a piece counts as{' '}
              {details.data ? details.data.co2Info.pieceWeightKg * 1000 : 250} g) and multiply by
              its category&apos;s factor.
            </Text>
            {usedItems.length === 0 ? (
              <Text style={styles.actionSub}>Use some items to start saving CO2.</Text>
            ) : (
              usedItems.map((item) => (
                <SheetItemRow key={item.id} item={item} right={`${item.co2Kg ?? 0} kg`} />
              ))
            )}
            {details.data ? (
              <View style={styles.factorTable}>
                <Text style={styles.sheetHighlight}>Factors (kg CO2 per kg of food)</Text>
                {Object.entries(details.data.co2Info.perKgByCategory).map(([key, factor]) => (
                  <View key={key} style={styles.factorRow}>
                    <Text style={styles.factorName}>{CATEGORY_LABELS[key] ?? key}</Text>
                    <Text style={styles.factorValue}>{factor}</Text>
                  </View>
                ))}
                <View style={styles.factorRow}>
                  <Text style={styles.factorName}>Anything else</Text>
                  <Text style={styles.factorValue}>{details.data.co2Info.perKgDefault}</Text>
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </BottomSheet>
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
  chipRow: { flexDirection: 'row', gap: 8 },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  nextMoodBlock: { gap: 6, marginTop: 4 },
  nextMoodText: { fontSize: 12, fontFamily: font.semibold, color: colors.textMuted },
  nextMoodStrong: { color: colors.forestGreen, fontFamily: font.bold },
  nextMoodTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.creamSurface,
    overflow: 'hidden',
  },
  nextMoodFill: { height: '100%', borderRadius: radii.pill },
  weekRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  weekCol: { flex: 1, alignItems: 'center', gap: 4 },
  monthCol: { width: 44, alignItems: 'center', gap: 4 },
  weekValue: { fontSize: 11, fontFamily: font.bold, color: colors.charcoal },
  weekBar: { width: '100%', borderRadius: 6 },
  weekLabel: { fontSize: 10, color: colors.textMuted },
  forgivenessHint: { fontSize: 11, color: colors.textMuted },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.creamSurface,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.white },
  segmentText: { fontSize: 12, fontFamily: font.semibold, color: colors.textMuted },
  segmentTextActive: { color: colors.forestGreen, fontFamily: font.bold },
  sheetExplain: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  sheetHighlight: { fontSize: 13, fontFamily: font.bold, color: colors.forestGreen },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.creamSurface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sheetRowMain: { flex: 1, gap: 2 },
  sheetRowSub: { fontSize: 11, color: colors.textMuted },
  sheetRowRight: { fontSize: 12, fontFamily: font.bold, color: colors.charcoal },
  factorTable: { gap: 6, marginTop: 4 },
  factorRow: { flexDirection: 'row', justifyContent: 'space-between' },
  factorName: { fontSize: 12, color: colors.textMuted },
  factorValue: { fontSize: 12, fontFamily: font.bold, color: colors.charcoal },
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
