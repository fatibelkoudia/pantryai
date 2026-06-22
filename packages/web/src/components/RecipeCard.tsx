'use client';

import { useTranslation } from 'react-i18next';
import type { RecipeSuggestion } from '@pantryai/shared';

interface RecipeCardProps {
  suggestion: RecipeSuggestion;
}

export function RecipeCard({ suggestion }: RecipeCardProps) {
  const { t } = useTranslation();
  const { recipe, score, matchedIngredients, missingIngredients } = suggestion;
  const percent = Math.round(score * 100);

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-border bg-surface-card shadow-sm">
      {recipe.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recipe.imageUrl} alt="" className="h-40 w-full object-cover" loading="lazy" />
      ) : null}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold">{recipe.name}</h3>
          <span className="shrink-0 rounded-full bg-brand px-2 py-1 text-xs font-bold text-brand-fg">
            {t('recipe.match', { percent })}
          </span>
        </div>

        {recipe.category ? <p className="text-sm text-slate-500">{recipe.category}</p> : null}

        <div className="mt-1 text-sm">
          <p className="font-medium text-slate-700">{t('recipe.youHave')}</p>
          <p className="text-slate-600">
            {matchedIngredients.length > 0 ? matchedIngredients.join(', ') : t('recipe.noneYet')}
          </p>
        </div>

        {missingIngredients.length > 0 ? (
          <div className="text-sm">
            <p className="font-medium text-slate-700">{t('recipe.missing')}</p>
            <p className="text-expiry-expired">{missingIngredients.join(', ')}</p>
          </div>
        ) : (
          <p className="text-sm font-medium text-brand">{t('recipe.haveEverything')}</p>
        )}
      </div>
    </article>
  );
}
