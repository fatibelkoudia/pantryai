import type { StockItemWithProduct, StockLocation } from '@pantryai/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../src/api/client';
import { EXPIRY_COLORS, daysUntil, expiryLabel, expiryLevel } from '../../src/lib/expiry';
import { useAuthStore } from '../../src/store/auth';

const LOCATION_ORDER: StockLocation[] = ['FRIDGE', 'FREEZER', 'PANTRY'];

const LOCATION_LABELS: Record<StockLocation, string> = {
  FRIDGE: 'Fridge',
  FREEZER: 'Freezer',
  PANTRY: 'Pantry',
};

interface StockSection {
  location: StockLocation;
  title: string;
  data: StockItemWithProduct[];
}

function ExpirationBadge({ expirationDate }: { expirationDate?: string }) {
  const days = daysUntil(expirationDate);
  const level = expiryLevel(days);
  const colors = EXPIRY_COLORS[level];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.fg }]}>{expiryLabel(days)}</Text>
    </View>
  );
}

export default function StockScreen() {
  const logout = useAuthStore((s) => s.logout);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['stocks'],
    queryFn: () => apiClient.listStocks(),
  });

  const sections = useMemo<StockSection[]>(() => {
    const items = data?.items ?? [];
    return LOCATION_ORDER.map((location) => ({
      location,
      title: LOCATION_LABELS[location],
      data: items.filter((item) => item.location === location),
    })).filter((section) => section.data.length > 0);
  }, [data]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2e7d32" />
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
        <Text style={styles.title}>Your pantry</Text>
        <TouchableOpacity onPress={() => logout()} accessibilityRole="button">
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      {isEmpty ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Nothing in stock yet</Text>
          <Text style={styles.emptySub}>Scan a barcode or a receipt to add your first items.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>
              {section.title} ({section.data.length})
            </Text>
          )}
          renderItem={({ item }) => (
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
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    fontWeight: '700',
    color: '#111',
  },
  logout: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  itemMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
  },
  emptySub: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#c62828',
    textAlign: 'center',
  },
  errorSub: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
