import { previousDayKey } from './week.js';

// The daily streak: how many days in a row the user did something anti-waste.
// `activityDays` are Paris day keys ("YYYY-MM-DD") with at least one activity
// (a finished lesson or a consumed stock item). A streak that ended yesterday
// still counts today, the flame just shows as "not lit yet" via `activeToday`,
// so users don't wake up to a zero every morning.
export function computeStreak(
  activityDays: Iterable<string>,
  todayKey: string,
): { streak: number; activeToday: boolean } {
  const days = new Set(activityDays);
  const activeToday = days.has(todayKey);

  let cursor = activeToday ? todayKey : previousDayKey(todayKey);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }

  return { streak, activeToday };
}
