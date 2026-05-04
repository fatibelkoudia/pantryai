import { TIP_CATEGORIES } from '@pantryai/shared';
import { describe, expect, it } from 'vitest';
import { LearningService } from '../learning.service.js';

describe('LearningService', () => {
  const service = new LearningService();

  it('returns every tip when no category is given', () => {
    const tips = service.getTips();
    expect(tips.length).toBeGreaterThan(0);
    // every tip must belong to a known category
    for (const tip of tips) {
      expect(TIP_CATEGORIES).toContain(tip.category);
    }
  });

  it('filters tips down to the requested category', () => {
    const tips = service.getTips('fruits');
    expect(tips.length).toBeGreaterThan(0);
    expect(tips.every((tip) => tip.category === 'fruits')).toBe(true);
  });

  it('returns at least one tip for every category', () => {
    for (const category of TIP_CATEGORIES) {
      expect(service.getTips(category).length).toBeGreaterThan(0);
    }
  });

  it('gives a random tip from the requested category', () => {
    const tip = service.getRandomTip('viande');
    expect(tip).not.toBeNull();
    expect(tip?.category).toBe('viande');
  });

  it('returns null when a category has no tips', () => {
    // cast to bypass the type so we can exercise the empty-pool path
    const tip = service.getRandomTip('nonexistent' as never);
    expect(tip).toBeNull();
  });

  it('every tip has the fields the clients render', () => {
    for (const tip of service.getTips()) {
      expect(tip.id).toBeTruthy();
      expect(tip.title).toBeTruthy();
      expect(tip.body).toBeTruthy();
      expect(tip.source).toBeTruthy();
    }
  });
});
