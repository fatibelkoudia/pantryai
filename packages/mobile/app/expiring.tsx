import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../src/api/client';
import { EXPIRY_COLORS, daysUntil, expiryLabel, expiryLevel } from '../src/lib/expiry';

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

export default function ExpiringScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['stocks', 'expiring'],
    queryFn: () => apiClient.listStocks({ expiringSoon: true }),
  });

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
        <Text style={styles.errorTitle}>Could not load expiring items</Text>
        <Text style={styles.errorSub}>
          {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => refetch()}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Nothing expiring soon</Text>
        <Text style={styles.emptySub}>
          You&apos;re all caught up. Nice work keeping waste down!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
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
    backgroundColor: '#fff',
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
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
