import { Ionicons } from '@expo/vector-icons';
import type {
  StockDisposition,
  StockItemWithProduct,
  StockLocation,
  UpdateStockItemDto,
} from '@pantryai/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';
import { ConservationTipCard } from '../../src/components/ConservationTipCard';
import { EditStockSheet } from '../../src/components/EditStockSheet';
import { TrashyMood } from '../../src/components/TrashyMood';
import { EXPIRY_COLORS, daysUntil, expiryLabel, expiryLevel } from '../../src/lib/expiry';
import { categoryIcon } from '../../src/lib/foodIcons';
import { buttonLip, colors, font } from '../../src/theme';

// Segmented tabs under the header. "ALL" shows everything.
const LOCATION_TABS: (StockLocation | 'ALL')[] = ['ALL', 'FRIDGE', 'PANTRY', 'FREEZER'];

// Freshness chips. Tapping the active one again clears the filter.
type Freshness = 'SOON' | 'FRESH' | 'EXPIRED';
const FRESHNESS_CHIPS: { value: Freshness; labelKey: string }[] = [
  { value: 'SOON', labelKey: 'stock.useSoonChip' },
  { value: 'FRESH', labelKey: 'stock.freshChip' },
  { value: 'EXPIRED', labelKey: 'stock.expiredChip' },
];

