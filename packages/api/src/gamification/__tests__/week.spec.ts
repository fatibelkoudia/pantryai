import { describe, expect, it } from 'vitest';
import { dayKey, previousDayKey, weekEnd, weekKey, weekStart } from '../week.js';

describe('dayKey', () => {
  it('uses the Paris calendar day, not UTC', () => {
    // 23:30 UTC in summer is already 01:30 the next day in Paris
    expect(dayKey(new Date('2026-07-12T23:30:00Z'))).toBe('2026-07-13');
    // and 23:30 UTC in winter is 00:30 the next day
    expect(dayKey(new Date('2026-01-10T23:30:00Z'))).toBe('2026-01-11');
    // midday is the same day everywhere
    expect(dayKey(new Date('2026-07-12T10:00:00Z'))).toBe('2026-07-12');
  });
});

describe('previousDayKey', () => {
  it('walks back across month and leap-year boundaries', () => {
    expect(previousDayKey('2026-07-13')).toBe('2026-07-12');
    expect(previousDayKey('2026-03-01')).toBe('2026-02-28');
    expect(previousDayKey('2024-03-01')).toBe('2024-02-29');
    expect(previousDayKey('2026-01-01')).toBe('2025-12-31');
  });
});

describe('weekKey', () => {
  it('gives the ISO week of the Paris date', () => {
    // Monday July 6th 2026 starts ISO week 28
    expect(weekKey(new Date('2026-07-06T10:00:00Z'))).toBe('2026-W28');
    expect(weekKey(new Date('2026-07-08T10:00:00Z'))).toBe('2026-W28');
    // Sunday night UTC is already Monday in Paris, so it's the next week
    expect(weekKey(new Date('2026-07-12T23:30:00Z'))).toBe('2026-W29');
  });

  it('handles the year boundary the ISO way', () => {
    // the week of Dec 29th 2025 has its Thursday on Jan 1st 2026
    expect(weekKey(new Date('2025-12-31T10:00:00Z'))).toBe('2026-W01');
    // 2026 has 53 ISO weeks, and Jan 1st 2027 (a Friday) still belongs to it
    expect(weekKey(new Date('2027-01-01T10:00:00Z'))).toBe('2026-W53');
  });
});

describe('weekStart / weekEnd', () => {
  it('is Monday midnight in Paris (2h behind UTC in summer)', () => {
    const start = weekStart(new Date('2026-07-08T10:00:00Z'));
    expect(start.toISOString()).toBe('2026-07-05T22:00:00.000Z');
    const end = weekEnd(new Date('2026-07-08T10:00:00Z'));
    expect(end.toISOString()).toBe('2026-07-12T22:00:00.000Z');
  });

  it('is only 1h behind UTC in winter', () => {
    const start = weekStart(new Date('2026-01-14T10:00:00Z'));
    expect(start.toISOString()).toBe('2026-01-11T23:00:00.000Z');
  });

  it('handles the week where summer time starts', () => {
    // clocks jump forward on Sunday March 29th 2026: the week starts on winter
    // time and ends on summer time
    const during = new Date('2026-03-25T10:00:00Z');
    expect(weekStart(during).toISOString()).toBe('2026-03-22T23:00:00.000Z');
    expect(weekEnd(during).toISOString()).toBe('2026-03-29T22:00:00.000Z');
  });
});
