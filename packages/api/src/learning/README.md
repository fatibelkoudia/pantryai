# Learning content: tips and quizzes

This folder holds the content behind the Learn tab: the food conservation tips and
the little quiz that goes with each one. This note explains where all of it comes
from and how to change it.

## What a lesson is

A lesson is one tip plus one multiple choice question about it. On the app the user
reads the tip first, then taps "Start the quiz" and answers the question, so the
quiz is really a check that they read the tip. Getting it done (right or wrong)
gives 20 XP once.

## Where the content lives

Everything is static JSON, no database table for the content:

- `data/tips.fr.json` is the source of truth. It decides which lessons exist and in
  what order. Each tip is hand written in French.
- `data/tips.en.json` is the same tips translated to English. It can be shorter or
  empty if some translations haven't been generated yet; anything missing falls
  back to the French text.

One tip looks like this:

```json
{
  "id": "fruits-fridge-vs-counter",
  "category": "fruits",
  "title": "Tous les fruits ne vont pas au frigo",
  "body": "Bananes, agrumes, melons...",
  "source": "ADEME, guide anti-gaspillage alimentaire",
  "sourceUrl": "https://agirpourlatransition.ademe.fr/...",
  "quiz": {
    "question": "Où doit-on conserver les bananes...?",
    "choices": ["Au frigo dès l'achat", "À température ambiante", "..."],
    "answerIndex": 1,
    "explanation": "Les bananes se conservent mieux à température ambiante..."
  }
}
```

`quiz` can be `null`. When it is, the app just shows the tip with a "Got it" button
instead of a question, so a lesson always opens even if we never made a quiz for it.

## Where the tips come from

The tip text is written by hand from public French guidance, mostly ANSES (food
safety) and ADEME (anti food waste). We looked for a public API to pull tips from
and there isn't one: ANSES and ADEME publish web pages, not an API, and the food
APIs that do exist (Open Food Facts and the like) are product and nutrition
databases, not storage advice. So each tip carries a `source` label and a
`sourceUrl` pointing at the page it is based on.

## Where the quizzes and the English text come from

We do not write the quizzes or the translations by hand. A one-off script makes
them with Mistral (the same provider we already use for OCR, so no new third party,
and only the public tip text is sent) and writes the result straight into the JSON
files. So the running app never calls Mistral: it just reads the files, which means
no cost per lesson and no waiting.

Run it like this:

```bash
pnpm --filter @pantryai/api generate-lessons
```

It needs a working `MISTRAL_API_KEY` in `packages/api/.env`. It only fills in what
is missing (a tip with no quiz, or a tip that has no English row yet), so running it
again is safe and cheap. To regenerate one on purpose, delete its `quiz` field (or
its row in `tips.en.json`) and run it again.

The script is `scripts/generate-lessons.ts`. The check that a generated quiz is
well formed (three non-empty choices, an `answerIndex` that points at one of them)
lives in `quiz.ts`, so the script and the tests share the exact same rule.

## Adding or changing a tip

1. Add the tip to `data/tips.fr.json` (you can leave out `quiz`, the script fills
   it in). Give it a real `source` and `sourceUrl`.
2. Run `pnpm --filter @pantryai/api generate-lessons` to make its quiz and its
   English version.
3. Have a quick read of what came back before committing. It is AI generated, so
   check the answer is actually the right one and the wording is fine.

## How it is served

`learning.service.ts` reads these files through `tips.ts` and serves them over the
`/learning/tips`, `/learning/lessons` and `/learning/lessons/:id` endpoints, picking
the French or English text from the requested locale. It never sends the
`answerIndex` to the app: the app posts the picked answer back to
`/learning/lessons/:id/complete` and the server says whether it was right.
