import { mascotMoodMeta } from '@pantryai/shared';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiClient } from '../src/api/client';
import { TrashyMood } from '../src/components/TrashyMood';
import { WasteGauge } from '../src/components/WasteGauge';
import { colors, font } from '../src/theme';

// "Trashy's Mood" screen: the Waste Level over the last 30 days.
export default function MoodScreen() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['waste'],
    queryFn: () => apiClient.getWasteLevel(),
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.leafGreen} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not check on Trashy</Text>
        <TouchableOpacity style={styles.button} onPress={() => refetch()}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { score, mood, counts } = data;
  const meta = mascotMoodMeta[mood];

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <TrashyMood mood={mood} size={140} />
        <WasteGauge score={score} accent={meta.accent} />
        <Text style={styles.message}>{meta.message}</Text>
        {counts.total > 0 ? (
          <Text style={styles.counts}>
            Last 30 days: {counts.consumed} used · {counts.discarded} thrown out · {counts.expired}{' '}
            expired
          </Text>
        ) : (
          <Text style={styles.counts}>
            No items resolved yet. Mark what you use or toss to see your level move.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.softMint, padding: 16 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softMint,
    gap: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  message: { fontSize: 15, fontFamily: font.semibold, color: colors.charcoal, textAlign: 'center' },
  counts: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  errorTitle: { fontSize: 16, fontFamily: font.bold, color: colors.charcoal, textAlign: 'center' },
  button: {
    backgroundColor: colors.leafGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: { color: colors.onBrand, fontSize: 15, fontFamily: font.semibold },
});
