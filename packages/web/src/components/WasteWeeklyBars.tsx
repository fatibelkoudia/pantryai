import { colors, mascotMoodMeta, wasteMoodBands } from '@pantryai/shared';

// Max bar height in px.
const BAR_MAX = 48;
const WEEK_LABELS = ['3w ago', '2w', '1w', 'now'];

// The mood accent color for a bar, based on that week's score.
function accentForScore(score: number): string {
  const band = wasteMoodBands.find((b) => score >= b.min);
  return band ? mascotMoodMeta[band.mood].accent : colors.surfaceGray;
}

interface WasteWeeklyBarsProps {
  // Score per week, oldest first; null = no items resolved that week.
  scores: (number | null)[];
}

// Four little bars, one per week of the waste window, oldest on the left.
// Quiet weeks get a gray stub instead of a fake perfect score.
export function WasteWeeklyBars({ scores }: WasteWeeklyBarsProps) {
  const summary = scores
    .map((s, i) => `${WEEK_LABELS[i]}: ${s === null ? 'no items' : s}`)
    .join(', ');
  return (
    <div
      role="img"
      aria-label={`Weekly waste scores. ${summary}`}
      className="flex w-full max-w-xs items-end gap-3"
    >
      {scores.map((score, i) => (
        <div key={WEEK_LABELS[i]} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-bold text-slate-700">{score === null ? '–' : score}</span>
          <div
            className="w-full rounded-md"
            style={
              score === null
                ? { height: 6, background: colors.surfaceGray }
                : {
                    height: Math.max(6, (score / 100) * BAR_MAX),
                    background: accentForScore(score),
                  }
            }
          />
          <span className="text-[10px] text-slate-500">{WEEK_LABELS[i]}</span>
        </div>
      ))}
    </div>
  );
}
