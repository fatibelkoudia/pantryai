// The Trashy gamification stuff: an XP total plus the challenges the user is working
// on. Each challenge only gives its XP once. The api `gamification` module has the
// rules and works out when a challenge is done.

import type { StockLocation } from './stock.js';

// The different kinds of challenge rule. Each one says how we count progress from
// data we already have (which stock items got used, which shopping items got ticked).
export type ChallengeRule =
  // Eat a number of stock items, maybe only from one place (fridge, etc).
  | { type: 'consume_count'; target: number; location?: StockLocation }
  // Eat `target` items in the last few days without throwing anything away.
  | { type: 'no_waste_window'; target: number; windowDays: number }
  // Tick off a number of shopping-list items.
  | { type: 'shopping_checked'; target: number };

export type ChallengeRuleType = ChallengeRule['type'];

// One challenge the way the app shows it, with the user's own progress on it.
export interface ChallengeProgress {
  key: string;
  title: string;
  description: string;
  xp: number;
  progress: number;
  target: number;
  completed: boolean;
  completedAt: string | null;
}

export interface ChallengesResponse {
  // The user's current XP total.
  xp: number;
  challenges: ChallengeProgress[];
}
