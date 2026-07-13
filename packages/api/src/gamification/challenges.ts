import type { ChallengeRule } from '@pantryai/shared';

// Our list of Trashy challenges (from Trashy.jpg). We write these into the
// `challenges` table when the app starts. They're keyed on `key`, so changing the
// text or xp here just updates the existing row. Each `rule` says how we count
// progress (see challenge-rules.ts). Challenges are weekly: progress only counts
// what happened since Monday and the XP can be earned again every week.
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
    description: 'Eat 3 items from your fridge this week.',
    xp: 50,
    rule: { type: 'consume_count', target: 3, location: 'FRIDGE' },
  },
  {
    key: 'no-waste-weekend',
    title: 'No Waste Weekend',
    description: 'Eat 3 items this week without throwing anything away.',
    xp: 100,
    rule: { type: 'no_waste_window', target: 3, windowDays: 7 },
  },
  {
    key: 'use-it-all',
    title: 'Use It All',
    description: 'Use up 10 items from your stock this week.',
    xp: 150,
    rule: { type: 'consume_count', target: 10 },
  },
  {
    key: 'smart-shopper',
    title: 'Smart Shopper',
    description: 'Check off 5 items on your shopping list this week.',
    xp: 75,
    rule: { type: 'shopping_checked', target: 5 },
  },
];
