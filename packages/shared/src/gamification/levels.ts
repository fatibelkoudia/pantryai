// XP levels. The XP total maps to a level with a fun title, shown on the Learn
// and Rewards screens. The titles themselves live in the i18n catalogs (keys
// `levels.1` to `levels.6`) so they follow the selected language; here we only
// keep the numbers.
//
// The thresholds are sized to the XP economy: the 25 lessons pay 20 XP each
// (500 XP total) and the weekly challenges pay up to 375 XP per week, so a
// regular user climbs one level every couple of weeks at first and slower later.
export const LEVEL_THRESHOLDS = [0, 150, 400, 800, 1400, 2200] as const;

export interface LevelInfo {
  // 1-based level number
  level: number;
  // i18n key for the level title, like 'levels.2'
  titleKey: string;
  // XP where this level starts
  minXp: number;
  // XP where the next level starts, or null when the user is at the top
  nextLevelXp: number | null;
  // how far the user is between this level and the next, 0 to 1 (1 at the top)
  progressToNext: number;
}

export function getLevel(xp: number): LevelInfo {
  const total = Math.max(0, xp);
  let index = 0;
  LEVEL_THRESHOLDS.forEach((threshold, i) => {
    if (total >= threshold) index = i;
  });

  const minXp = LEVEL_THRESHOLDS[index] ?? 0;
  const nextLevelXp = LEVEL_THRESHOLDS[index + 1] ?? null;
  const progressToNext =
    nextLevelXp === null ? 1 : Math.min(1, (total - minXp) / (nextLevelXp - minXp));

  return {
    level: index + 1,
    titleKey: `levels.${index + 1}`,
    minXp,
    nextLevelXp,
    progressToNext,
  };
}
