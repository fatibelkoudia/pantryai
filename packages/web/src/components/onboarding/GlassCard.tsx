import type { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

// Frosted card that floats over the aurora background: translucent white, a hairline
// that catches the light, and a soft green shadow.
export function GlassCard({ children, className = '' }: GlassCardProps) {
  return (
    <div
      className={`rounded-card border border-glass-border bg-glass shadow-glass backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}
