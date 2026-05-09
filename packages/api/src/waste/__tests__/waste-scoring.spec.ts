import { describe, expect, it } from 'vitest';
import { moodFromScore, scoreFromCounts } from '../waste-scoring.js';

describe('scoreFromCounts', () => {
  it('returns 100 when nothing has been resolved (empty state)', () => {
    expect(scoreFromCounts({ consumed: 0, discarded: 0, expired: 0 })).toBe(100);
  });

  it('is 100 when everything was consumed', () => {
    expect(scoreFromCounts({ consumed: 10, discarded: 0, expired: 0 })).toBe(100);
  });

  it('counts both discarded and expired as waste', () => {
    // 6 good of 10 -> 60
    expect(scoreFromCounts({ consumed: 6, discarded: 2, expired: 2 })).toBe(60);
  });

  it('is 0 when nothing was consumed', () => {
    expect(scoreFromCounts({ consumed: 0, discarded: 3, expired: 1 })).toBe(0);
  });

  it('rounds to the nearest integer', () => {
    // 2 / 3 = 66.66 -> 67
    expect(scoreFromCounts({ consumed: 2, discarded: 1, expired: 0 })).toBe(67);
  });
});

describe('moodFromScore', () => {
  it('maps every band', () => {
    expect(moodFromScore(100)).toBe('EXCELLENT');
    expect(moodFromScore(90)).toBe('EXCELLENT');
    expect(moodFromScore(89)).toBe('GOOD');
    expect(moodFromScore(70)).toBe('GOOD');
    expect(moodFromScore(69)).toBe('OKAY');
    expect(moodFromScore(50)).toBe('OKAY');
    expect(moodFromScore(49)).toBe('BAD');
    expect(moodFromScore(30)).toBe('BAD');
    expect(moodFromScore(29)).toBe('AWFUL');
    expect(moodFromScore(0)).toBe('AWFUL');
  });
});
