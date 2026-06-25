import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { glass, radii, spacing } from '../../theme';

interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Frosted-looking card for the onboarding: translucent white over the aurora blobs,
// a hairline border and a soft green shadow. No real blur on purpose, Android blur
// is still costly and the pastel background makes this look the same.
export function GlassCard({ children, style }: GlassCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: glass.bg,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: radii.card,
    padding: spacing.lg,
    boxShadow: '0 8px 32px rgba(0, 110, 28, 0.10)',
    elevation: 4,
  },
});
