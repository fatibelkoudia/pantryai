import { MASCOT_SVG, mascotMoodMeta, type WasteMood } from '@pantryai/shared';

interface TrashyMoodProps {
  mood: WasteMood;
  size?: number;
}

// Renders the Trashy mascot for a given mood. The SVG markup is our own (from the
// shared theme), so inlining it is safe.
export function TrashyMood({ mood, size = 120 }: TrashyMoodProps) {
  const meta = mascotMoodMeta[mood];
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        style={{ width: size, height: size }}
        role="img"
        aria-label={`Trashy looks ${meta.label.toLowerCase()}`}
        dangerouslySetInnerHTML={{ __html: MASCOT_SVG[mood] }}
      />
      <span className="text-sm font-bold" style={{ color: meta.accent }}>
        {meta.label}
      </span>
    </div>
  );
}
