import type { WasteMood } from '@pantryai/shared';
import Animated, { Easing, FadeIn, useReducedMotion } from 'react-native-reanimated';
import { TrashyMood } from '../TrashyMood';

interface MascotEntranceProps {
  mood: WasteMood;
  size?: number;
}

// Trashy fading in with the rest of the content. No idle bobbing and no spring
// on purpose, we tried a bouncy version and it read as childish, not alive.
export function MascotEntrance({ mood, size = 150 }: MascotEntranceProps) {
  const reduce = useReducedMotion();
  return (
    <Animated.View
      {...(reduce ? {} : { entering: FadeIn.duration(300).easing(Easing.out(Easing.cubic)) })}
    >
      <TrashyMood mood={mood} size={size} showLabel={false} />
    </Animated.View>
  );
}
