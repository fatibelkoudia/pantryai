import type { ChallengeRule } from '@pantryai/shared';

// All the numbers we read from the database once and then give to every rule. We
// keep the rule maths in here with no database calls so it's easy to write tests for.
export interface ChallengeSignals {
  // How many stock items the user has eaten, in total and per location.
  consumedTotal: number;
  consumedByLocation: Record<string, number>;
  // For each window length (in days) we keep how many items were eaten and how many
  // were wasted, so a rule can just look up the window it cares about.
  windowConsumed: Record<number, number>;
  windowWaste: Record<number, number>;
  // How many shopping-list items the user has ticked off.
  shoppingChecked: number;
}

// Figure out how far along a challenge is. We never let progress go above the target,
// so once `progress >= target` the challenge is done. A no-waste challenge drops back
// to 0 as soon as anything gets wasted in the window, because that week is spoiled.
export function evaluateProgress(
  rule: ChallengeRule,
  signals: ChallengeSignals,
): { progress: number; target: number } {
  switch (rule.type) {
    case 'consume_count': {
      const raw = rule.location
        ? (signals.consumedByLocation[rule.location] ?? 0)
        : signals.consumedTotal;
      return { progress: Math.min(raw, rule.target), target: rule.target };
    }
    case 'no_waste_window': {
      const wasted = signals.windowWaste[rule.windowDays] ?? 0;
      const consumed = signals.windowConsumed[rule.windowDays] ?? 0;
      const raw = wasted > 0 ? 0 : consumed;
      return { progress: Math.min(raw, rule.target), target: rule.target };
    }
    case 'shopping_checked': {
      return { progress: Math.min(signals.shoppingChecked, rule.target), target: rule.target };
    }
  }
}
