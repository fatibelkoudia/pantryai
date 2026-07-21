import { Ionicons } from '@expo/vector-icons';
import type { Lesson, Locale, TipCategory } from '@pantryai/shared';
import { getLevel, TIP_CATEGORIES } from '@pantryai/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';
import { LessonSheet } from '../../src/components/LessonSheet';
import { TrashyMood } from '../../src/components/TrashyMood';
import type { IoniconName } from '../../src/lib/foodIcons';
import { buttonLip, colors, font } from '../../src/theme';

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
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language.startsWith('fr') ? 'fr' : 'en';

  const [filter, setFilter] = useState<Filter>('all');
  const [openTipId, setOpenTipId] = useState<string | null>(null);

  // one unfiltered query; the category chips just filter client-side (25 items)
  const lessons = useQuery({
    queryKey: ['learning', 'lessons', locale],
    queryFn: () => apiClient.getLessons(undefined, locale),
  });
  // Same key as Home so the daily tip is the same everywhere. The server picks it
  // from the date, so a refetch can never change it mid-day.
  const dailyTip = useQuery({
    queryKey: ['learning', 'tip', 'today', locale],
    queryFn: () => apiClient.getDailyTip(locale),
    staleTime: 60 * 60 * 1000,
  });
  const challenges = useQuery({
    queryKey: ['challenges'],
    queryFn: () => apiClient.getChallenges(),
  });
  const waste = useQuery({
    queryKey: ['waste'],
    queryFn: () => apiClient.getWasteLevel(),
  });

  const allLessons = lessons.data?.lessons ?? [];
  const items = filter === 'all' ? allLessons : allLessons.filter((l) => l.category === filter);
  const completedCount = lessons.data?.completedCount ?? 0;
  const totalCount = lessons.data?.totalCount ?? 0;

  const xp = challenges.data?.xp ?? 0;
  const streak = challenges.data?.streak ?? 0;
  const streakActiveToday = challenges.data?.streakActiveToday ?? false;
  const challengeList = challenges.data?.challenges ?? [];
  const level = getLevel(xp);
  const levelTitle = t(level.titleKey);

  const mission = dailyTip.data?.tip ?? null;
  const missionDone = mission ? allLessons.some((l) => l.id === mission.id && l.completed) : false;

  const showStreakInfo = () => {
    const status = streakActiveToday ? t('streak.activeToday') : t('streak.notYetToday');
    Alert.alert(t('streak.title'), `${t('streak.body')}\n\n${status}`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title}>{t('learn.title')}</Text>
          <Text style={styles.subtitle}>{t('learn.subtitle')}</Text>
        </View>
        <View style={styles.headerPills}>
          <TouchableOpacity
            style={[styles.streakPill, !streakActiveToday && styles.streakPillDim]}
            onPress={showStreakInfo}
            accessibilityRole="button"
            accessibilityLabel={t('streak.days', { count: streak })}
          >
            <Text style={styles.streakPillText}>🔥 {streak}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.xpPill}
            onPress={() => router.push('/rewards')}
            accessibilityRole="button"
            accessibilityLabel={t('learn.rewardsA11y')}
          >
            <Text style={styles.xpPillText}>⭐ {xp} XP</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(lesson) => lesson.id}
        contentContainerStyle={styles.list}
        onRefresh={() => {
          void lessons.refetch();
          void challenges.refetch();
        }}
        refreshing={lessons.isRefetching}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Today's mission: the daily tip as a startable lesson */}
            {mission ? (
              <View style={styles.heroCard}>
                <View style={styles.heroTop}>
                  <View style={styles.heroIcon}>
                    <Ionicons
                      name={missionDone ? 'checkmark-circle' : 'sparkles-outline'}
                      size={20}
                      color={colors.forestGreen}
                    />
                  </View>
                  <View style={styles.heroXpChip}>
                    <Text style={styles.heroXpChipText}>{t('learn.xpChip', { count: 20 })}</Text>
                  </View>
                </View>
                <Text style={styles.heroKicker}>{t('learn.missionKicker')}</Text>
                <Text style={styles.heroTitle}>{mission.title}</Text>
                {missionDone ? <Text style={styles.heroBody}>{t('learn.missionDone')}</Text> : null}
                <TouchableOpacity
                  style={styles.heroButton}
                  onPress={() => setOpenTipId(mission.id)}
                  accessibilityRole="button"
                >
                  <Text style={styles.heroButtonText}>
                    {missionDone ? t('learn.reviewLesson') : t('learn.startLesson')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Level and lessons progress */}
            <View style={styles.pathCard}>
              <View style={styles.pathHeader}>
                <Text style={styles.pathLabel}>
                  {t('learn.levelTitle', { level: level.level, title: levelTitle })}
                </Text>
                <Text style={styles.pathCount}>
                  {t('learn.lessonsDone', { done: completedCount, total: totalCount })}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(level.progressToNext * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.pathHint}>
                {level.nextLevelXp === null
                  ? t('learn.topLevel')
                  : t('learn.xpToNext', { count: level.nextLevelXp - xp })}
              </Text>
            </View>

            {/* Weekly challenges, reset every Monday */}
            {challengeList.length > 0 ? (
              <View style={styles.challengesBlock}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('learn.weeklyChallenges')}</Text>
                  <Text style={styles.sectionHint}>{t('learn.resetsMonday')}</Text>
                </View>
                {challengeList.map((challenge) => {
                  const pct =
                    challenge.target > 0
                      ? Math.min(100, (challenge.progress / challenge.target) * 100)
                      : 0;
                  return (
                    <TouchableOpacity
                      key={challenge.key}
                      style={styles.challengeCard}
                      onPress={() => router.push('/rewards')}
                      accessibilityRole="button"
                    >
                      <View style={styles.challengeRow}>
                        <Text style={styles.challengeTitle} numberOfLines={1}>
                          {t(`challenges.${challenge.key}.title`, {
                            defaultValue: challenge.title,
                          })}
                        </Text>
                        <View style={styles.xpChip}>
                          <Text style={styles.xpChipText}>
                            {t('learn.xpChip', { count: challenge.xp })}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.challengeBody} numberOfLines={2}>
                        {t(`challenges.${challenge.key}.description`, {
                          defaultValue: challenge.description,
                        })}
                      </Text>
                      <View style={styles.challengeFooter}>
                        <View style={styles.challengeTrack}>
                          <View style={[styles.challengeFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.challengeProgress}>
                          {challenge.completed
                            ? t('learn.challengeDone')
                            : `${challenge.progress}/${challenge.target}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
                      {t(`learn.categories.${cat}`)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        }
        ListEmptyComponent={
          lessons.isLoading ? (
            <ActivityIndicator size="large" color={colors.leafGreen} style={styles.spinner} />
          ) : lessons.isError ? (
            <View style={styles.centered}>
              <Text style={styles.errorTitle}>{t('learn.loadError')}</Text>
              <TouchableOpacity style={styles.button} onPress={() => lessons.refetch()}>
                <Text style={styles.buttonText}>{t('learn.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.muted}>{t('learn.empty')}</Text>
          )
        }
        renderItem={({ item: lesson }) => (
          <LessonCard lesson={lesson} onOpen={() => setOpenTipId(lesson.id)} />
        )}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.banner}
            onPress={() => router.push('/mood')}
            accessibilityRole="button"
            accessibilityLabel={t('learn.trashyTitle')}
          >
            {waste.data ? <TrashyMood mood={waste.data.mood} size={64} showLabel={false} /> : null}
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>{t('learn.trashyTitle')}</Text>
              <Text style={styles.bannerBody}>{t('learn.trashyBody')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.brickRed} />
          </TouchableOpacity>
        }
      />

      <LessonSheet tipId={openTipId} onClose={() => setOpenTipId(null)} />
    </View>
  );
}

// One lesson in the list. Done lessons show a check and go quiet; the rest show
// a Start pill inviting the tap.
function LessonCard({ lesson, onOpen }: { lesson: Lesson; onOpen: () => void }) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      style={[styles.card, lesson.completed && styles.cardDone]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityState={{ selected: lesson.completed }}
    >
      <View style={[styles.cardIcon, lesson.completed && styles.cardIconDone]}>
        <Ionicons
          name={lesson.completed ? 'checkmark' : CATEGORY_ICONS[lesson.category]}
          size={20}
          color={lesson.completed ? colors.forestGreen : colors.charcoal}
        />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardKicker}>{t(`learn.categories.${lesson.category}`)}</Text>
        <Text style={[styles.cardTitle, lesson.completed && styles.cardTitleDone]}>
          {lesson.title}
        </Text>
        <Text style={styles.cardXp}>
          {lesson.completed
            ? t('learn.xpEarned', { count: lesson.xp })
            : t('learn.xpChip', { count: lesson.xp })}
        </Text>
      </View>
      {!lesson.completed ? (
        <View style={styles.startPill}>
          <Text style={styles.startPillText}>{t('learn.startLesson')}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
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
  // takes the leftover space so a long title/subtitle wraps instead of squishing the pills
  headerTitleWrap: { flex: 1, paddingRight: 8 },
  title: { fontSize: 22, fontFamily: font.black, color: colors.forestGreen },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  // flexShrink 0 keeps the streak + xp pills at full width so the xp badge never gets cut off
  headerPills: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  streakPill: {
    backgroundColor: colors.redTint,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  streakPillDim: { backgroundColor: colors.surfaceGray, opacity: 0.7 },
  streakPillText: { fontSize: 13, fontFamily: font.bold, color: colors.redText },
  xpPill: {
    backgroundColor: colors.sunnyYellow,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  xpPillText: { fontSize: 13, fontFamily: font.bold, color: colors.amberText },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  listHeader: { gap: 12, marginBottom: 4 },
  heroCard: { backgroundColor: colors.heroMint, borderRadius: 20, padding: 16, gap: 6 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroXpChip: {
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroXpChipText: { fontSize: 12, fontFamily: font.bold, color: colors.amberText },
  heroKicker: {
    fontSize: 12,
    fontFamily: font.bold,
    color: colors.forestGreen,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  heroTitle: { fontSize: 17, fontFamily: font.bold, color: colors.charcoal },
  heroBody: { fontSize: 13, color: colors.textMuted },
  heroButton: {
    ...buttonLip,
    backgroundColor: colors.forestGreen,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  heroButtonText: { color: colors.onBrand, fontSize: 14, fontFamily: font.bold },
  pathCard: { backgroundColor: colors.white, borderRadius: 20, padding: 16, gap: 10 },
  pathHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pathLabel: { fontSize: 15, fontFamily: font.bold, color: colors.charcoal },
  pathCount: { fontSize: 12, fontFamily: font.bold, color: colors.forestGreen },
  pathHint: { fontSize: 12, color: colors.textMuted },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.creamSurface,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.leafGreen },
  challengesBlock: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 17, fontFamily: font.bold, color: colors.charcoal },
  sectionHint: { fontSize: 11, color: colors.textMuted },
  challengeCard: { backgroundColor: colors.white, borderRadius: 16, padding: 14, gap: 6 },
  challengeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  challengeTitle: { flex: 1, fontSize: 14, fontFamily: font.bold, color: colors.charcoal },
  challengeBody: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  challengeFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  challengeTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.creamSurface,
    overflow: 'hidden',
  },
  challengeFill: { height: '100%', borderRadius: 999, backgroundColor: colors.sunnyYellow },
  challengeProgress: { fontSize: 12, fontFamily: font.bold, color: colors.forestGreen },
  xpChip: {
    backgroundColor: colors.sunnyYellow,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  xpChipText: { fontSize: 11, fontFamily: font.bold, color: colors.amberText },
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
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
  },
  cardDone: { opacity: 0.75 },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.creamSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconDone: { backgroundColor: colors.softMint },
  cardText: { flex: 1, gap: 2 },
  cardKicker: {
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.forestGreen,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: { fontSize: 15, fontFamily: font.bold, color: colors.charcoal },
  cardTitleDone: { color: colors.textMuted },
  cardXp: { fontSize: 12, fontFamily: font.semibold, color: colors.amberText, marginTop: 2 },
  startPill: {
    backgroundColor: colors.leafGreen,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  startPillText: { fontSize: 12, fontFamily: font.bold, color: colors.onBrand },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.redTint,
    borderRadius: 20,
    padding: 16,
    marginTop: 8,
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