function ExpirationBadge({ expirationDate }: { expirationDate?: string }) {
  const { t } = useTranslation();
  const days = daysUntil(expirationDate);
  const level = expiryLevel(days);
  const palette = EXPIRY_COLORS[level];
  // "Safe" reads friendlier than a raw day count for items that are fine.
  const label = level === 'ok' ? t('expiry.safe') : expiryLabel(days, t);
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export default function InventoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<StockLocation | 'ALL'>('ALL');
  const [freshness, setFreshness] = useState<Freshness | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<StockItemWithProduct | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['stocks'],
    queryFn: () => apiClient.listStocks(),
  });
  // For the impact card: Trashy's mood + how much got used vs tossed (last 30 days).
  const waste = useQuery({
    queryKey: ['waste'],
    queryFn: () => apiClient.getWasteLevel(),
  });

  const remove = useMutation({
    mutationFn: ({ id, disposition }: { id: string; disposition: StockDisposition }) =>
      apiClient.deleteStock(id, disposition),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stocks'] });
      // Resolving an item moves the Waste Level, so refresh Trashy's mood too.
      void queryClient.invalidateQueries({ queryKey: ['waste'] });
      // It can also complete a challenge (e.g. Use It All), so refresh XP/challenges.
      void queryClient.invalidateQueries({ queryKey: ['challenges'] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateStockItemDto }) =>
      apiClient.updateStock(id, dto),
    onSuccess: () => {
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['stocks'] });
    },
    onError: (err) => {
      Alert.alert(t('stock.updateFailed'), err instanceof Error ? err.message : t('common.error'));
    },
  });

  const allItems = useMemo(() => data?.items ?? [], [data]);

  // Alerts = anything expired or expiring soon, regardless of the active filters.
  const alertCount = useMemo(
    () =>
      allItems.filter((item) => {
        const level = expiryLevel(daysUntil(item.expirationDate));
        return level === 'soon' || level === 'urgent' || level === 'expired';
      }).length,
    [allItems],
  );

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allItems
      .filter((item) => location === 'ALL' || item.location === location)
      .filter((item) => {
        if (!freshness) return true;
        const level = expiryLevel(daysUntil(item.expirationDate));
        if (freshness === 'SOON') return level === 'soon' || level === 'urgent';
        if (freshness === 'EXPIRED') return level === 'expired';
        return level === 'ok' || level === 'none';
      })
      .filter((item) => {
        if (!query) return true;
        const haystack = `${item.product.name} ${item.product.brand ?? ''}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        // most urgent first, items without a date at the end
        const da = daysUntil(a.expirationDate);
        const db = daysUntil(b.expirationDate);
        if (da === null && db === null) return a.product.name.localeCompare(b.product.name);
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
  }, [allItems, location, freshness, search]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.leafGreen} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>{t('stock.loadErrorTitle')}</Text>
        <Text style={styles.errorSub}>
          {error instanceof Error ? error.message : t('common.unknownError')}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => refetch()}>
          <Text style={styles.buttonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const usedCount = waste.data?.counts.consumed ?? 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('stock.inventory')}</Text>
          <Text style={styles.subtitle}>{t('stock.everythingAtHome')}</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/scan')}
          accessibilityRole="button"
          accessibilityLabel={t('home.openScannerA11y')}
        >
          <Ionicons name="scan-outline" size={20} color={colors.forestGreen} />
        </TouchableOpacity>
      </View>

      {/* Location segmented tabs */}
      <View style={styles.segmented}>
        {LOCATION_TABS.map((tab) => {
          const active = location === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setLocation(tab)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {t(`locations.${tab}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Impact card: stock at a glance + Trashy's take on it */}
            <View style={styles.impactCard}>
              <View style={styles.impactLeft}>
                <Text style={styles.impactTitle}>{t('stock.yourImpact')}</Text>
                <Text style={styles.impactSub}>
                  {alertCount > 0
                    ? t('stock.needAttention', { count: alertCount })
                    : t('stock.doingGreat')}
                </Text>
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: colors.forestGreen }]}>
                      {allItems.length}
                    </Text>
                    <Text style={styles.statLabel}>{t('stock.items')}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: colors.brickRed }]}>{alertCount}</Text>
                    <Text style={styles.statLabel}>{t('stock.alerts')}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: colors.amberText }]}>{usedCount}</Text>
                    <Text style={styles.statLabel}>{t('stock.used')}</Text>
                  </View>
                </View>
              </View>
              {waste.data ? (
                <View style={styles.impactRight}>
                  <TrashyMood mood={waste.data.mood} size={64} showLabel={false} />
                  <View style={styles.bubble}>
                    <Text style={styles.bubbleText}>
                      {alertCount > 0 ? `"${t('stock.letsSave')}"` : `"${t('stock.lookingFresh')}"`}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Search */}
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={t('stock.searchFoodPlaceholder')}
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
              />
            </View>

            {/* Freshness chips */}
            <View style={styles.chipsRow}>
              {FRESHNESS_CHIPS.map((chip) => {
                const active = freshness === chip.value;
                return (
                  <TouchableOpacity
                    key={chip.value}
                    onPress={() => setFreshness(active ? null : chip.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {t(chip.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            {allItems.length === 0 ? (
              <>
                <Text style={styles.emptyTitle}>{t('stock.nothingInStock')}</Text>
                <Text style={styles.emptySub}>{t('stock.scanToAdd')}</Text>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => router.push('/manual-entry')}
                >
                  <Text style={styles.buttonText}>{t('stock.addManually')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.emptySub}>{t('stock.noFilterMatch')}</Text>
            )}
          </View>
        }
        ListFooterComponent={<ConservationTipCard items={allItems} />}
        renderItem={({ item }) => (
          <InventoryCard
            item={item}
            busy={remove.isPending}
            onResolve={(disposition) => remove.mutate({ id: item.id, disposition })}
            onRecipe={() => router.push('/(tabs)/recipes')}
            onEdit={() => setEditing(item)}
          />
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/manual-entry')}
        accessibilityRole="button"
        accessibilityLabel={t('stock.addA11y')}
      >
        <Ionicons name="add" size={22} color={colors.onBrand} />
        <Text style={styles.fabText}>{t('common.add')}</Text>
      </TouchableOpacity>

      <EditStockSheet
        item={editing}
        saving={update.isPending}
        onClose={() => setEditing(null)}
        onSave={(id, dto) => update.mutate({ id, dto })}
      />
    </View>
  );
}

function InventoryCard({
  item,
  busy,
  onResolve,
  onRecipe,
  onEdit,
}: {
  item: StockItemWithProduct;
  busy: boolean;
  onResolve: (disposition: StockDisposition) => void;
  onRecipe: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const days = daysUntil(item.expirationDate);
  const level = expiryLevel(days);

  // One contextual primary action per card: toss what's gone, use what's about to
  // go, get a recipe for the rest of the week, quietly mark the safe stuff.
  let primary: { labelKey: string; style: 'urgent' | 'outline' | 'neutral'; onPress: () => void };
  if (level === 'expired') {
    primary = { labelKey: 'stock.tossIt', style: 'urgent', onPress: () => onResolve('DISCARDED') };
  } else if (level === 'urgent') {
    primary = { labelKey: 'stock.useToday', style: 'urgent', onPress: () => onResolve('CONSUMED') };
  } else if (level === 'soon') {
    primary = { labelKey: 'stock.recipe', style: 'outline', onPress: onRecipe };
  } else {
    primary = {
      labelKey: 'stock.markAsUsed',
      style: 'neutral',
      onPress: () => onResolve('CONSUMED'),
    };
  }

  // The dispositions the primary button doesn't cover stay as small text links,
  // so "Used it" / "Threw it out" are always one tap away. "Toss it" is expired,
  // "Recipe" is soon; both leave the used link showing.
  const showUsedLink = level === 'expired' || level === 'soon';
  const showTossLink = level !== 'expired';

  return (
    <View style={styles.itemCard}>
      <TouchableOpacity
        style={styles.itemTop}
        onPress={onEdit}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('stock.editItemA11y', { name: item.product.name })}
      >
        <View style={styles.itemImageBox}>
          {item.product.imageUrl ? (
            <Image
              source={{ uri: item.product.imageUrl }}
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : (
            <Ionicons
              name={categoryIcon(item.product.category)}
              size={24}
              color={colors.textMuted}
            />
          )}
        </View>
        <View style={styles.itemInfo}>
          <View style={styles.itemNameRow}>
            <Text style={styles.itemName}>{item.product.name}</Text>
            <ExpirationBadge expirationDate={item.expirationDate} />
          </View>
          <Text style={styles.itemMeta}>
            {t(`locations.${item.location}`)} · {item.quantity} {item.unit}
            {item.product.brand ? ` · ${item.product.brand}` : ''}
          </Text>
        </View>
        <Ionicons name="create-outline" size={18} color={colors.textMuted} />
      </TouchableOpacity>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            primary.style === 'urgent' && styles.primaryBtnUrgent,
            primary.style === 'outline' && styles.primaryBtnOutline,
            primary.style === 'neutral' && styles.primaryBtnNeutral,
          ]}
          onPress={primary.onPress}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.primaryBtnText,
              primary.style === 'urgent' && styles.primaryBtnTextUrgent,
              primary.style === 'outline' && styles.primaryBtnTextOutline,
              primary.style === 'neutral' && styles.primaryBtnTextNeutral,
            ]}
          >
            {t(primary.labelKey)}
          </Text>
        </TouchableOpacity>
        {showUsedLink ? (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onResolve('CONSUMED')}
          >
            <Text style={styles.usedAction}>{t('stock.usedIt')}</Text>
          </TouchableOpacity>
        ) : null}
        {showTossLink ? (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onResolve('DISCARDED')}
          >
            <Text style={styles.tossedAction}>{t('stock.threwOut')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.warmCream,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
    backgroundColor: colors.warmCream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 22,
    fontFamily: font.black,
    color: colors.forestGreen,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 1,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 4,
    backgroundColor: colors.creamSurface,
    borderRadius: 16,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.leafGreen,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: font.semibold,
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.onBrand,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 10,
  },
  listHeader: {
    gap: 12,
    marginBottom: 4,
  },
  impactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  impactLeft: {
    flex: 1,
    // lets the stats row shrink to fit instead of pushing into the mascot column
    minWidth: 0,
    gap: 4,
  },
  impactTitle: {
    fontSize: 18,
    fontFamily: font.bold,
    color: colors.charcoal,
  },
  impactSub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 8,
  },
  stat: {
    gap: 1,
  },
  statValue: {
    fontSize: 20,
    fontFamily: font.black,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: font.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  impactRight: {
    // fixed width + no shrink so the mascot and its bubble stay in their own lane
    // and never overlap the stats on the left
    width: 84,
    flexShrink: 0,
    alignItems: 'center',
    gap: 4,
  },
  bubble: {
    backgroundColor: colors.heroMint,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 84,
  },
  bubbleText: {
    fontSize: 10,
    fontFamily: font.bold,
    color: colors.charcoal,
    textAlign: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.creamSurface,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: font.regular,
    color: colors.charcoal,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceGray,
  },
  chipActive: {
    backgroundColor: colors.redTint,
  },
  chipText: {
    fontSize: 13,
    fontFamily: font.semibold,
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.redText,
  },
  itemCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemImageBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.creamSurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontFamily: font.bold,
    color: colors.charcoal,
  },
  itemMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnUrgent: {
    ...buttonLip,
    backgroundColor: colors.brickRed,
  },
  primaryBtnOutline: {
    borderWidth: 1.5,
    borderColor: colors.forestGreen,
  },
  primaryBtnNeutral: {
    ...buttonLip,
    backgroundColor: colors.surfaceGray,
  },
  primaryBtnText: {
    fontSize: 13,
    fontFamily: font.bold,
  },
  primaryBtnTextUrgent: {
    color: colors.onBrand,
  },
  primaryBtnTextOutline: {
    color: colors.forestGreen,
  },
  primaryBtnTextNeutral: {
    color: colors.textMuted,
  },
  usedAction: {
    fontSize: 13,
    fontFamily: font.semibold,
    color: colors.forestGreen,
  },
  tossedAction: {
    fontSize: 13,
    fontFamily: font.semibold,
    color: colors.brickRed,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: font.bold,
  },
  emptyBox: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: font.bold,
    color: colors.charcoal,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: font.bold,
    color: colors.coralOrange,
    textAlign: 'center',
  },
  errorSub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  button: {
    ...buttonLip,
    backgroundColor: colors.forestGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonText: {
    color: colors.onBrand,
    fontSize: 15,
    fontFamily: font.semibold,
  },
  fab: {
    ...buttonLip,
    position: 'absolute',
    right: 16,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.forestGreen,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: colors.charcoal,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabText: {
    color: colors.onBrand,
    fontSize: 15,
    fontFamily: font.bold,
  },
});
