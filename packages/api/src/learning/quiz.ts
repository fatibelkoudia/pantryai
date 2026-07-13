// The quiz that goes with a lesson: one question, three answers, and the index of
// the right one. This lives next to the tips in the data files. We keep the check
// that a quiz is well formed here as a pure function so the generation script and
// the tests can both use it without pulling in the rest of the app.

export interface Quiz {
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

// Turn whatever the model gave us into a Quiz, or null if it doesn't look right.
// We want exactly three non-empty choices and an answerIndex that points at one of
// them, otherwise we'd rather show no quiz than a broken one.
export function validateQuiz(raw: unknown): Quiz | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const question = record['question'];
  const choices = record['choices'];
  const answerIndex = record['answerIndex'];
  const explanation = record['explanation'];

  if (typeof question !== 'string' || question.trim() === '') return null;
  if (!Array.isArray(choices) || choices.length !== 3) return null;
  if (!choices.every((c): c is string => typeof c === 'string' && c.trim() !== '')) return null;
  if (typeof answerIndex !== 'number' || !Number.isInteger(answerIndex)) return null;
  if (answerIndex < 0 || answerIndex >= choices.length) return null;
  if (typeof explanation !== 'string' || explanation.trim() === '') return null;

  return {
    question: question.trim(),
    choices: choices.map((c) => c.trim()),
    answerIndex,
    explanation: explanation.trim(),
  };
}
