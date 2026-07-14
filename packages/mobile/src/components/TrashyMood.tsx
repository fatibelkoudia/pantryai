import { mascotMoodMeta, type WasteMood } from '@pantryai/shared';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { font } from '../theme';

// The mascot art is one PNG per mood in the shared package. Metro needs the
// requires to be static, so we list them all out.
const MASCOT_IMAGES: Record<WasteMood, ImageSourcePropType> = {
  EXCELLENT: require('../../../shared/src/assets/mascot/trashy_excellent.png'),
  GOOD: require('../../../shared/src/assets/mascot/trashy_good.png'),
  OKAY: require('../../../shared/src/assets/mascot/trashy_okey.png'),
  BAD: require('../../../shared/src/assets/mascot/trashy_bad.png'),
  AWFUL: require('../../../shared/src/assets/mascot/trashy_awful.png'),
};

interface TrashyMoodProps {
  mood: WasteMood;
  size?: number;
  // Home shows its own "Status: Good" line, so it can turn the built-in label off.
  showLabel?: boolean;
}

// The Trashy mascot for a given mood.
export function TrashyMood({ mood, size = 120, showLabel = true }: TrashyMoodProps) {
  const { t } = useTranslation();
  const meta = mascotMoodMeta[mood];
  const label = t(`waste.moods.${mood}`);
  return (
    <View
      style={styles.wrap}
      accessibilityRole="image"
      accessibilityLabel={t('mascot.looks', { mood: label.toLowerCase() })}
    >
      <Image
        source={MASCOT_IMAGES[mood]}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      {showLabel ? <Text style={[styles.label, { color: meta.accent }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  label: { fontSize: 14, fontFamily: font.bold },
});
