'use client';

import { motion, useReducedMotion } from 'framer-motion';

const COLORS = ['#4CAF50', '#FFD166', '#FF7A59', '#94F990'];

// Precomputed particle layout so the burst looks organic without Math.random(),
// which would break between server and client renders.
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  angle: (i / 18) * Math.PI * 2,
  distance: 90 + (i % 5) * 28,
  size: 6 + (i % 3) * 3,
  color: COLORS[i % COLORS.length]!,
  delay: (i % 6) * 0.04,
}));

// One-shot confetti burst for the finale. Skipped entirely for reduced motion.
export function ConfettiBurst() {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      {PARTICLES.map((particle, i) => (
        <motion.span
          key={i}
          className="absolute rounded-sm"
          style={{
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: Math.cos(particle.angle) * particle.distance,
            y: Math.sin(particle.angle) * particle.distance + 60,
            opacity: 0,
            rotate: 200,
          }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: particle.delay }}
        />
      ))}
    </div>
  );
}
