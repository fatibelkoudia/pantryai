import { getLevel, LEVEL_THRESHOLDS } from '@pantryai/shared';
import { describe, expect, it } from 'vitest';

describe('getLevel', () => {
  it('starts everyone at level 1', () => {
    expect(getLevel(0)).toMatchObject({ level: 1, titleKey: 'levels.1', minXp: 0 });
    // negative totals can't happen, but the function shouldn't blow up on them
    expect(getLevel(-50).level).toBe(1);
  });

  it('levels up exactly on the threshold', () => {
    expect(getLevel(149).level).toBe(1);
    expect(getLevel(150).level).toBe(2);
    expect(getLevel(150).titleKey).toBe('levels.2');
  });

  it('reports the XP needed for the next level', () => {
    const info = getLevel(200);
    expect(info.level).toBe(2);
    expect(info.nextLevelXp).toBe(400);
    // 200 is 50 XP into the 150..400 band, so a fifth of the way
    expect(info.progressToNext).toBeCloseTo(0.2);
  });

  it('caps out at the top level', () => {
    const top = getLevel(99_999);
    expect(top.level).toBe(LEVEL_THRESHOLDS.length);
    expect(top.nextLevelXp).toBeNull();
    expect(top.progressToNext).toBe(1);
  });

  it('walks through every threshold in order', () => {
    LEVEL_THRESHOLDS.forEach((threshold, index) => {
      expect(getLevel(threshold).level).toBe(index + 1);
    });
  });
});
