import type { ChallengeProgress } from '@pantryai/shared';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../src/api/client';
import { buttonLip, colors, font } from '../src/theme';

// "Rewards" screen. Shows the XP total, the Trashy challenges with their progress,
// and Today's Tip at the bottom. Loading GET /challenges also hands out XP for
// anything the user just finished.
export default function RewardsScreen() {
  const challenges = useQuery({
    queryKey: ['challenges'],
    queryFn: () => apiClient.getChallenges(),
  });
  const tip = useQuery({
    queryKey: ['learning', 'tip', 'today'],
    queryFn: () => apiClient.getRandomTip(),
    staleTime: 24 * 60 * 60 * 1000,
  });

  if (challenges.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.leafGreen} />
      </View>
    );
  }

  if (challenges.isError || !challenges.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not load your challenges</Text>
        <TouchableOpacity style={styles.button} onPress={() => challenges.refetch()}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { xp, challenges: list } = challenges.data;
  const completed = list.filter((c) => c.completed).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.xpCard}>
        <Text style={styles.star}>⭐</Text>
        <View>
          <Text style={styles.xp}>{xp} XP</Text>
          <Text style={styles.xpSub}>
            {completed} / {list.length} challenges done
          </Text>
        </View>
      </View>

      {list.map((challenge) => (
        <ChallengeRow key={challenge.key} challenge={challenge} />
      ))}

      {tip.data?.tip ? (
        <View style={styles.tipCard}>
          <Text style={styles.tipLabel}>TODAY&apos;S TIP</Text>
          <Text style={styles.tipTitle}>{tip.data.tip.title}</Text>
          <Text style={styles.tipBody}>{tip.data.tip.body}</Text>
          <Text style={styles.tipSource}>Source: {tip.data.tip.source}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function ChallengeRow({ challenge }: { challenge: ChallengeProgress }) {
  const pct =
    challenge.target > 0 ? Math.min(100, (challenge.progress / challenge.target) * 100) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{challenge.title}</Text>
          <Text style={styles.cardDesc}>{challenge.description}</Text>
        </View>
        {challenge.completed ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>+{challenge.xp} XP ✓</Text>
          </View>
        ) : (
          <Text style={styles.reward}>+{challenge.xp} XP</Text>
        )}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {challenge.progress} / {challenge.target}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.warmCream },
  content: { padding: 16, gap: 12 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warmCream,
    gap: 12,
  },
  xpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
  },
  star: { fontSize: 32 },
  xp: { fontSize: 26, fontFamily: font.bold, color: colors.charcoal },
  xpSub: { fontSize: 13, color: colors.textMuted },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cardHeaderText: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: font.bold, color: colors.charcoal },
  cardDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  badge: {
    backgroundColor: colors.sunnyYellow,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontFamily: font.bold, color: colors.charcoal },
  reward: { fontSize: 13, fontFamily: font.semibold, color: colors.textMuted },
  track: { height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: colors.sunnyYellow },
  progressText: { fontSize: 12, color: colors.textMuted, textAlign: 'right' },
  tipCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, gap: 4 },
  tipLabel: { fontSize: 11, fontFamily: font.bold, color: colors.leafGreen, letterSpacing: 0.5 },
  tipTitle: { fontSize: 15, fontFamily: font.bold, color: colors.charcoal },
  tipBody: { fontSize: 14, color: colors.textMuted },
  tipSource: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  errorTitle: { fontSize: 16, fontFamily: font.bold, color: colors.charcoal, textAlign: 'center' },
  button: {
    ...buttonLip,
    backgroundColor: colors.leafGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: { color: colors.onBrand, fontSize: 15, fontFamily: font.semibold },
});
