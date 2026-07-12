'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { colors, mascotMoodMeta, wasteMoodBands } from '@pantryai/shared';
import { apiClient } from '@/lib/api';
import { WasteWeeklyBars } from './WasteWeeklyBars';

// Max bar height in px, same as the weekly bars.
const BAR_MAX = 48;
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function accentForScore(score: number): string {
  const band = wasteMoodBands.find((b) => score >= b.min);
  return band ? mascotMoodMeta[band.mood].accent : colors.surfaceGray;
}

// 'YYYY-MM' -> 'Mar', with the year added on January so long ranges stay readable.
function monthLabel(month: string, first: boolean): string {
  const mm = Number(month.slice(5));
  const name = MONTHS_SHORT[mm - 1] ?? month;
  if (first || mm === 1) return `${name} ${month.slice(2, 4)}`;
  return name;
}

interface WasteHistoryProps {
  weeklyScores: (number | null)[];
}

// The history block on the mood card: the last 4 weeks by default, or every
// month since the first resolved item. The all-time data is only fetched when
// that tab is opened.
export function WasteHistory({ weeklyScores }: WasteHistoryProps) {
  const [tab, setTab] = useState<'weeks' | 'all'>('weeks');

  const history = useQuery({
    queryKey: ['waste', 'history'],
    queryFn: () => apiClient.getWasteHistory(),
    enabled: tab === 'all',
  });
  const months = history.data?.months ?? [];

  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <div className="flex items-center justify-between">
        <div role="tablist" aria-label="History range" className="flex gap-1">
          {(
            [
              ['weeks', '4 weeks'],
              ['all', 'All time'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                tab === key ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          score /100
        </span>
      </div>
      {tab === 'weeks' ? (
        <WasteWeeklyBars scores={weeklyScores} />
      ) : history.isLoading ? (
        <p className="text-xs text-slate-500">Loading history…</p>
      ) : months.length === 0 ? (
        <p className="text-xs text-slate-500">No history yet. Resolve some items first!</p>
      ) : (
        <div className="w-full overflow-x-auto">
          <div
            role="img"
            aria-label={`Monthly waste scores out of 100. ${months
              .map((m) => `${m.month}: ${m.score === null ? 'no items' : m.score}`)
              .join(', ')}`}
            className="flex items-end gap-3"
          >
            {months.map((m, i) => (
              <div key={m.month} className="flex w-11 shrink-0 flex-col items-center gap-1">
                <span className="text-xs font-bold text-slate-700">
                  {m.score === null ? '–' : m.score}
                </span>
                <div
                  className="w-full rounded-md"
                  style={
                    m.score === null
                      ? { height: 6, background: colors.surfaceGray }
                      : {
                          height: Math.max(6, (m.score / 100) * BAR_MAX),
                          background: accentForScore(m.score),
                        }
                  }
                />
                <span className="whitespace-nowrap text-[10px] text-slate-500">
                  {monthLabel(m.month, i === 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
