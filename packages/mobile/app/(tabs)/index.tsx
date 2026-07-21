import { Ionicons } from '@expo/vector-icons';
import { getAvatarPreset, mascotMoodMeta, type Locale } from '@pantryai/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';
import { AvatarImage } from '../../src/components/AvatarImage';
import { TrashyMood } from '../../src/components/TrashyMood';
import { EXPIRY_COLORS, daysUntil, expiryLabel, expiryLevel } from '../../src/lib/expiry';
import { categoryIcon } from '../../src/lib/foodIcons';
import { useAuthStore } from '../../src/store/auth';
import { buttonLip, colors, font } from '../../src/theme';

// How many "Use Soon" items to preview before sending the user to the full list.
const EXPIRING_PREVIEW = 3;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language.startsWith('fr') ? 'fr' : 'en';

  const waste = useQuery({
    queryKey: ['waste'],
    queryFn: () => apiClient.getWasteLevel(),
  });
  // The server picks the daily tip from the date, so everyone sees the same one
  // all day. The locale is part of the key so switching language refetches it.
  const tip = useQuery({
    queryKey: ['learning', 'tip', 'today', locale],
    queryFn: () => apiClient.getDailyTip(locale),
    staleTime: 60 * 60 * 1000,
  });
  const expiring = useQuery({
    queryKey: ['stocks', 'expiring'],
    queryFn: () => apiClient.listStocks({ expiringSoon: true }),
  });
  // Same key as the Recipes tab so both screens share the cached suggestions.
  const recipes = useQuery({
    queryKey: ['recipes'],
    queryFn: () => apiClient.suggestRecipes(),
  });
  // the match rule is a user setting now, the empty-state text has to follow it
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
  });
  const matchPercent = Math.round((settings.data?.recipeMatchThreshold ?? 0.7) * 100);

  // user might still be loading, so fall back to a plain hello until we have a name
  const firstName = user?.name?.trim().split(/\s+/)[0];
  // always show the avatar art (defaults to the classic one) so the header matches the profile page
  const avatar = getAvatarPreset(user?.avatarId ?? null);
  const expiringItems = expiring.data?.items ?? [];
  const topSuggestion = recipes.data?.suggestions[0];
  const mood = waste.data ? mascotMoodMeta[waste.data.mood] : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header stays pinned while the cards below scroll */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.avatar, { backgroundColor: avatar.bg }]}
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel={t('home.openProfileA11y')}
        >
          <AvatarImage id={avatar.id} size={36} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>
            {firstName
              ? t('home.greetingMobile', { name: firstName })
              : t('home.greetingMobileGeneric')}
          </Text>
          <Text style={styles.tagline}>{t('home.taglineMobile')}</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/expiring')}
          accessibilityRole="button"
          accessibilityLabel={t('home.seeExpiringA11y')}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.forestGreen} />
          {/* little red badge showing how many items are expiring soon */}
          {expiringItems.length > 0 ? (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {expiringItems.length > 9 ? '9+' : expiringItems.length}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Scan shortcuts: the two ways to add food, front and center */}
        <View style={styles.scanRow}>
          <TouchableOpacity
            style={styles.scanPrimary}
            onPress={() => router.push({ pathname: '/scan', params: { mode: 'receipt' } })}
            accessibilityRole="button"
          >
            <View style={styles.scanIconOnBrand}>
              <Ionicons name="receipt-outline" size={22} color={colors.onBrand} />
            </View>
            <Text style={styles.scanPrimaryText}>{t('home.scanReceipt')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.scanSecondary}
            onPress={() => router.push({ pathname: '/scan', params: { mode: 'ean' } })}
            accessibilityRole="button"
          >
            <View style={styles.scanIconTinted}>
              <Ionicons name="barcode-outline" size={22} color={colors.forestGreen} />
            </View>
            <Text style={styles.scanSecondaryText}>{t('home.scanBarcode')}</Text>
          </TouchableOpacity>
        </View>

        {/* Trashy's mood + Waste Level */}
        <View style={styles.card}>
          {waste.isLoading ? (
            <ActivityIndicator color={colors.leafGreen} />
          ) : waste.data && mood ? (
            <View style={styles.moodCard}>
              <TouchableOpacity
                onPress={() => router.push('/mood')}
                accessibilityRole="button"
                accessibilityLabel={t('home.moodDetailsA11y')}
              >
                <TrashyMood mood={waste.data.mood} size={130} showLabel={false} />
              </TouchableOpacity>
              <Text style={styles.statusTitle}>
                {t('home.status', { label: t(`waste.moods.${waste.data.mood}`) })}
              </Text>
              <Text style={styles.moodMessage}>{t(`waste.messages.${waste.data.mood}`)}</Text>
              <View
                style={styles.wasteTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(waste.data.score) }}
                accessibilityLabel={t('waste.gaugeLabel')}
              >
                <View
                  style={[
                    styles.wasteFill,
                    {
                      width: `${Math.max(0, Math.min(100, Math.round(waste.data.score)))}%`,
                      backgroundColor: mood.accent,
                    },
                  ]}
                />
              </View>
              <TouchableOpacity style={styles.cta} onPress={() => router.push('/(tabs)/recipes')}>
                <Text style={styles.ctaText}>{t('learn.trashyTitle')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.muted}>{t('home.couldNotCheckTrashy')}</Text>
          )}
        </View>

        {/* Use Soon */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('home.useSoon')}</Text>
          <TouchableOpacity onPress={() => router.push('/expiring')}>
            <Text style={styles.seeAll}>{t('home.seeAll')}</Text>
          </TouchableOpacity>
        </View>

        {expiring.isLoading ? (
          <ActivityIndicator color={colors.leafGreen} />
        ) : expiringItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.muted}>{t('home.nothingExpiring')}</Text>
          </View>
        ) : (
          expiringItems.slice(0, EXPIRING_PREVIEW).map((item) => {
            const days = daysUntil(item.expirationDate);
            const palette = EXPIRY_COLORS[expiryLevel(days)];
            return (
              <View key={item.id} style={styles.expiringRow}>
                <View style={[styles.itemIcon, { backgroundColor: palette.bg }]}>
                  <Ionicons
                    name={categoryIcon(item.product.category)}
                    size={20}
                    color={palette.fg}
                  />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.product.name}</Text>
                  <Text style={styles.itemMeta}>
                    {t(`locations.${item.location}`)} · {item.quantity} {item.unit}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.badgeText, { color: palette.fg }]}>
                    {expiryLabel(days, t)}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        {/* Cook with what you have: best recipe match for the current stock */}
        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>{t('home.cookWithStock')}</Text>
        {recipes.isLoading ? (
          <ActivityIndicator color={colors.leafGreen} />
        ) : topSuggestion ? (
          <View style={styles.recipeCard}>
            {topSuggestion.recipe.imageUrl ? (
              <View>
                <Image
                  source={{ uri: topSuggestion.recipe.imageUrl }}
                  style={styles.recipeImage}
                  resizeMode="cover"
                />
                <View style={styles.matchPill}>
                  <Text style={styles.matchText}>
                    {t('recipe.match', { percent: Math.round(topSuggestion.score * 100) })}
                  </Text>
                </View>
              </View>
            ) : null}
            <View style={styles.recipeBody}>
              <Text style={styles.recipeTitle}>{topSuggestion.recipe.name}</Text>
              <View style={styles.haveRow}>
                <View style={styles.haveCount}>
                  <Text style={styles.haveCountText}>
                    {topSuggestion.matchedIngredients.length}
                  </Text>
                </View>
                <Text style={styles.haveText}>
                  {t('home.alreadyHave', {
                    matched: topSuggestion.matchedIngredients.length,
                    total: topSuggestion.recipe.ingredients.length,
                  })}
                </Text>
              </View>
              <TouchableOpacity style={styles.cta} onPress={() => router.push('/(tabs)/recipes')}>
                <Text style={styles.ctaText}>{t('home.cookThis')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.muted}>{t('home.noRecipeMatch', { percent: matchPercent })}</Text>
            <TouchableOpacity
              style={styles.cta}
              onPress={() => router.push('/(tabs)/recipes')}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>{t('home.browseRecipes')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Today's Tip */}
        {tip.data?.tip ? (
          <View style={styles.tipCard}>
            <View style={styles.tipIcon}>
              <Ionicons name="bulb-outline" size={20} color={colors.forestGreen} />
            </View>
            <View style={styles.tipBody}>
              <Text style={styles.tipLabel}>{t('home.todaysTip')}</Text>
              <Text style={styles.tipTitle}>{tip.data.tip.title}</Text>
              <Text style={styles.tipText}>{tip.data.tip.body}</Text>
              <Text style={styles.tipSource}>
                {t('tip.source', { source: tip.data.tip.source })}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.warmCream },
  scroll: { flex: 1 },
  // big bottom padding so the last card clears the tab bar and isn't cut off
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100, gap: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.leafGreen,
    borderWidth: 2,
    borderColor: colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerText: { flex: 1 },
  greeting: { fontSize: 18, fontFamily: font.black, color: colors.forestGreen },
  tagline: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // sits on the top-right corner of the bell, cream border so it pops off the button
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    paddingHorizontal: 4,
    backgroundColor: colors.brickRed,
    borderWidth: 2,
    borderColor: colors.warmCream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: { color: colors.onBrand, fontSize: 10, fontFamily: font.bold },
  scanRow: { flexDirection: 'row', gap: 10 },
  scanPrimary: {
    ...buttonLip,
    flex: 1,
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.forestGreen,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  scanSecondary: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  scanIconOnBrand: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanIconTinted: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.heroMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanPrimaryText: {
    color: colors.onBrand,
    fontSize: 13,
    fontFamily: font.bold,
    textAlign: 'center',
  },
  scanSecondaryText: {
    color: colors.charcoal,
    fontSize: 13,
    fontFamily: font.bold,
    textAlign: 'center',
  },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 20 },
  moodCard: { alignItems: 'center', gap: 6 },
  statusTitle: { fontSize: 20, fontFamily: font.black, color: colors.charcoal },
  moodMessage: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  wasteTrack: {
    width: '100%',
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.warmGray,
    overflow: 'hidden',
    marginTop: 8,
  },
  wasteFill: { height: '100%', borderRadius: 999 },
  cta: {
    ...buttonLip,
    width: '100%',
    backgroundColor: colors.forestGreen,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  ctaText: { color: colors.onBrand, fontSize: 14, fontFamily: font.bold },
  muted: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 17, fontFamily: font.bold, color: colors.charcoal },
  sectionSpacing: { marginTop: 4 },
  seeAll: { fontSize: 13, fontFamily: font.semibold, color: colors.forestGreen },
  emptyCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, gap: 4 },
  expiringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontFamily: font.semibold, color: colors.charcoal },
  itemMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontFamily: font.bold },
  recipeCard: { backgroundColor: colors.white, borderRadius: 16, overflow: 'hidden' },
  recipeImage: { width: '100%', height: 160 },
  matchPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  matchText: { fontSize: 12, fontFamily: font.bold, color: colors.charcoal },
  recipeBody: { padding: 16, gap: 8 },
  recipeTitle: { fontSize: 17, fontFamily: font.bold, color: colors.charcoal },
  haveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  haveCount: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.leafGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haveCountText: { color: colors.onBrand, fontSize: 11, fontFamily: font.bold },
  haveText: { flex: 1, fontSize: 13, color: colors.textMuted },
  tipCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.heroMint,
    borderRadius: 16,
    padding: 16,
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipBody: { flex: 1, gap: 2 },
  tipLabel: { fontSize: 12, fontFamily: font.bold, color: colors.forestGreen, letterSpacing: 0.5 },
  tipTitle: { fontSize: 15, fontFamily: font.bold, color: colors.charcoal },
  tipText: { fontSize: 14, color: colors.textMuted },
  tipSource: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
});
