import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiClient } from '../../src/api/client';
import { useAuthStore } from '../../src/store/auth';
import { colors, font } from '../../src/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [deleting, setDeleting] = useState(false);

  const challenges = useQuery({
    queryKey: ['challenges'],
    queryFn: () => apiClient.getChallenges(),
  });

  const xp = challenges.data?.xp ?? 0;
  const list = challenges.data?.challenges ?? [];
  const completed = list.filter((c) => c.completed).length;

  // RGPD Article 17: wipe the account and everything tied to it, then drop to login.
  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await apiClient.deleteAccount();
              await logout();
            } catch {
              setDeleting(false);
              Alert.alert('Could not delete your account', 'Please try again.');
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.xpCard}>
        <Text style={styles.star}>⭐</Text>
        <View>
          <Text style={styles.xp}>{xp} XP</Text>
          <Text style={styles.xpSub}>
            {completed} / {list.length} challenges done
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.linkCard} onPress={() => router.push('/rewards')}>
        <Text style={styles.linkText}>View all challenges</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {user ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Account</Text>
          <Text style={styles.cardValue}>{user.email}</Text>
          {user.name ? <Text style={styles.cardMuted}>{user.name}</Text> : null}
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => logout()}
        accessibilityRole="button"
      >
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={confirmDelete}
        disabled={deleting}
        accessibilityRole="button"
      >
        <Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete account'}</Text>
      </TouchableOpacity>
      <Text style={styles.deleteHint}>
        Permanently removes your account and all your data (RGPD Article 17).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.softMint },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontFamily: font.black, color: colors.charcoal, paddingTop: 8 },
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
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
  },
  linkText: { fontSize: 15, fontFamily: font.semibold, color: colors.charcoal },
  chevron: { fontSize: 22, color: colors.textMuted },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, gap: 2 },
  cardLabel: {
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardValue: { fontSize: 15, fontFamily: font.semibold, color: colors.charcoal },
  cardMuted: { fontSize: 13, color: colors.textMuted },
  logoutBtn: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  logoutText: { fontSize: 15, fontFamily: font.semibold, color: colors.charcoal },
  deleteBtn: {
    backgroundColor: colors.coralOrange,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteText: { fontSize: 15, fontFamily: font.bold, color: colors.onBrand },
  deleteHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
