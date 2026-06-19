import type { ChallengeRule } from '@pantryai/shared';

// Our list of Trashy challenges (from Trashy.jpg). We write these into the
// `challenges` table when the app starts. They're keyed on `key`, so changing the
// text or xp here just updates the existing row. Each `rule` says how we count
// progress (see challenge-rules.ts).
export interface ChallengeDef {
  key: string;
  title: string;
  description: string;
  xp: number;
  rule: ChallengeRule;
}

export const CHALLENGE_DEFS: ChallengeDef[] = [
  {
    key: 'clean-out-fridge',
    title: 'Clean Out Your Fridge',
    description: 'Eat 3 items from your fridge before they go bad.',
    xp: 50,
    rule: { type: 'consume_count', target: 3, location: 'FRIDGE' },
  },
  {
    key: 'no-waste-weekend',
    title: 'No Waste Weekend',
    description: 'Eat 3 items in a week without throwing anything away.',
    xp: 100,
    rule: { type: 'no_waste_window', target: 3, windowDays: 7 },
  },
  {
    key: 'use-it-all',
    title: 'Use It All',
    description: 'Eat 10 items from your pantry over time.',
    xp: 150,
    rule: { type: 'consume_count', target: 10 },
  },
  {
    key: 'smart-shopper',
    title: 'Smart Shopper',
    description: 'Check off 5 items on your shopping list.',
    xp: 75,
    rule: { type: 'shopping_checked', target: 5 },
  },
];
