import { Ionicons } from '@expo/vector-icons';
import type { StockDisposition, StockItemWithProduct, StockLocation } from '@pantryai/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../src/api/client';
import { ConservationTipCard } from '../../src/components/ConservationTipCard';
import { TrashyMood } from '../../src/components/TrashyMood';
import { EXPIRY_COLORS, daysUntil, expiryLabel, expiryLevel } from '../../src/lib/expiry';
import { categoryIcon } from '../../src/lib/foodIcons';
import { colors, font } from '../../src/theme';

const LOCATION_LABELS: Record<StockLocation, string> = {
  FRIDGE: 'Fridge',
  FREEZER: 'Freezer',
  PANTRY: 'Pantry',
};

// Segmented tabs under the header. "ALL" shows everything.
const LOCATION_TABS: { value: StockLocation | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'FRIDGE', label: 'Fridge' },
  { value: 'PANTRY', label: 'Pantry' },
  { value: 'FREEZER', label: 'Freezer' },
];

// Freshness chips. Tapping the active one again clears the filter.
type Freshness = 'SOON' | 'FRESH' | 'EXPIRED';
const FRESHNESS_CHIPS: { value: Freshness; label: string }[] = [
  { value: 'SOON', label: 'Use soon' },
  { value: 'FRESH', label: 'Fresh' },
  { value: 'EXPIRED', label: 'Expired' },
];

function ExpirationBadge({ expirationDate }: { expirationDate?: string }) {
  const days = daysUntil(expirationDate);
  const level = expiryLevel(days);
  const palette = EXPIRY_COLORS[level];
  // "Safe" reads friendlier than a raw day count for items that are fine.
  const label = level === 'ok' ? 'Safe' : expiryLabel(days);
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export default function InventoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<StockLocation | 'ALL'>('ALL');
  const [freshness, setFreshness] = useState<Freshness | null>(null);
  const [search, setSearch] = useState('');

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
        <Text style={styles.errorTitle}>Could not load your stock</Text>
        <Text style={styles.errorSub}>
          {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => refetch()}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const usedCount = waste.data?.counts.consumed ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inventory</Text>
          <Text style={styles.subtitle}>Everything you have at home</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/scan')}
          accessibilityRole="button"
          accessibilityLabel="Scan a receipt"
        >
          <Ionicons name="scan-outline" size={20} color={colors.forestGreen} />
        </TouchableOpacity>
      </View>

      {/* Location segmented tabs */}
      <View style={styles.segmented}>
        {LOCATION_TABS.map((tab) => {
          const active = location === tab.value;
          return (
            <TouchableOpacity
              key={tab.value}
              onPress={() => setLocation(tab.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {tab.label}
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
                <Text style={styles.impactTitle}>Your impact</Text>
                <Text style={styles.impactSub}>
                  {alertCount > 0
                    ? `${alertCount} item${alertCount > 1 ? 's' : ''} need attention`
                    : "You're doing great!"}
                </Text>
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: colors.forestGreen }]}>
                      {allItems.length}
                    </Text>
                    <Text style={styles.statLabel}>Items</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: colors.brickRed }]}>{alertCount}</Text>
                    <Text style={styles.statLabel}>Alerts</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: colors.amberText }]}>{usedCount}</Text>
                    <Text style={styles.statLabel}>Used</Text>
                  </View>
                </View>
              </View>
              {waste.data ? (
                <View style={styles.impactRight}>
                  <TrashyMood mood={waste.data.mood} size={72} showLabel={false} />
                  <View style={styles.bubble}>
                    <Text style={styles.bubbleText}>
                      {alertCount > 0 ? '"Let\'s save these!"' : '"Looking fresh!"'}
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
                placeholder="Search food item"
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
                      {chip.label}
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
                <Text style={styles.emptyTitle}>Nothing in stock yet</Text>
                <Text style={styles.emptySub}>
                  Scan a barcode or a receipt to add your first items.
                </Text>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => router.push('/manual-entry')}
                >
                  <Text style={styles.buttonText}>Add manually</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.emptySub}>Nothing matches your filters.</Text>
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
          />
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/manual-entry')}
        accessibilityRole="button"
        accessibilityLabel="Add an item"
      >
        <Ionicons name="add" size={22} color={colors.onBrand} />
        <Text style={styles.fabText}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

function InventoryCard({
  item,
  busy,
  onResolve,
  onRecipe,
}: {
  item: StockItemWithProduct;
  busy: boolean;
  onResolve: (disposition: StockDisposition) => void;
  onRecipe: () => void;
}) {
  const days = daysUntil(item.expirationDate);
  const level = expiryLevel(days);

  // One contextual primary action per card: toss what's gone, use what's about to
  // go, get a recipe for the rest of the week, quietly mark the safe stuff.
  let primary: { label: string; style: 'urgent' | 'outline' | 'neutral'; onPress: () => void };
  if (level === 'expired') {
    primary = { label: 'Toss it', style: 'urgent', onPress: () => onResolve('DISCARDED') };
  } else if (level === 'urgent') {
    primary = { label: 'Use today', style: 'urgent', onPress: () => onResolve('CONSUMED') };
  } else if (level === 'soon') {
    primary = { label: 'Recipe', style: 'outline', onPress: onRecipe };
  } else {
    primary = { label: 'Mark as used', style: 'neutral', onPress: () => onResolve('CONSUMED') };
  }

  // The dispositions the primary button doesn't cover stay as small text links,
  // so "Used it" / "Threw it out" are always one tap away.
  const showUsedLink = primary.label === 'Toss it' || primary.label === 'Recipe';
  const showTossLink = primary.label !== 'Toss it';

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemTop}>
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
            {LOCATION_LABELS[item.location]} · {item.quantity} {item.unit}
            {item.product.brand ? ` · ${item.product.brand}` : ''}
          </Text>
        </View>
      </View>
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
            {primary.label}
          </Text>
        </TouchableOpacity>
        {showUsedLink ? (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onResolve('CONSUMED')}
          >
            <Text style={styles.usedAction}>Used it</Text>
          </TouchableOpacity>
        ) : null}
        {showTossLink ? (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onResolve('DISCARDED')}
          >
            <Text style={styles.tossedAction}>Threw it out</Text>
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
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  impactLeft: {
    flex: 1,
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
    alignItems: 'center',
    gap: 4,
  },
  bubble: {
    backgroundColor: colors.heroMint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 110,
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
    backgroundColor: colors.brickRed,
  },
  primaryBtnOutline: {
    borderWidth: 1.5,
    borderColor: colors.forestGreen,
  },
  primaryBtnNeutral: {
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
