'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { RecipeCard } from '@/components/RecipeCard';
import { apiClient } from '@/lib/api';

export default function RecipesPage() {
  const { t } = useTranslation();
  const recipes = useQuery({
    queryKey: ['recipes', 'suggest'],
    queryFn: () => apiClient.suggestRecipes(),
  });

  // the match rule is a user setting now, so the intro line has to follow it
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
  });
  const matchPercent = Math.round((settings.data?.recipeMatchThreshold ?? 0.7) * 100);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t('recipe.title')}</h1>
        <p className="text-sm text-slate-500">{t('recipe.subtitle', { percent: matchPercent })}</p>
      </header>

      {recipes.isLoading ? (
        <p role="status" className="text-slate-500">
          {t('recipe.loading')}
        </p>
      ) : recipes.isError ? (
        <p role="alert" className="text-expiry-expired">
          {t('recipe.loadError')}
        </p>
      ) : recipes.data && recipes.data.suggestions.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.data.suggestions.map((suggestion) => (
            <li key={suggestion.recipe.id}>
              <RecipeCard suggestion={suggestion} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-card border border-dashed border-border p-10 text-center text-slate-500">
          <p>{t('recipe.empty')}</p>
          <Link href="/stocks" className="mt-2 inline-block font-medium text-brand hover:underline">
            {t('recipe.addMore')}
          </Link>
        </div>
      )}
    </section>
  );
}
