import type { WasteMood } from '@pantryai/shared';
import * as Haptics from 'expo-haptics';
import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { colors, font, spacing } from '../../theme';
import { PrimaryButton } from '../PrimaryButton';
import { CountUp } from './CountUp';
import { MascotEntrance } from './MascotEntrance';
import { GlassCard } from './GlassCard';
import { PlayVignette } from './PlayVignette';
import { ReceiptScanVignette } from './ReceiptScanVignette';
import { RescueVignette } from './RescueVignette';

interface Slide {
  mood: WasteMood;
  title: string;
  body: string;
  vignette: ReactNode;
}

// ADEME's figure for food thrown away at home in France, per person per year.
const WASTE_KG_PER_YEAR = 30;

interface OnboardingSlidesProps {
  onDone: () => void;
  // lets the screen tint the aurora coral while the "we waste food" slide is up
  onIndexChange?: (index: number) => void;
}

// The intro story, in four slides: the problem, then scan, rescue and play.
// Trashy's mood follows along, sad at the start and thrilled by the end.
export function OnboardingSlides({ onDone, onIndexChange }: OnboardingSlidesProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(0);

  const slides: Slide[] = [
    {
      mood: 'BAD',
      title: t('onboarding.slides.hookTitle'),
      body: t('onboarding.slides.hookBody'),
      vignette: (
        <View style={styles.hookStat}>
          <CountUp
            to={WASTE_KG_PER_YEAR}
            suffix={t('onboarding.slides.hookStatSuffix')}
            style={styles.hookNumber}
          />
          <Text style={styles.hookLabel}>{t('onboarding.slides.hookStatLabel')}</Text>
        </View>
      ),
    },
    {
      mood: 'OKAY',
      title: t('onboarding.slides.scanTitle'),
      body: t('onboarding.slides.scanBody'),
      vignette: <ReceiptScanVignette />,
    },
    {
      mood: 'GOOD',
      title: t('onboarding.slides.rescueTitle'),
      body: t('onboarding.slides.rescueBody'),
      vignette: <RescueVignette />,
    },
    {
      mood: 'EXCELLENT',
      title: t('onboarding.slides.playTitle'),
      body: t('onboarding.slides.playBody'),
      vignette: <PlayVignette />,
    },
  ];

  function handleMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== indexRef.current) {
      indexRef.current = index;
      void Haptics.selectionAsync();
      onIndexChange?.(index);
    }
  }

  const renderItem = ({ item, index }: ListRenderItemInfo<Slide>) => (
    <View style={[styles.slide, { width }]}>
      <GlassCard style={styles.card}>
        <MascotEntrance mood={item.mood} size={150} />
        {item.vignette}
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
        {index === slides.length - 1 ? (
          <PrimaryButton
            label={t('onboarding.getStarted')}
            onPress={onDone}
            style={styles.cta}
            glow
          />
        ) : null}
      </GlassCard>
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
        onMomentumScrollEnd={handleMomentumEnd}
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
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: { alignItems: 'center', gap: spacing.md },
  hookStat: { alignItems: 'center', gap: spacing.xs },
  hookNumber: { fontSize: 48, fontFamily: font.black, color: colors.coralOrange },
  hookLabel: {
    fontSize: 14,
    fontFamily: font.semibold,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  title: {
    fontSize: 24,
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
  cta: { alignSelf: 'stretch', marginTop: spacing.sm },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  dot: { height: 8, borderRadius: 999 },
});
