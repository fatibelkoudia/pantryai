import type { ConservationTip, Locale } from '@pantryai/shared';
import enData from './data/tips.en.json';
import frData from './data/tips.fr.json';
import type { Quiz } from './quiz.js';

// A tip the way it's stored in the data files: the tip text (ANSES/ADEME), a link
// to where it comes from, and the quiz we generated for it. The quiz can be null
// when we haven't generated one yet, and then the app shows a plain read card.
export interface LessonRecord extends ConservationTip {
  quiz: Quiz | null;
}

// The tips in the data files carry everything except the quiz might be missing
// (we add it later with the generation script), so we default it to null on load.
type RawRecord = Omit<LessonRecord, 'quiz'> & { quiz?: LessonRecord['quiz'] };
const normalize = (record: RawRecord): LessonRecord => ({ ...record, quiz: record.quiz ?? null });

// The French tips are the source of truth: they decide which lessons exist and in
// what order. The English file is the same tips translated, and can be shorter (or
// empty) if some translations haven't been generated yet.
const FR = (frData as RawRecord[]).map(normalize);
const EN = (enData as RawRecord[]).map(normalize);

const EN_BY_ID = new Map(EN.map((record) => [record.id, record]));

// Used everywhere we just need the list of tips (in French order).
export const TIPS = FR;

// All the records in one language. For English we swap in the translated record
// when we have it and keep the French one when we don't, so the list is always
// complete no matter how much has been translated.
export function recordsForLocale(locale: Locale): LessonRecord[] {
  if (locale !== 'en') return FR;
  return FR.map((fr) => EN_BY_ID.get(fr.id) ?? fr);
}

// One record by id, in the given language, French as the fallback.
export function recordById(id: string, locale: Locale): LessonRecord | undefined {
  if (locale === 'en') {
    const translated = EN_BY_ID.get(id);
    if (translated) return translated;
  }
  return FR.find((record) => record.id === id);
}

// Drop the quiz so we never leak the answer in a plain tips/lessons list.
export function toTip(record: LessonRecord): ConservationTip {
  return {
    id: record.id,
    category: record.category,
    title: record.title,
    body: record.body,
    source: record.source,
    sourceUrl: record.sourceUrl,
  };
}
