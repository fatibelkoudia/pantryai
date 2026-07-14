interface AuroraBackgroundProps {
  // 'problem' swaps the yellow blob for a coral one, used on the "we waste food" slide
  tone?: 'problem' | 'solution';
}

// Three big blurred color blobs drifting slowly behind the onboarding. The drift is
// pure CSS (transform only) so it costs almost nothing, and motion-safe turns it off
// for people who asked their OS for less motion.
export function AuroraBackground({ tone = 'solution' }: AuroraBackgroundProps) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-[20%] -left-[15%] h-[60vmax] w-[60vmax] rounded-full bg-mint-hero opacity-55 blur-3xl motion-safe:animate-aurora-a" />
      <div className="absolute top-[30%] -right-[10%] h-[45vmax] w-[45vmax] rounded-full bg-green-pale opacity-30 blur-3xl motion-safe:animate-aurora-b" />
      <div
        className={`absolute -bottom-[15%] left-[10%] h-[50vmax] w-[50vmax] rounded-full blur-3xl transition-colors duration-1000 motion-safe:animate-aurora-c ${
          tone === 'problem' ? 'bg-coral opacity-15' : 'bg-sunny opacity-20'
        }`}
      />
    </div>
  );
}
