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
// Stable keys for the four weekly bars; the labels come from i18n (waste.weeks.*).
const WEEK_KEYS = ['w3', 'w2', 'w1', 'now'] as const;

// Which stat card detail sheet is open.
type StatSheet = 'used' | 'tossed' | 'co2';

// i18n key for each detail sheet's title.
const SHEET_TITLE_KEYS: Record<StatSheet, string> = {
  used: 'waste.detail.usedTitle',
  tossed: 'waste.detail.tossedTitle',
  co2: 'waste.detail.co2Title',
};

// 'YYYY-MM' -> 'Mar', with the year added on January so long ranges stay readable.
// `months` is the localized list of short month names (waste.months.*).
function monthLabel(month: string, first: boolean, months: string[]): string {
  const mm = Number(month.slice(5));
  const name = months[mm - 1] ?? month;
  if (first || mm === 1) return `${name} ${month.slice(2, 4)}`;
  return name;
}

// '2026-07-05T…' -> 'Jul 5'
function shortDate(iso: string, months: string[]): string {
  const d = new Date(iso);
  return `${months[d.getMonth()] ?? '?'} ${d.getDate()}`;
}

// The 12 short month names in the current language, for the chart and dates.
function useMonthNames(t: (key: string) => string): string[] {
  return Array.from({ length: 12 }, (_, i) => t(`waste.months.${i}`));
}

// Four little bars, one per week, oldest on the left. Quiet weeks get a gray stub.
function WeeklyBars({ scores }: { scores: (number | null)[] }) {
  const { t } = useTranslation();
  const labels = WEEK_KEYS.map((k) => t(`waste.weeks.${k}`));
  const summary = scores
    .map((s, i) => `${labels[i]}: ${s === null ? t('waste.history.noItems') : s}`)
    .join(', ');
  return (
    <View
      style={styles.weekRow}
      accessibilityRole="image"
      accessibilityLabel={t('waste.history.weeklyA11y', { summary })}
    >
      {scores.map((score, i) => (
        <View key={WEEK_KEYS[i]} style={styles.weekCol}>
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
          <Text style={styles.weekLabel}>{labels[i]}</Text>
        </View>
      ))}
    </View>
  );
}

