import type { WasteMood } from '@pantryai/shared';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { colors, font, spacing } from '../../theme';
import { PrimaryButton } from '../PrimaryButton';
import { TrashyMood } from '../TrashyMood';

interface Slide {
  mood: WasteMood;
  title: string;
  body: string;
}

// The 3 intro slides. Trashy explains what the app does before we ask for anything.
export function OnboardingSlides({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;

  const slides: Slide[] = [
    {
      mood: 'GOOD',
      title: t('onboarding.slides.scanTitle'),
      body: t('onboarding.slides.scanBody'),
    },
    {
      mood: 'OKAY',
      title: t('onboarding.slides.trackTitle'),
      body: t('onboarding.slides.trackBody'),
    },
    {
      mood: 'EXCELLENT',
      title: t('onboarding.slides.cookTitle'),
      body: t('onboarding.slides.cookBody'),
    },
  ];

  const renderItem = ({ item, index }: ListRenderItemInfo<Slide>) => (
    <View style={[styles.slide, { width }]}>
      <TrashyMood mood={item.mood} size={180} showLabel={false} />
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
      {index === slides.length - 1 ? (
        <PrimaryButton label={t('onboarding.getStarted')} onPress={onDone} style={styles.cta} />
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.FlatList
        data={slides}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
      />
      <View style={styles.dots}>
        {slides.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 20, 8],
            extrapolate: 'clamp',
          });
          const backgroundColor = scrollX.interpolate({
            inputRange,
            outputRange: [colors.border, colors.leafGreen, colors.border],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View key={i} style={[styles.dot, { width: dotWidth, backgroundColor }]} />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: 26,
    fontFamily: font.black,
    color: colors.forestGreen,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    fontFamily: font.regular,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  cta: { alignSelf: 'stretch', marginTop: spacing.md },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  dot: { height: 8, borderRadius: 999 },
});
