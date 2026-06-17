// Fills in the quizzes and the English translations for the Learn lessons.
//
// The tips themselves (in src/learning/data/tips.fr.json) are written by hand from
// ANSES and ADEME guidance. The quiz question for each one, and the whole English
// version, are made once here with Mistral and saved straight into the data files,
// so the running app never has to call Mistral and we never pay for the same lesson
// twice.
//
// Run it with: pnpm --filter @pantryai/api generate-lessons
//
// It only fills in what's missing, so running it again is safe and cheap: tips that
// already have a quiz and a translation are skipped. Delete a quiz field (or a row
// in tips.en.json) if you want it regenerated.
import { Mistral } from '@mistralai/mistralai';
import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateQuiz, type Quiz } from '../src/learning/quiz.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../.env') });

const DATA_DIR = path.resolve(__dirname, '../src/learning/data');
const FR_FILE = path.join(DATA_DIR, 'tips.fr.json');
const EN_FILE = path.join(DATA_DIR, 'tips.en.json');

// wait a bit between calls so we stay polite with the free tier
const DELAY_MS = 1500;

interface TipRecord {
  id: string;
  category: string;
  title: string;
  body: string;
  source: string;
  sourceUrl: string;
  quiz?: Quiz | null;
}

const SYSTEM_PROMPT =
  'You help a food-waste app turn a French food-storage tip into a small bilingual ' +
  'lesson. From the French tip you get, reply with ONLY a JSON object shaped exactly ' +
  'like this: {"fr": {"question": string, "choices": [string, string, string], ' +
  '"answerIndex": number, "explanation": string}, "en": {"title": string, "body": ' +
  'string, "question": string, "choices": [string, string, string], "answerIndex": ' +
  'number, "explanation": string}}. The "fr" part is one multiple-choice question in ' +
  'French about the main point of the tip. The "en" part is the English translation ' +
  'of the tip title and body, plus the same question and choices translated to ' +
  'English in the same order (so answerIndex is the same). Each "choices" list has ' +
  'exactly 3 short, believable answers and only one is correct. "answerIndex" is the ' +
  '0-based index of the correct choice and "explanation" is one or two sentences.';

function readTips(file: string): TipRecord[] {
  return JSON.parse(readFileSync(file, 'utf8')) as TipRecord[];
}

function writeTips(file: string, tips: TipRecord[]): void {
  writeFileSync(file, `${JSON.stringify(tips, null, 2)}\n`, 'utf8');
}

async function generate(mistral: Mistral, tip: TipRecord): Promise<{ fr: Quiz; en: TipRecord }> {
  const response = await mistral.chat.complete({
    model: 'mistral-small-latest',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${tip.title}\n\n${tip.body}` },
    ],
    responseFormat: { type: 'json_object' },
  });

  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('empty response');

  const raw = JSON.parse(content) as { fr?: unknown; en?: Record<string, unknown> };
  const frQuiz = validateQuiz(raw.fr);
  const enQuiz = validateQuiz(raw.en);
  const enTitle = raw.en?.['title'];
  const enBody = raw.en?.['body'];

  if (!frQuiz) throw new Error('bad French quiz');
  if (!enQuiz) throw new Error('bad English quiz');
  if (typeof enTitle !== 'string' || enTitle.trim() === '')
    throw new Error('missing English title');
  if (typeof enBody !== 'string' || enBody.trim() === '') throw new Error('missing English body');

  const en: TipRecord = {
    id: tip.id,
    category: tip.category,
    title: enTitle.trim(),
    body: enBody.trim(),
    source: tip.source,
    sourceUrl: tip.sourceUrl,
    quiz: enQuiz,
  };
  return { fr: frQuiz, en };
}

async function main(): Promise<void> {
  const apiKey = process.env['MISTRAL_API_KEY'];
  if (!apiKey) {
    console.error('MISTRAL_API_KEY is not set, cannot generate lessons.');
    process.exit(1);
  }
  const mistral = new Mistral({ apiKey });

  const frTips = readTips(FR_FILE);
  const enTips = readTips(EN_FILE);
  const enById = new Map(enTips.map((tip) => [tip.id, tip]));

  let made = 0;
  let skipped = 0;
  for (const tip of frTips) {
    if (tip.quiz && enById.has(tip.id)) {
      skipped += 1;
      continue;
    }

    try {
      const { fr, en } = await generate(mistral, tip);
      tip.quiz = fr;
      enById.set(tip.id, en);
      made += 1;
      console.log(`ok   ${tip.id}`);
    } catch (error) {
      console.warn(`fail ${tip.id}: ${String(error)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  // keep the English file in the same order as the French one
  const orderedEn = frTips
    .map((tip) => enById.get(tip.id))
    .filter((tip): tip is TipRecord => !!tip);

  writeTips(FR_FILE, frTips);
  writeTips(EN_FILE, orderedEn);
  console.log(`\nDone. Generated ${made}, skipped ${skipped}, English tips: ${orderedEn.length}.`);
}

void main();
