import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const COLORS = ['#4CAF50', '#FFD166', '#FF7A59', '#94F990'];

// Precomputed particle layout so the burst looks organic without Math.random().
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  angle: (i / 18) * Math.PI * 2,
  distance: 90 + (i % 5) * 28,
  size: 6 + (i % 3) * 3,
  color: COLORS[i % COLORS.length]!,
  delay: (i % 6) * 40,
}));

type ParticleConfig = (typeof PARTICLES)[number];

function Particle({ angle, distance, size, color, delay }: ParticleConfig) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
    );
  }, [progress, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: progress.value * Math.cos(angle) * distance },
      { translateY: progress.value * (Math.sin(angle) * distance + 60) },
      { rotate: `${progress.value * 200}deg` },
    ],
    opacity: 1 - progress.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

// One-shot confetti burst for the finale. Skipped entirely for reduced motion.
export function ConfettiBurst() {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {PARTICLES.map((particle, i) => (
        <Particle key={i} {...particle} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
