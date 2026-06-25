import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type ViewStyle,
} from 'react-native';
import { buttonLip, colors, font, glow as glowToken, radii } from '../theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  // primary is the solid green pill with the 3D lip; ghost is a plain text button
  // for "skip" and secondary actions.
  variant?: 'primary' | 'ghost';
  // soft green halo for the onboarding CTAs
  glow?: boolean;
  style?: ViewStyle;
}

// The one button the auth and onboarding screens use, so they all get the same
// Trashy pill look instead of each redeclaring their own.
export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  glow = false,
  style,
}: PrimaryButtonProps) {
  const isGhost = variant === 'ghost';
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={[
        styles.base,
        isGhost ? styles.ghost : styles.primary,
        glow && !isGhost && styles.glow,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? colors.forestGreen : colors.onBrand} />
      ) : (
        <Text style={isGhost ? styles.ghostText : styles.primaryText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    ...buttonLip,
    backgroundColor: colors.forestGreen,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  glow: {
    boxShadow: `0 0 24px ${glowToken.brand}`,
  },
  disabled: { opacity: 0.6 },
  primaryText: { fontSize: 16, fontFamily: font.black, color: colors.onBrand },
  ghostText: { fontSize: 15, fontFamily: font.bold, color: colors.forestGreen },
});
