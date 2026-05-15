import { mascotMoodMeta } from '@pantryai/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../src/api/client';
import { TrashyMood } from '../../src/components/TrashyMood';
import { WasteGauge } from '../../src/components/WasteGauge';
import { EXPIRY_COLORS, daysUntil, expiryLabel, expiryLevel } from '../../src/lib/expiry';
import { useAuthStore } from '../../src/store/auth';
import { colors, font } from '../../src/theme';

// How many expiring items to preview on Home before sending the user to Inventory.
const EXPIRING_PREVIEW = 4;

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const waste = useQuery({
    queryKey: ['waste'],
    queryFn: () => apiClient.getWasteLevel(),
  });
  const tip = useQuery({
    queryKey: ['learning', 'tip', 'today'],
    queryFn: () => apiClient.getRandomTip(),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const expiring = useQuery({
    queryKey: ['stocks', 'expiring'],
    queryFn: () => apiClient.listStocks({ expiringSoon: true }),
  });

  // user might still be loading, so fall back to a plain hello until we have a name
  const greeting = user?.name ? `Hi, ${user.name}!` : 'Hi there!';
  const expiringItems = expiring.data?.items ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.greetingBlock}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.tagline}>Waste less. Cook more.</Text>
      </View>

      {/* Trashy's mood + Waste Level */}
      <View style={styles.card}>
        {waste.isLoading ? (
          <ActivityIndicator color={colors.leafGreen} />
        ) : waste.data ? (
          <View style={styles.moodCard}>
            <TrashyMood mood={waste.data.mood} size={120} />
            <WasteGauge score={waste.data.score} accent={mascotMoodMeta[waste.data.mood].accent} />
            <Text style={styles.moodMessage}>{mascotMoodMeta[waste.data.mood].message}</Text>
          </View>
        ) : (
          <Text style={styles.muted}>Could not check on Trashy right now.</Text>
        )}
      </View>

      {/* Quick actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.action} onPress={() => router.push('/scan')}>
          <Text style={styles.actionText}>Scan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => router.push('/manual-entry')}>
          <Text style={styles.actionText}>Add</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => router.push('/shopping')}>
          <Text style={styles.actionText}>Shopping</Text>
        </TouchableOpacity>
      </View>

      {/* Today's Tip */}
      {tip.data?.tip ? (
        <View style={styles.tipCard}>
          <Text style={styles.tipLabel}>TODAY&apos;S TIP</Text>
          <Text style={styles.tipTitle}>{tip.data.tip.title}</Text>
          <Text style={styles.tipBody}>{tip.data.tip.body}</Text>
          <Text style={styles.tipSource}>Source: {tip.data.tip.source}</Text>
        </View>
      ) : null}

      {/* Expiring soon */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Expiring soon</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/inventory')}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {expiring.isLoading ? (
        <ActivityIndicator color={colors.leafGreen} />
      ) : expiringItems.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.muted}>Nothing expiring soon. Nice work keeping waste down!</Text>
        </View>
      ) : (
        expiringItems.slice(0, EXPIRING_PREVIEW).map((item) => {
          const days = daysUntil(item.expirationDate);
          const palette = EXPIRY_COLORS[expiryLevel(days)];
          return (
            <View key={item.id} style={styles.expiringRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.product.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} {item.unit}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: palette.bg }]}>
                <Text style={[styles.badgeText, { color: palette.fg }]}>{expiryLabel(days)}</Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.softMint },
  content: { padding: 16, gap: 14 },
  greetingBlock: { paddingTop: 8 },
  greeting: { fontSize: 24, fontFamily: font.black, color: colors.charcoal },
  tagline: { fontSize: 14, fontFamily: font.semibold, color: colors.leafGreen, marginTop: 2 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 20 },
  moodCard: { alignItems: 'center', gap: 12 },
  moodMessage: {
    fontSize: 15,
    fontFamily: font.semibold,
    color: colors.charcoal,
    textAlign: 'center',
  },
  muted: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  action: {
    flex: 1,
    backgroundColor: colors.leafGreen,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionText: { color: colors.onBrand, fontSize: 14, fontFamily: font.bold },
  tipCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, gap: 4 },
  tipLabel: { fontSize: 11, fontFamily: font.bold, color: colors.leafGreen, letterSpacing: 0.5 },
  tipTitle: { fontSize: 15, fontFamily: font.bold, color: colors.charcoal },
  tipBody: { fontSize: 14, color: colors.textMuted },
  tipSource: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 17, fontFamily: font.bold, color: colors.charcoal },
  seeAll: { fontSize: 13, fontFamily: font.semibold, color: colors.leafGreen },
  emptyCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16 },
  expiringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  itemInfo: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 15, fontFamily: font.semibold, color: colors.charcoal },
  itemMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontFamily: font.bold },
});
