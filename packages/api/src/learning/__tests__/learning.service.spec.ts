import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningService } from '../learning.service.js';

// A small set of fake tips so the test doesn't depend on the real data files: one
// tip with a quiz and an English translation, one with no quiz at all.
const fixture = vi.hoisted(() => {
  const fr = [
    {
      id: 't1',
      category: 'fruits',
      title: 'Titre un',
      body: 'Corps un.',
      source: 'ADEME',
      sourceUrl: 'https://ademe.example',
      quiz: {
        question: 'Question un ?',
        choices: ['a', 'b', 'c'],
        answerIndex: 1,
        explanation: 'parce que',
      },
    },
    {
      id: 't2',
      category: 'viande',
      title: 'Titre deux',
      body: 'Corps deux.',
      source: 'ANSES',
      sourceUrl: 'https://anses.example',
      quiz: null,
    },
  ];
  const en = [
    {
      id: 't1',
      category: 'fruits',
      title: 'Title one',
      body: 'Body one.',
      source: 'ADEME',
      sourceUrl: 'https://ademe.example',
      quiz: {
        question: 'Question one?',
        choices: ['a', 'b', 'c'],
        answerIndex: 1,
        explanation: 'because',
      },
    },
  ];
  return { fr, en };
});

vi.mock('../tips.js', () => {
  const { fr, en } = fixture;
  const enById = new Map(en.map((record) => [record.id, record]));
  const toTip = (r: (typeof fr)[number]) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    body: r.body,
    source: r.source,
    sourceUrl: r.sourceUrl,
  });
  return {
    TIPS: fr,
    recordsForLocale: (locale: string) =>
      locale === 'en' ? fr.map((f) => enById.get(f.id) ?? f) : fr,
    recordById: (id: string, locale: string) =>
      (locale === 'en' ? enById.get(id) : undefined) ?? fr.find((f) => f.id === id),
    toTip,
  };
});

// A fake Prisma that remembers lesson completions and the XP total, so we can check
// a lesson only ever pays its XP once.
function buildMock() {
  const state = {
    completions: new Map<string, { tipId: string; completedAt: Date }>(),
    xpTotal: 0,
  };

  const tx = {
    lessonCompletion: {
      findUnique: vi.fn(async ({ where }: { where: { userId_tipId: { tipId: string } } }) => {
        return state.completions.get(where.userId_tipId.tipId) ?? null;
      }),
      create: vi.fn(async ({ data }: { data: { tipId: string } }) => {
        const row = { tipId: data.tipId, completedAt: new Date() };
        state.completions.set(data.tipId, row);
        return row;
      }),
    },
    userXp: {
      upsert: vi.fn(async () => {
        state.xpTotal += 20;
        return { userId: 'u1', total: state.xpTotal };
      }),
    },
  };

  const prisma = {
    lessonCompletion: {
      findMany: vi.fn(async () =>
        Array.from(state.completions.values()).map((c) => ({ ...c, userId: 'u1' })),
      ),
      findUnique: tx.lessonCompletion.findUnique,
    },
    userXp: { findUnique: vi.fn(async () => ({ userId: 'u1', total: state.xpTotal })) },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  };

  const gamification = { getStreak: vi.fn(async () => ({ streak: 3, activeToday: true })) };

  return { prisma, gamification, state };
}

describe('LearningService', () => {
  let mock: ReturnType<typeof buildMock>;
  let service: LearningService;

  beforeEach(() => {
    mock = buildMock();
    service = new LearningService(mock.prisma as never, mock.gamification as never);
  });

  it('serves tips without leaking the quiz answer', () => {
    const tips = service.getTips();
    expect(tips).toHaveLength(2);
    expect(tips[0]).toMatchObject({ id: 't1', sourceUrl: 'https://ademe.example' });
    expect(tips[0]).not.toHaveProperty('quiz');
  });

  it('filters tips by category', () => {
    const tips = service.getTips('viande');
    expect(tips.map((t) => t.id)).toEqual(['t2']);
  });

  it('swaps in the English text when asked, French otherwise', () => {
    expect(service.getTips(undefined, 'fr')[0]?.title).toBe('Titre un');
    expect(service.getTips(undefined, 'en')[0]?.title).toBe('Title one');
    // t2 has no English translation, so English falls back to the French text
    expect(service.getTips(undefined, 'en')[1]?.title).toBe('Titre deux');
  });

  it('picks the same daily tip all day', () => {
    const noon = new Date('2026-07-12T12:00:00Z');
    const evening = new Date('2026-07-12T20:00:00Z');
    expect(service.getDailyTip('fr', noon)?.id).toBe(service.getDailyTip('fr', evening)?.id);
  });

  it('lists lessons with completion state and counts', async () => {
    mock.state.completions.set('t1', { tipId: 't1', completedAt: new Date() });
    const result = await service.getLessons('u1');
    expect(result.totalCount).toBe(2);
    expect(result.completedCount).toBe(1);
    expect(result.lessons.find((l) => l.id === 't1')?.completed).toBe(true);
    expect(result.lessons.find((l) => l.id === 't2')?.completed).toBe(false);
  });

  it('opens a lesson with its quiz but without the answer', async () => {
    const lesson = await service.getLesson('u1', 't1', 'en');
    expect(lesson.quiz).toEqual({ question: 'Question one?', choices: ['a', 'b', 'c'] });
    expect(lesson.title).toBe('Title one');
  });

  it('opens a quiz-less lesson as a plain card', async () => {
    const lesson = await service.getLesson('u1', 't2');
    expect(lesson.quiz).toBeNull();
  });

  it('rejects unknown lessons', async () => {
    await expect(service.getLesson('u1', 'nope')).rejects.toThrow('Unknown lesson');
  });

  it('judges the answer and pays the XP on first completion', async () => {
    const result = await service.completeLesson('u1', 't1', 'fr', 1);
    expect(result.correct).toBe(true);
    expect(result.answerIndex).toBe(1);
    expect(result.explanation).toBe('parce que');
    expect(result.xpAwarded).toBe(20);
    expect(result.xp).toBe(20);
    expect(result.streak).toBe(3);
  });

  it('marks a wrong answer but still completes the lesson', async () => {
    const result = await service.completeLesson('u1', 't1', 'fr', 2);
    expect(result.correct).toBe(false);
    expect(result.xpAwarded).toBe(20);
  });

  it('never pays the XP twice for the same lesson', async () => {
    await service.completeLesson('u1', 't1', 'fr', 1);
    const again = await service.completeLesson('u1', 't1', 'fr', 1);
    expect(again.xpAwarded).toBe(0);
    expect(mock.state.xpTotal).toBe(20);
  });

  it('completes a quiz-less lesson with a null verdict', async () => {
    const result = await service.completeLesson('u1', 't2');
    expect(result.correct).toBeNull();
    expect(result.answerIndex).toBeNull();
    expect(result.xpAwarded).toBe(20);
  });
});
