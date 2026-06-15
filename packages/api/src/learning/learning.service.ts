import { Injectable } from '@nestjs/common';
import type { ConservationTip, TipCategory } from '@pantryai/shared';
import tipsData from './data/tips.fr.json';

// The bundled tips are static reference content (ANSES/ADEME), so we just read
// them straight from the JSON file. No DB table, no per-user state.
const TIPS = tipsData as ConservationTip[];

@Injectable()
export class LearningService {
  // All tips, or just the ones in a category when asked.
  getTips(category?: TipCategory): ConservationTip[] {
    if (!category) return TIPS;
    return TIPS.filter((tip) => tip.category === category);
  }

  // One random tip, optionally from a single category. Null when nothing matches
  // (e.g. an empty category), so callers can fall back gracefully.
  getRandomTip(category?: TipCategory): ConservationTip | null {
    const pool = this.getTips(category);
    if (pool.length === 0) return null;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index] ?? null;
  }
}
