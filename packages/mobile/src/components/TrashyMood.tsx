import { MASCOT_SVG, mascotMoodMeta, type WasteMood } from '@pantryai/shared';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { font } from '../theme';

interface TrashyMoodProps {
  mood: WasteMood;
  size?: number;
  // Home shows its own "Status: Good" line, so it can turn the built-in label off.
  showLabel?: boolean;
}

// The Trashy mascot for a given mood, rendered from the shared SVG string.
export function TrashyMood({ mood, size = 120, showLabel = true }: TrashyMoodProps) {
  const meta = mascotMoodMeta[mood];
  return (
    <View
      style={styles.wrap}
      accessibilityRole="image"
      accessibilityLabel={`Trashy looks ${meta.label.toLowerCase()}`}
    >
      <SvgXml xml={MASCOT_SVG[mood]} width={size} height={size} />
      {showLabel ? <Text style={[styles.label, { color: meta.accent }]}>{meta.label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  label: { fontSize: 14, fontFamily: font.bold },
});
