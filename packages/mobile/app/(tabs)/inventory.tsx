import type { StockDisposition, StockItemWithProduct, StockLocation } from '@pantryai/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../src/api/client';
import { ConservationTipCard } from '../../src/components/ConservationTipCard';
import { EXPIRY_COLORS, daysUntil, expiryLabel, expiryLevel } from '../../src/lib/expiry';
import { colors, font } from '../../src/theme';

const LOCATION_ORDER: StockLocation[] = ['FRIDGE', 'FREEZER', 'PANTRY'];

const LOCATION_LABELS: Record<StockLocation, string> = {
  FRIDGE: 'Fridge',
  FREEZER: 'Freezer',
  PANTRY: 'Pantry',
};

// Filter chips at the top of the list. "ALL" shows everything grouped by location.
const FILTERS: { value: StockLocation | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'FRIDGE', label: 'Fridge' },
  { value: 'PANTRY', label: 'Pantry' },
  { value: 'FREEZER', label: 'Freezer' },
];

interface StockSection {
  location: StockLocation;
  title: string;
  data: StockItemWithProduct[];
}

function ExpirationBadge({ expirationDate }: { expirationDate?: string }) {
  const days = daysUntil(expirationDate);
  const level = expiryLevel(days);
  const palette = EXPIRY_COLORS[level];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{expiryLabel(days)}</Text>
    </View>
  );
}

export default function InventoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StockLocation | 'ALL'>('ALL');

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['stocks'],
    queryFn: () => apiClient.listStocks(),
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

  const sections = useMemo<StockSection[]>(() => {
    const items = data?.items ?? [];
    const visible = LOCATION_ORDER.filter((loc) => filter === 'ALL' || filter === loc);
    return visible
      .map((location) => ({
        location,
        title: LOCATION_LABELS[location],
        data: items.filter((item) => item.location === location),
      }))
      .filter((section) => section.data.length > 0);
  }, [data, filter]);

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

  const isEmpty = sections.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/scan')} accessibilityRole="button">
            <Text style={styles.headerLink}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/manual-entry')} accessibilityRole="button">
            <Text style={styles.headerLink}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((tab) => {
          const active = filter === tab.value;
          return (
            <TouchableOpacity
              key={tab.value}
              onPress={() => setFilter(tab.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isEmpty ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>
            {filter === 'ALL'
              ? 'Nothing in stock yet'
              : `Nothing in your ${LOCATION_LABELS[filter]}`}
          </Text>
          <Text style={styles.emptySub}>Scan a barcode or a receipt to add your first items.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/manual-entry')}>
            <Text style={styles.buttonText}>Add manually</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={<ConservationTipCard items={data?.items ?? []} />}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>
              {section.title} ({section.data.length})
            </Text>
          )}
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.product.name}</Text>
                  <Text style={styles.itemMeta}>
                    {item.quantity} {item.unit}
                    {item.product.brand ? ` · ${item.product.brand}` : ''}
                  </Text>
                </View>
                <ExpirationBadge expirationDate={item.expirationDate} />
              </View>
              <View style={styles.itemActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={remove.isPending}
                  onPress={() => remove.mutate({ id: item.id, disposition: 'CONSUMED' })}
                >
                  <Text style={styles.usedAction}>Used it</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={remove.isPending}
                  onPress={() => remove.mutate({ id: item.id, disposition: 'DISCARDED' })}
                >
                  <Text style={styles.tossedAction}>Threw it out</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.softMint,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: font.black,
    color: colors.charcoal,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerLink: {
    fontSize: 14,
    fontFamily: font.semibold,
    color: colors.leafGreen,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.leafGreen,
    borderColor: colors.leafGreen,
  },
  chipText: {
    fontSize: 13,
    fontFamily: font.semibold,
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.onBrand,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: font.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 4,
  },
  itemCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  usedAction: {
    fontSize: 13,
    fontFamily: font.semibold,
    color: colors.leafGreen,
  },
  tossedAction: {
    fontSize: 13,
    fontFamily: font.semibold,
    color: colors.coralOrange,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontFamily: font.semibold,
    color: colors.charcoal,
  },
  itemMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
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
    backgroundColor: colors.leafGreen,
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
});
