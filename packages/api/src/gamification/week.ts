// Day and week boundaries for streaks and weekly challenges. Our users are in
// France, so days and weeks follow the Paris clock no matter where the server
// runs. Everything in here is pure date maths so it's easy to test.

export const APP_TIMEZONE = 'Europe/Paris';

const DAY_MS = 24 * 60 * 60 * 1000;

// en-CA is the locale that formats dates as YYYY-MM-DD out of the box
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const wallClockFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

// The Paris calendar day of an instant, as "YYYY-MM-DD". This is the unit the
// streak counts in.
export function dayKey(date: Date): string {
  return dayFormatter.format(date);
}

// The day before a day key. Pure calendar maths on the key itself, no timezone
// involved, so walking backwards through a streak is safe across DST changes.
export function previousDayKey(key: string): string {
  const [y = 0, m = 1, d = 1] = key.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d) - DAY_MS);
  return prev.toISOString().slice(0, 10);
}

// The ISO week an instant falls in (Paris time), as "2026-W28". This is the key
// weekly challenge progress is stored under.
export function weekKey(date: Date): string {
  const { y, m, d } = parisDateParts(date);
  // standard ISO trick: the week belongs to the year of its Thursday
  const thursday = new Date(Date.UTC(y, m - 1, d));
  const dayNum = thursday.getUTCDay() || 7;
  thursday.setUTCDate(thursday.getUTCDate() + 4 - dayNum);
  const isoYear = thursday.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

// The instant the current Paris week started (Monday 00:00 in Paris). Used to
// window challenge signals to this week only.
export function weekStart(date: Date): Date {
  const monday = mondayOf(date);
  return parisMidnight(monday.y, monday.m, monday.d);
}

// The instant the current Paris week ends (next Monday 00:00 in Paris). The app
// shows this as "resets Monday".
export function weekEnd(date: Date): Date {
  const monday = mondayOf(date);
  const next = new Date(Date.UTC(monday.y, monday.m - 1, monday.d, 12) + 7 * DAY_MS);
  return parisMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

function parisDateParts(date: Date): { y: number; m: number; d: number } {
  const [y = 0, m = 1, d = 1] = dayKey(date).split('-').map(Number);
  return { y, m, d };
}

// The Monday of the Paris week the instant falls in, as calendar parts. We step
// through days at noon UTC so a DST switch can never push us into the wrong day.
function mondayOf(date: Date): { y: number; m: number; d: number } {
  const { y, m, d } = parisDateParts(date);
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const dayNum = noon.getUTCDay() || 7;
  const monday = new Date(noon.getTime() - (dayNum - 1) * DAY_MS);
  return { y: monday.getUTCFullYear(), m: monday.getUTCMonth() + 1, d: monday.getUTCDate() };
}

// The UTC instant of midnight in Paris on the given calendar date. We start from
// UTC midnight and shift by the Paris offset, twice, in case the first shift
// crossed a DST change.
function parisMidnight(y: number, m: number, d: number): Date {
  const utcMidnight = Date.UTC(y, m - 1, d);
  let guess = new Date(utcMidnight);
  for (let i = 0; i < 2; i++) {
    guess = new Date(utcMidnight - parisOffsetMs(guess));
  }
  return guess;
}

// How far ahead of UTC the Paris wall clock is at a given instant (1h in winter,
// 2h in summer), found by reading that instant back through the formatter.
function parisOffsetMs(at: Date): number {
  const wall = wallClockFormatter.format(at);
  const match = /(\d{4})-(\d{2})-(\d{2}),? (\d{2}):(\d{2}):(\d{2})/.exec(wall);
  if (!match) return 0;
  const [, y = '0', m = '1', d = '1', h = '0', min = '0', s = '0'] = match;
  const asUtc = Date.UTC(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(h) === 24 ? 0 : Number(h),
    Number(min),
    Number(s),
  );
  return asUtc - at.getTime();
}
