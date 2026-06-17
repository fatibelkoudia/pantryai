// Conservation tips ("Learning Path V1"). Static content served by the API's
// learning module, grouped into a few broad food categories.

export const TIP_CATEGORIES = [
  'fruits',
  'legumes',
  'produits-laitiers',
  'viande',
  'cereales',
] as const;

export type TipCategory = (typeof TIP_CATEGORIES)[number];

export interface ConservationTip {
  id: string;
  category: TipCategory;
  title: string;
  body: string;
  // the agency the tip comes from, like "ADEME, guide anti-gaspillage alimentaire"
  source: string;
  // link to the page the tip is based on, so the app can show "read more"
  sourceUrl: string;
}

export interface TipsResponse {
  tips: ConservationTip[];
}

export interface RandomTipResponse {
  tip: ConservationTip | null;
}

// Every lesson pays the same XP once. Kept here so the app can show the reward
// before the API answers.
export const LESSON_XP = 20;

// A tip the way the Learn screen shows it: the localized text plus whether the
// signed-in user already finished it.
export interface Lesson extends ConservationTip {
  xp: number;
  completed: boolean;
  completedAt: string | null;
}

export interface LessonsResponse {
  lessons: Lesson[];
  completedCount: number;
  totalCount: number;
}

// The question part of a lesson. The right answer is not in here on purpose:
// the app sends the user's pick to the complete endpoint and the API judges it.
export interface LessonQuiz {
  question: string;
  choices: string[];
}

// One full lesson, opened from a card. `quiz` is null when we could not generate
// a question for it, and the app falls back to a plain read-and-confirm card.
export interface LessonDetail extends ConservationTip {
  xp: number;
  completed: boolean;
  quiz: LessonQuiz | null;
}

export interface LessonDetailResponse {
  lesson: LessonDetail;
}

export interface CompleteLessonDto {
  // Which choice the user picked. Left out when the lesson had no quiz.
  answerIndex?: number;
}

export interface CompleteLessonResponse {
  // null when the lesson was completed without a quiz
  correct: boolean | null;
  // the right choice and its explanation, so the app can do the reveal
  answerIndex: number | null;
  explanation: string | null;
  // 0 when the lesson was already completed before (no double XP)
  xpAwarded: number;
  // the user's new XP total and daily streak after this completion
  xp: number;
  streak: number;
}

// Strip accents and lowercase so "Légumes" and "legume" both match our keywords.
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Words we look for to guess a product's category. The category we get from Open
// Food Facts is messy and mixes French and English, so we just check for these
// words in the name and category text.
const CATEGORY_KEYWORDS: Record<TipCategory, string[]> = {
  'produits-laitiers': [
    'lait',
    'laitier',
    'laitiere',
    'fromage',
    'yaourt',
    'yogourt',
    'beurre',
    'creme',
    'dairy',
    'cheese',
    'yogurt',
    'milk',
    'butter',
  ],
  viande: [
    'viande',
    'boeuf',
    'porc',
    'poulet',
    'volaille',
    'dinde',
    'agneau',
    'veau',
    'jambon',
    'charcuterie',
    'saucisse',
    'lardon',
    'poisson',
    'saumon',
    'thon',
    'crevette',
    'meat',
    'beef',
    'pork',
    'chicken',
    'poultry',
    'fish',
    'seafood',
    'ham',
  ],
  fruits: [
    'fruit',
    'pomme',
    'banane',
    'orange',
    'fraise',
    'raisin',
    'poire',
    'peche',
    'abricot',
    'cerise',
    'kiwi',
    'ananas',
    'mangue',
    'melon',
    'citron',
    'agrume',
    'apple',
    'banana',
    'berry',
    'grape',
  ],
  legumes: [
    'legume',
    'tomate',
    'carotte',
    'salade',
    'laitue',
    'courgette',
    'poireau',
    'oignon',
    'ail',
    'pomme de terre',
    'patate',
    'epinard',
    'brocoli',
    'haricot',
    'champignon',
    'poivron',
    'concombre',
    'vegetable',
    'veggie',
    'potato',
    'carrot',
    'salad',
    'lettuce',
  ],
  cereales: [
    'cereale',
    'pain',
    'pates',
    'pate alimentaire',
    'riz',
    'farine',
    'ble',
    'avoine',
    'biscuit',
    'cereal',
    'bread',
    'pasta',
    'rice',
    'flour',
    'oat',
    'grain',
    'wheat',
  ],
};

// Figure out which tip category a product belongs to from its name and category.
// We just look through the keywords and return the first one that matches. If
// nothing matches we return null and the caller can show a random tip instead.
export function resolveTipCategory(product: {
  name?: string | undefined;
  category?: string | undefined;
}): TipCategory | null {
  const haystack = normalize(`${product.name ?? ''} ${product.category ?? ''}`);
  if (!haystack.trim()) return null;

  for (const category of TIP_CATEGORIES) {
    for (const keyword of CATEGORY_KEYWORDS[category]) {
      if (haystack.includes(normalize(keyword))) {
        return category;
      }
    }
  }
  return null;
}
