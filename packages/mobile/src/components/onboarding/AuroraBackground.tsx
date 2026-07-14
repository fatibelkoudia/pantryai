import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme';

interface BlobProps {
  color: string;
  size: number;
  top: number;
  left: number;
  driftX: number;
  driftY: number;
  duration: number;
  reduce: boolean;
}

// One soft color blob drifting back and forth. Transform-only so it stays cheap,
// and the boxShadow feathers the edge since we have no blur here.
function Blob({ color, size, top, left, driftX, driftY, duration, reduce }: BlobProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [progress, duration, reduce]);

  const drift = useAnimatedStyle(() => ({
    transform: [
      { translateX: progress.value * driftX },
      { translateY: progress.value * driftY },
      { scale: 1 + progress.value * 0.12 },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top,
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          boxShadow: `0 0 80px 40px ${color}`,
        },
        drift,
      ]}
    />
  );
}

interface AuroraBackgroundProps {
  // 'problem' swaps the yellow blob for a coral one, used while the "we waste food"
  // slide is on screen
  tone?: 'problem' | 'solution';
}

// The drifting mint/green/yellow blobs behind the whole onboarding. Sits behind a
// transparent SafeAreaView, never catches touches, and holds still for reduced motion.
export function AuroraBackground({ tone = 'solution' }: AuroraBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[colors.heroMint, colors.warmCream]}
        style={StyleSheet.absoluteFill}
      />
      <Blob
        color="rgba(232, 247, 224, 0.55)"
        size={320}
        top={-80}
        left={-90}
        driftX={40}
        driftY={50}
        duration={18000}
        reduce={reduce}
      />
      <Blob
        color="rgba(148, 249, 144, 0.30)"
        size={260}
        top={height * 0.35}
        left={width - 130}
        driftX={-45}
        driftY={-40}
        duration={22000}
        reduce={reduce}
      />
      <Blob
        color={tone === 'problem' ? 'rgba(255, 122, 89, 0.15)' : 'rgba(255, 209, 102, 0.22)'}
        size={300}
        top={height - 160}
        left={width * 0.1}
        driftX={50}
        driftY={-35}
        duration={26000}
        reduce={reduce}
      />
    </View>
  );
}
