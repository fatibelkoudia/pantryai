import { describe, expect, it } from 'vitest';
import { validateQuiz } from '../quiz.js';

const GOOD = {
  question: 'Where do bananas go?',
  choices: ['Fridge', 'Counter', 'Freezer'],
  answerIndex: 1,
  explanation: 'They keep better at room temperature.',
};

describe('validateQuiz', () => {
  it('accepts and trims a well-formed quiz', () => {
    const quiz = validateQuiz({ ...GOOD, question: '  Where do bananas go?  ' });
    expect(quiz).toEqual(GOOD);
  });

  it('rejects things that are not objects', () => {
    expect(validateQuiz(null)).toBeNull();
    expect(validateQuiz('nope')).toBeNull();
    expect(validateQuiz(42)).toBeNull();
  });

  it.each([
    ['an empty question', { ...GOOD, question: '   ' }],
    ['too few choices', { ...GOOD, choices: ['a', 'b'] }],
    ['too many choices', { ...GOOD, choices: ['a', 'b', 'c', 'd'] }],
    ['a blank choice', { ...GOOD, choices: ['a', '', 'c'] }],
    ['a non-string choice', { ...GOOD, choices: ['a', 2, 'c'] }],
    ['an out-of-range answer', { ...GOOD, answerIndex: 3 }],
    ['a negative answer', { ...GOOD, answerIndex: -1 }],
    ['a non-integer answer', { ...GOOD, answerIndex: 1.5 }],
    ['a missing explanation', { ...GOOD, explanation: '' }],
  ])('rejects %s', (_label, raw) => {
    expect(validateQuiz(raw)).toBeNull();
  });
});
