import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../src/api/client';
import { buttonLip, colors, font, radii } from '../../src/theme';

// cut the instructions text into steps (one per line)
function toSteps(instructions?: string): string[] {
  if (!instructions) return [];
  return instructions
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// one ingredient line, with an icon that shows if we have it or not
function IngredientRow({
  name,
  measure,
  status,
}: {
  name: string;
  measure: string;
  status: 'have' | 'missing' | 'staple';
}) {
  const { t } = useTranslation();
  const icon =
    status === 'have'
      ? { name: 'checkmark-circle' as const, color: colors.leafGreen }
      : status === 'missing'
        ? { name: 'cart-outline' as const, color: colors.coralOrange }
        : { name: 'ellipse-outline' as const, color: colors.textMuted };
  const tag =
    status === 'have'
      ? t('recipe.inStock')
      : status === 'missing'
        ? t('recipe.needToBuy')
        : t('recipe.staple');

  return (
    <View style={styles.ingredientRow}>
      <Ionicons name={icon.name} size={20} color={icon.color} />
      <View style={styles.ingredientMain}>
        <Text style={styles.ingredientName}>{name}</Text>
        {measure ? <Text style={styles.ingredientMeasure}>{measure}</Text> : null}
      </View>
      <Text style={[styles.ingredientTag, { color: icon.color }]}>{tag}</Text>
    </View>
  );
}

export default function RecipeDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  // get the recipes list (same query as the recipes screen, so it's already cached)
  const { data, isLoading } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => apiClient.suggestRecipes(),
  });

  const suggestion = data?.suggestions.find((s) => s.recipe.id === id);

  const addMissing = useMutation({
    mutationFn: async () => {
      if (!suggestion) return;
      // add each missing ingredient to the shopping list, one after another
      for (const name of suggestion.missingIngredients) {
        await apiClient.addShoppingItem({ name, source: 'RECIPE' });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopping-list'] }),
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t('stackTitles.recipe') }} />
        <ActivityIndicator size="large" color={colors.leafGreen} />
      </View>
    );
  }

  if (!suggestion) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t('stackTitles.recipe') }} />
        <Ionicons name="sad-outline" size={40} color={colors.textMuted} />
        <Text style={styles.notFound}>{t('recipe.notFound')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>{t('recipe.backToRecipes')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { recipe, score, matchedIngredients, missingIngredients } = suggestion;
  const percent = Math.round(score * 100);
  const total = matchedIngredients.length + missingIngredients.length;
  const matchedSet = new Set(matchedIngredients);
  const missingSet = new Set(missingIngredients);
  const steps = toSteps(recipe.instructions);

  const ingredientStatus = (name: string): 'have' | 'missing' | 'staple' =>
    matchedSet.has(name) ? 'have' : missingSet.has(name) ? 'missing' : 'staple';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: recipe.name }} />

      {/* recipe image, or a placeholder if there is none */}
      {recipe.imageUrl ? (
        <Image source={{ uri: recipe.imageUrl }} style={styles.hero} resizeMode="cover" />
      ) : (
        <View style={[styles.hero, styles.heroPlaceholder]}>
          <Ionicons name="restaurant" size={56} color={colors.leafGreen} />
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.title}>{recipe.name}</Text>

        <View style={styles.metaRow}>
          {recipe.category ? (
            <View style={styles.categoryChip}>
              <Ionicons name="pricetag-outline" size={13} color={colors.textMuted} />
              <Text style={styles.categoryText}>{recipe.category}</Text>
            </View>
          ) : null}
          <View style={styles.matchChip}>
            <Text style={styles.matchChipText}>{t('recipe.match', { percent })}</Text>
          </View>
        </View>

        {/* how many ingredients the user already has */}
        <View style={styles.card}>
          <Text style={styles.haveCount}>
            {t('recipe.haveCount', { matched: matchedIngredients.length, total })}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${percent}%` }]} />
          </View>
        </View>

        {/* the ingredients list */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="basket-outline" size={18} color={colors.forestGreen} />
            <Text style={styles.sectionTitle}>{t('recipe.ingredients')}</Text>
          </View>
          {recipe.ingredients.map((ing, i) => (
            <IngredientRow
              key={`${ing.name}-${i}`}
              name={ing.name}
              measure={ing.measure}
              status={ingredientStatus(ing.name)}
            />
          ))}

          {missingIngredients.length > 0 ? (
            <TouchableOpacity
              style={[styles.addButton, addMissing.isSuccess && styles.addButtonDone]}
              onPress={() => addMissing.mutate()}
              disabled={addMissing.isPending || addMissing.isSuccess}
              accessibilityRole="button"
            >
              {addMissing.isPending ? (
                <ActivityIndicator size="small" color={colors.onBrand} />
              ) : (
                <Ionicons
                  name={addMissing.isSuccess ? 'checkmark-circle' : 'cart-outline'}
                  size={16}
                  color={colors.onBrand}
                />
              )}
              <Text style={styles.addButtonText}>
                {addMissing.isPending
                  ? t('recipe.adding')
                  : addMissing.isSuccess
                    ? t('recipe.added')
                    : t('recipe.addMissing', { count: missingIngredients.length })}
              </Text>
            </TouchableOpacity>
          ) : null}
          {addMissing.isError ? (
            <Text style={styles.addError}>{t('recipe.addMissingError')}</Text>
          ) : null}
        </View>

        {/* the recipe steps */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="book-outline" size={18} color={colors.forestGreen} />
            <Text style={styles.sectionTitle}>{t('recipe.instructions')}</Text>
          </View>
          {steps.length === 0 ? (
            <Text style={styles.noInstructions}>{t('recipe.noInstructions')}</Text>
          ) : steps.length === 1 ? (
            <Text style={styles.paragraph}>{steps[0]}</Text>
          ) : (
            steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.warmCream },
  content: { paddingBottom: 32 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: colors.warmCream,
  },
  hero: { width: '100%', height: 220 },
  heroPlaceholder: {
    backgroundColor: colors.heroMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 16, gap: 14 },
  title: { fontSize: 24, fontFamily: font.black, color: colors.charcoal },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.creamSurface,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: { fontSize: 13, fontFamily: font.semibold, color: colors.textMuted },
  matchChip: {
    backgroundColor: colors.leafGreen,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  matchChipText: { fontSize: 13, fontFamily: font.bold, color: colors.onBrand },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 16, gap: 10 },
  haveCount: { fontSize: 14, fontFamily: font.semibold, color: colors.charcoal },
  track: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.creamSurface,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.leafGreen },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 17, fontFamily: font.bold, color: colors.charcoal },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.creamSurface,
  },
  ingredientMain: { flex: 1 },
  ingredientName: { fontSize: 15, fontFamily: font.semibold, color: colors.charcoal },
  ingredientMeasure: { fontSize: 13, color: colors.textMuted },
  ingredientTag: { fontSize: 11, fontFamily: font.bold, textTransform: 'uppercase' },
  addButton: {
    ...buttonLip,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.coralOrange,
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  addButtonDone: { backgroundColor: colors.leafGreen },
  addButtonText: { color: colors.onBrand, fontSize: 14, fontFamily: font.bold },
  addError: { fontSize: 13, color: colors.brickRed, textAlign: 'center' },
  paragraph: { fontSize: 15, color: colors.charcoal, lineHeight: 22 },
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.softMint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumber: { fontSize: 13, fontFamily: font.bold, color: colors.forestGreen },
  stepText: { flex: 1, fontSize: 15, color: colors.charcoal, lineHeight: 22 },
  noInstructions: { fontSize: 14, color: colors.textMuted },
  notFound: { fontSize: 16, fontFamily: font.bold, color: colors.charcoal, textAlign: 'center' },
  button: {
    ...buttonLip,
    backgroundColor: colors.leafGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  buttonText: { color: colors.onBrand, fontSize: 15, fontFamily: font.semibold },
});
