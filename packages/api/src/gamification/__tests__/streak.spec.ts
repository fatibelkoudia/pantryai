import { describe, expect, it } from 'vitest';
import { computeStreak } from '../streak.js';

const TODAY = '2026-07-12';

describe('computeStreak', () => {
  it('is zero with no activity at all', () => {
    expect(computeStreak([], TODAY)).toEqual({ streak: 0, activeToday: false });
  });

  it('counts a single active day', () => {
    expect(computeStreak([TODAY], TODAY)).toEqual({ streak: 1, activeToday: true });
  });

  it('counts consecutive days ending today', () => {
    const days = ['2026-07-10', '2026-07-11', TODAY];
    expect(computeStreak(days, TODAY)).toEqual({ streak: 3, activeToday: true });
  });

  it('keeps a run that ended yesterday alive (grace until midnight)', () => {
    const days = ['2026-07-10', '2026-07-11'];
    expect(computeStreak(days, TODAY)).toEqual({ streak: 2, activeToday: false });
  });

  it('drops a run with a gap before yesterday', () => {
    const days = ['2026-07-08', '2026-07-09'];
    expect(computeStreak(days, TODAY)).toEqual({ streak: 0, activeToday: false });
  });

  it('stops counting at the first hole in the run', () => {
    const days = ['2026-07-07', '2026-07-09', '2026-07-10', '2026-07-11', TODAY];
    expect(computeStreak(days, TODAY)).toEqual({ streak: 4, activeToday: true });
  });

  it('ignores duplicate days', () => {
    const days = [TODAY, TODAY, '2026-07-11', '2026-07-11'];
    expect(computeStreak(days, TODAY)).toEqual({ streak: 2, activeToday: true });
  });
});
