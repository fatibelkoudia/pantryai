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
  source: string;
}

export interface TipsResponse {
  tips: ConservationTip[];
}

export interface RandomTipResponse {
  tip: ConservationTip | null;
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
