import type { TipCategory } from '@pantryai/shared';
import { TIP_CATEGORIES } from '@pantryai/shared';
import { useQuery } from '@tanstack/react-query';
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
import { colors, font } from '../../src/theme';

// Friendlier labels for the raw category slugs the API uses.
const CATEGORY_LABELS: Record<TipCategory, string> = {
  fruits: 'Fruit',
  legumes: 'Veg',
  'produits-laitiers': 'Dairy',
  viande: 'Meat & fish',
  cereales: 'Grains',
};

type Filter = TipCategory | 'all';

export default function LearnScreen() {
  const [filter, setFilter] = useState<Filter>('all');

  const tips = useQuery({
    queryKey: ['learning', 'tips', filter],
    queryFn: () => apiClient.getTips(filter === 'all' ? undefined : filter),
  });

  const items = tips.data?.tips ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Learn</Text>
        <Text style={styles.subtitle}>Conservation tips to keep food fresh and waste low.</Text>
      </View>

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

      {tips.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.leafGreen} />
        </View>
      ) : tips.isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Could not load tips</Text>
          <TouchableOpacity style={styles.button} onPress={() => tips.refetch()}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(tip) => tip.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: tip }) => (
            <View style={styles.card}>
              <Text style={styles.cardKicker}>{CATEGORY_LABELS[tip.category]}</Text>
              <Text style={styles.cardTitle}>{tip.title}</Text>
              <Text style={styles.cardBody}>{tip.body}</Text>
              <Text style={styles.cardSource}>Source: {tip.source}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.muted}>No tips in this category yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.softMint },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontFamily: font.black, color: colors.charcoal },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  chips: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.leafGreen, borderColor: colors.leafGreen },
  chipText: { fontSize: 13, fontFamily: font.semibold, color: colors.textMuted },
  chipTextActive: { color: colors.onBrand },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, gap: 4 },
  cardKicker: {
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.leafGreen,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: { fontSize: 15, fontFamily: font.bold, color: colors.charcoal },
  cardBody: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  cardSource: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  muted: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingTop: 24 },
  errorTitle: { fontSize: 16, fontFamily: font.bold, color: colors.charcoal, textAlign: 'center' },
  button: {
    backgroundColor: colors.leafGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: { color: colors.onBrand, fontSize: 15, fontFamily: font.semibold },
});
