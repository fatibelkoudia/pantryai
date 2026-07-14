import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

interface CountUpProps {
  to: number;
  suffix?: string;
  style?: StyleProp<TextStyle>;
}

// Counts from 0 up to a number when the slide appears. Plain requestAnimationFrame
// is plenty here, it's one number on one screen. Jumps straight to the end for
// reduced motion.
export function CountUp({ to, suffix, style }: CountUpProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce) {
      setDisplay(to);
      return;
    }
    const start = Date.now();
    const duration = 1600;
    let raf = 0;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * to));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, reduce]);

  return (
    <Text style={style}>
      {display}
      {suffix ? ` ${suffix}` : ''}
    </Text>
  );
}
