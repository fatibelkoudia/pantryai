import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CompleteLessonResponse,
  ConservationTip,
  Lesson,
  LessonDetail,
  Locale,
  TipCategory,
} from '@pantryai/shared';
import { LESSON_XP } from '@pantryai/shared';
import { GamificationService } from '../gamification/gamification.service.js';
import { dayKey } from '../gamification/week.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { recordById, recordsForLocale, TIPS, toTip, type LessonRecord } from './tips.js';

@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  // All tips, or just the ones in a category when asked, in the given language.
  getTips(category?: TipCategory, locale: Locale = 'fr'): ConservationTip[] {
    return this.filterRecords(category, locale).map(toTip);
  }

  // One random tip, optionally from a single category. Null when nothing matches
  // (e.g. an empty category), so callers can fall back gracefully.
  getRandomTip(category?: TipCategory, locale: Locale = 'fr'): ConservationTip | null {
    const pool = this.filterRecords(category, locale);
    if (pool.length === 0) return null;
    const record = pool[Math.floor(Math.random() * pool.length)];
    return record ? toTip(record) : null;
  }

  // The tip of the day. Picked from the date, not at random, so everyone sees the
  // same mission all day long, on every screen and in both languages.
  getDailyTip(locale: Locale = 'fr', now = new Date()): ConservationTip | null {
    if (TIPS.length === 0) return null;
    const key = dayKey(now);
    let hash = 0;
    for (const char of key) {
      hash = (hash * 31 + char.charCodeAt(0)) % 100_000;
    }
    const record = recordsForLocale(locale)[hash % TIPS.length];
    return record ? toTip(record) : null;
  }

  // The lessons list for the Learn screen: every tip in the given language plus
  // whether the caller already finished it. The counts always cover all lessons,
  // not just the filtered category, so the path card can show "n/25".
  async getLessons(
    userId: string,
    category?: TipCategory,
    locale: Locale = 'fr',
  ): Promise<{ lessons: Lesson[]; completedCount: number; totalCount: number }> {
    const completions = await this.prisma.lessonCompletion.findMany({ where: { userId } });
    const doneIds = new Set(completions.map((c) => c.tipId));
    const doneAt = new Map(completions.map((c) => [c.tipId, c.completedAt]));

    const lessons: Lesson[] = this.filterRecords(category, locale).map((record) => ({
      ...toTip(record),
      xp: LESSON_XP,
      completed: doneIds.has(record.id),
      completedAt: doneAt.get(record.id)?.toISOString() ?? null,
    }));

    return { lessons, completedCount: doneIds.size, totalCount: TIPS.length };
  }

  // One full lesson with its quiz. The quiz is null for a lesson we haven't
  // generated one for yet, and the app then shows it as a plain read-and-confirm
  // card instead.
  async getLesson(userId: string, tipId: string, locale: Locale = 'fr'): Promise<LessonDetail> {
    const record = this.findRecord(tipId, locale);
    const completion = await this.prisma.lessonCompletion.findUnique({
      where: { userId_tipId: { userId, tipId } },
    });

    return {
      ...toTip(record),
      xp: LESSON_XP,
      completed: completion != null,
      // strip the answer, the app only needs the question and the choices
      quiz: record.quiz ? { question: record.quiz.question, choices: record.quiz.choices } : null,
    };
  }

  // Finish a lesson: judge the picked answer against the stored quiz, pay the XP
  // (only the first time, the completion row's primary key is the guard) and hand
  // back the reveal plus the fresh XP total and streak for the UI.
  async completeLesson(
    userId: string,
    tipId: string,
    locale: Locale = 'fr',
    answerIndex?: number,
  ): Promise<CompleteLessonResponse> {
    const record = this.findRecord(tipId, locale);
    const quiz = record.quiz;
    const correct = quiz && answerIndex !== undefined ? answerIndex === quiz.answerIndex : null;

    let xpAwarded = 0;
    try {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.lessonCompletion.findUnique({
          where: { userId_tipId: { userId, tipId } },
        });
        if (existing) return;
        await tx.lessonCompletion.create({ data: { userId, tipId, correct } });
        await tx.userXp.upsert({
          where: { userId },
          create: { userId, total: LESSON_XP },
          update: { total: { increment: LESSON_XP } },
        });
        xpAwarded = LESSON_XP;
      });
    } catch {
      // two taps racing: the second create hits the primary key, the lesson is
      // already completed and no XP is due
      xpAwarded = 0;
    }

    const [xpRow, streak] = await Promise.all([
      this.prisma.userXp.findUnique({ where: { userId } }),
      this.gamification.getStreak(userId),
    ]);

    return {
      correct,
      answerIndex: quiz?.answerIndex ?? null,
      explanation: quiz?.explanation ?? null,
      xpAwarded,
      xp: xpRow?.total ?? 0,
      streak: streak.streak,
    };
  }

  private filterRecords(category: TipCategory | undefined, locale: Locale): LessonRecord[] {
    const records = recordsForLocale(locale);
    if (!category) return records;
    return records.filter((record) => record.category === category);
  }

  private findRecord(tipId: string, locale: Locale): LessonRecord {
    const record = recordById(tipId, locale);
    if (!record) throw new NotFoundException(`Unknown lesson: ${tipId}`);
    return record;
  }
}
