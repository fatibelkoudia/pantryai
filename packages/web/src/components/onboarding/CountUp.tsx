'use client';

import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface CountUpProps {
  to: number;
  suffix?: string;
  className?: string;
}

// Counts from 0 up to a number when it appears. We write into the DOM node directly
// so React doesn't re-render 60 times a second. Jumps straight to the end for
// reduced motion.
export function CountUp({ to, suffix, className = '' }: CountUpProps) {
  const numberRef = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = numberRef.current;
    if (!node) return;
    if (reduce) {
      node.textContent = String(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 1.6,
      ease: 'easeOut',
      onUpdate: (value) => {
        node.textContent = String(Math.round(value));
      },
    });
    return () => controls.stop();
  }, [to, reduce]);

  return (
    <span className={className}>
      <span ref={numberRef}>0</span>
      {suffix ? <span> {suffix}</span> : null}
    </span>
  );
}
