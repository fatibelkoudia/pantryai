import { describe, expect, it } from 'vitest';
import type { ChallengeRule } from '@pantryai/shared';
import { evaluateProgress, type ChallengeSignals } from '../challenge-rules.js';

function signals(overrides: Partial<ChallengeSignals> = {}): ChallengeSignals {
  return {
    consumedTotal: 0,
    consumedByLocation: {},
    windowConsumed: {},
    windowWaste: {},
    shoppingChecked: 0,
    ...overrides,
  };
}

describe('evaluateProgress', () => {
  it('counts total consumed for an unscoped consume_count', () => {
    const rule: ChallengeRule = { type: 'consume_count', target: 10 };
    expect(evaluateProgress(rule, signals({ consumedTotal: 4 }))).toEqual({
      progress: 4,
      target: 10,
    });
  });

  it('caps progress at the target', () => {
    const rule: ChallengeRule = { type: 'consume_count', target: 3 };
    expect(evaluateProgress(rule, signals({ consumedTotal: 9 })).progress).toBe(3);
  });

  it('scopes consume_count to a location', () => {
    const rule: ChallengeRule = { type: 'consume_count', target: 3, location: 'FRIDGE' };
    const s = signals({ consumedTotal: 5, consumedByLocation: { FRIDGE: 2, PANTRY: 3 } });
    expect(evaluateProgress(rule, s)).toEqual({ progress: 2, target: 3 });
  });

  it('counts window consumed for no_waste_window when nothing is wasted', () => {
    const rule: ChallengeRule = { type: 'no_waste_window', target: 3, windowDays: 7 };
    const s = signals({ windowConsumed: { 7: 3 }, windowWaste: { 7: 0 } });
    expect(evaluateProgress(rule, s)).toEqual({ progress: 3, target: 3 });
  });

  it('resets no_waste_window progress to 0 once anything is wasted', () => {
    const rule: ChallengeRule = { type: 'no_waste_window', target: 3, windowDays: 7 };
    const s = signals({ windowConsumed: { 7: 5 }, windowWaste: { 7: 1 } });
    expect(evaluateProgress(rule, s).progress).toBe(0);
  });

  it('counts checked shopping items for shopping_checked', () => {
    const rule: ChallengeRule = { type: 'shopping_checked', target: 5 };
    expect(evaluateProgress(rule, signals({ shoppingChecked: 5 }))).toEqual({
      progress: 5,
      target: 5,
    });
  });
});