// The all-time view: one bar per month, oldest on the left, scrolls sideways.
function MonthlyBars({ months }: { months: { month: string; score: number | null }[] }) {
  const { t } = useTranslation();
  const monthNames = useMonthNames(t);
  if (months.length === 0) {
    return <Text style={styles.actionSub}>{t('waste.history.empty')}</Text>;
  }
  const summary = months
    .map((m) => `${m.month}: ${m.score === null ? t('waste.history.noItems') : m.score}`)
    .join(', ');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View
        style={styles.weekRow}
        accessibilityRole="image"
        accessibilityLabel={t('waste.history.monthlyA11y', { summary })}
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
            <Text style={styles.weekLabel}>{monthLabel(m.month, i === 0, monthNames)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// One row in a detail sheet's item list.
function SheetItemRow({ item, right }: { item: WasteResolvedItem; right?: string }) {
  const { t } = useTranslation();
  const monthNames = useMonthNames(t);
  return (
    <View style={styles.sheetRow}>
      <View style={styles.sheetRowMain}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.sheetRowSub}>
          {item.quantity} {item.unit} · {shortDate(item.resolvedAt, monthNames)}
        </Text>
      </View>
      {item.rescued ? (
        <View style={[styles.badge, { backgroundColor: colors.heroMint }]}>
          <Text style={[styles.badgeText, { color: colors.forestGreen }]}>
            {t('waste.detail.rescue')}
          </Text>
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
        <Text style={styles.errorTitle}>{t('waste.couldNotCheck')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => waste.refetch()}>
          <Text style={styles.buttonText}>{t('common.retry')}</Text>
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
        <Text style={styles.heroTitle}>{t(`waste.feelings.${mood}`)}</Text>
        {counts.total > 0 ? (
          <Text style={styles.heroCounts}>
            {t('waste.last30Full', {
              used: counts.consumed,
              discarded: counts.discarded,
              expired: counts.expired,
            })}
          </Text>
        ) : (
          <Text style={styles.heroCounts}>{t('waste.noneResolved')}</Text>
        )}
      </View>

      {/* Waste level meter: the five moods, current one highlighted */}
      <View style={styles.card}>
        <View style={styles.meterHeader}>
          <Text style={styles.meterLabel}>{t('waste.gaugeLabel')}</Text>
          <Text style={styles.meterScore}>
            {t('waste.history.score100', { score: Math.round(score) })}
          </Text>
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
                {t('waste.useMoreItems', {
                  count: itemsToNextMood,
                  mood: t(`waste.moods.${nextMood}`),
                })}
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
          accessibilityLabel={t('waste.stats.usedA11y', { count: counts.consumed })}
        >
          <View style={[styles.statIcon, { backgroundColor: colors.heroMint }]}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.forestGreen} />
          </View>
          <Text style={styles.statValue}>{counts.consumed}</Text>
          <Text style={styles.statLabel}>{t('waste.stats.itemsUsed')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => setSheet('tossed')}
          accessibilityRole="button"
          accessibilityLabel={t('waste.stats.tossedA11y', { count: counts.discarded })}
        >
          <View style={[styles.statIcon, { backgroundColor: colors.paleYellow }]}>
            <Ionicons name="trash-outline" size={20} color={colors.amberText} />
          </View>
          <Text style={styles.statValue}>{counts.discarded}</Text>
          <Text style={styles.statLabel}>{t('waste.stats.thrownOut')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statCard}
          onPress={() => setSheet('co2')}
          accessibilityRole="button"
          accessibilityLabel={t('waste.stats.co2A11y', { count: co2AvoidedKg })}
        >
          <View style={[styles.statIcon, { backgroundColor: colors.redTint }]}>
            <Ionicons name="cloud-outline" size={20} color={colors.redText} />
          </View>
          <Text style={styles.statValue}>{co2AvoidedKg} kg</Text>
          <Text style={styles.statLabel}>{t('waste.stats.co2Avoided')}</Text>
        </TouchableOpacity>
      </View>

      {/* History: the last four weeks, or every month since the start */}
      <View style={styles.card}>
        <View style={styles.meterHeader}>
          <Text style={styles.meterLabel}>
            {historyTab === 'weeks' ? t('waste.history.last4weeks') : t('waste.history.allTime')}
          </Text>
          <Text style={styles.meterScore}>{t('waste.history.scoreOutOf')}</Text>
        </View>
        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segment, historyTab === 'weeks' && styles.segmentActive]}
            onPress={() => setHistoryTab('weeks')}
            accessibilityRole="button"
            accessibilityState={{ selected: historyTab === 'weeks' }}
          >
            <Text style={[styles.segmentText, historyTab === 'weeks' && styles.segmentTextActive]}>
              {t('waste.history.weeks4')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, historyTab === 'all' && styles.segmentActive]}
            onPress={() => setHistoryTab('all')}
            accessibilityRole="button"
            accessibilityState={{ selected: historyTab === 'all' }}
          >
            <Text style={[styles.segmentText, historyTab === 'all' && styles.segmentTextActive]}>
              {t('waste.history.allTime')}
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
          <Text style={styles.actionTitle}>{t('waste.keepSmall.title')}</Text>
        </View>
        {expiringItems.length > 0 ? (
          <>
            <Text style={styles.actionSub}>{t('waste.keepSmall.useBeforeExpire')}</Text>
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
          <Text style={styles.actionSub}>{t('waste.keepSmall.nothingExpiring')}</Text>
        )}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/(tabs)/recipes')}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>{t('waste.keepSmall.findRecipes')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/(tabs)/inventory')}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>{t('waste.keepSmall.viewInventory')}</Text>
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
        title={sheet ? t(SHEET_TITLE_KEYS[sheet]) : ''}
        onClose={() => setSheet(null)}
      >
        {details.isLoading ? (
          <ActivityIndicator color={colors.leafGreen} />
        ) : sheet === 'used' ? (
          <>
            <Text style={styles.sheetExplain}>{t('waste.detail.usedIntro')}</Text>
            {rescuedCount > 0 ? (
              <Text style={styles.sheetHighlight}>
                {t('waste.detail.rescueLine', { count: rescuedCount })}
              </Text>
            ) : null}
            {usedItems.length === 0 ? (
              <Text style={styles.actionSub}>{t('waste.detail.nothingUsed')}</Text>
            ) : (
              usedItems.map((item) => <SheetItemRow key={item.id} item={item} />)
            )}
          </>
        ) : sheet === 'tossed' ? (
          <>
            <Text style={styles.sheetExplain}>{t('waste.detail.tossedIntro')}</Text>
            <Text style={styles.sheetHighlight}>
              {t('waste.tossedCount', { discarded: counts.discarded, expired: counts.expired })}
            </Text>
            {tossedItems.length === 0 ? (
              <Text style={styles.actionSub}>{t('waste.detail.nothingWasted')}</Text>
            ) : (
              tossedItems.map((item) => (
                <SheetItemRow
                  key={item.id}
                  item={item}
                  right={
                    item.disposition === 'EXPIRED'
                      ? t('waste.detail.expiredTag')
                      : t('waste.detail.tossedTag')
                  }
                />
              ))
            )}
          </>
        ) : sheet === 'co2' ? (
          <>
            <Text style={styles.sheetExplain}>
              {t('waste.detail.co2Intro', {
                grams: details.data ? details.data.co2Info.pieceWeightKg * 1000 : 250,
              })}
            </Text>
            {usedItems.length === 0 ? (
              <Text style={styles.actionSub}>{t('waste.detail.co2Empty')}</Text>
            ) : (
              usedItems.map((item) => (
                <SheetItemRow
                  key={item.id}
                  item={item}
                  right={t('waste.detail.kg', { count: item.co2Kg ?? 0 })}
                />
              ))
            )}
            {details.data ? (
              <View style={styles.factorTable}>
                <Text style={styles.sheetHighlight}>{t('waste.detail.factorsTitle')}</Text>
                {Object.entries(details.data.co2Info.perKgByCategory).map(([key, factor]) => (
                  <View key={key} style={styles.factorRow}>
                    <Text style={styles.factorName}>{t(`waste.co2Categories.${key}`)}</Text>
                    <Text style={styles.factorValue}>{factor}</Text>
                  </View>
                ))}
                <View style={styles.factorRow}>
                  <Text style={styles.factorName}>{t('waste.detail.anythingElse')}</Text>
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
