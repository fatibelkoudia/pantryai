import type { StockItemWithProduct } from '@pantryai/shared';
import { resolveTipCategory } from '@pantryai/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiClient } from '../api/client';
import { getTipsDisabled, setTipsDisabled } from '../lib/tips';

interface ConservationTipCardProps {
  items: StockItemWithProduct[];
}

// One conservation tip at the top of the pantry list. We pick a category from
// what the user has in stock so the tip is relevant, and let them hide it for now
// or turn tips off for good (risk F5).
export function ConservationTipCard({ items }: ConservationTipCardProps) {
  const [disabled, setDisabled] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Load the saved on/off preference once.
  useEffect(() => {
    getTipsDisabled().then(setDisabled);
  }, []);

  // First product we can map to a tip category, so the tip matches the stock.
  const category = useMemo(() => {
    for (const item of items) {
      const resolved = resolveTipCategory(item.product);
      if (resolved) return resolved;
    }
    return null;
  }, [items]);

  const active = disabled === false && !dismissed;

  const tip = useQuery({
    queryKey: ['learning', 'tip', category ?? 'any'],
    queryFn: () => apiClient.getRandomTip(category ?? undefined),
    enabled: active,
    staleTime: 60 * 60 * 1000,
  });

  if (!active || !tip.data?.tip) return null;

  const { title, body, source } = tip.data.tip;

  async function hideTips() {
    await setTipsDisabled(true);
    setDisabled(true);
  }

  return (
    <View style={styles.card} accessibilityLabel="Conservation tip">
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>Conservation tip</Text>
        <TouchableOpacity onPress={() => setDismissed(true)} accessibilityRole="button">
          <Text style={styles.dismiss}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.footerRow}>
        <Text style={styles.source}>Source: {source}</Text>
        <TouchableOpacity onPress={hideTips} accessibilityRole="button">
          <Text style={styles.hide}>Hide tips</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f1f8f2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2e7d32',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dismiss: {
    fontSize: 14,
    color: '#999',
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 4,
  },
  body: {
    fontSize: 13,
    color: '#444',
    marginTop: 4,
    lineHeight: 19,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  source: {
    fontSize: 11,
    color: '#999',
    flex: 1,
    marginRight: 8,
  },
  hide: {
    fontSize: 11,
    color: '#999',
    textDecorationLine: 'underline',
  },
});
