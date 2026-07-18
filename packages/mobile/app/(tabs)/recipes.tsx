import { Ionicons } from '@expo/vector-icons';
import type { RecipeSuggestion } from '@pantryai/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';
import { buttonLip, colors, font, radii } from '../../src/theme';

// pick the badge color from the match percent
function matchColor(percent: number): { bg: string; fg: string } {
  if (percent >= 90) return { bg: colors.forestGreen, fg: colors.onBrand };
  if (percent >= 80) return { bg: colors.leafGreen, fg: colors.onBrand };
  return { bg: colors.sunnyYellow, fg: colors.amberText };
}

function RecipeCard({
  suggestion,
  onPress,
}: {
  suggestion: RecipeSuggestion;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { recipe, score, matchedIngredients, missingIngredients } = suggestion;
  const percent = Math.round(score * 100);
  const total = matchedIngredients.length + missingIngredients.length;
  const badge = matchColor(percent);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('recipe.openRecipe', { name: recipe.name })}
    >
      {/* recipe image, or a placeholder if there is none */}
      <View style={styles.imageWrap}>
        {recipe.imageUrl ? (
          <Image source={{ uri: recipe.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="restaurant" size={40} color={colors.leafGreen} />
          </View>
        )}
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.fg }]}>
            {t('recipe.match', { percent })}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {recipe.name}
        </Text>

        <View style={styles.metaRow}>
          {recipe.category ? (
            <View style={styles.categoryChip}>
              <Ionicons name="pricetag-outline" size={12} color={colors.textMuted} />
              <Text style={styles.categoryText}>{recipe.category}</Text>
            </View>
          ) : null}
          <View style={styles.ingredientChip}>
            <Ionicons name="basket-outline" size={12} color={colors.forestGreen} />
            <Text style={styles.ingredientChipText}>
              {t('recipe.ingredientCount', { matched: matchedIngredients.length, total })}
            </Text>
          </View>
        </View>

        {/* match progress bar */}
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%`, backgroundColor: badge.bg }]} />
        </View>

        {missingIngredients.length > 0 ? (
          <View style={styles.missingRow}>
            <Ionicons name="cart-outline" size={14} color={colors.coralOrange} />
            <Text style={styles.missing} numberOfLines={1}>
              {t('recipe.missing')}: {missingIngredients.join(', ')}
            </Text>
          </View>
        ) : (
          <View style={styles.missingRow}>
            <Ionicons name="checkmark-circle" size={14} color={colors.leafGreen} />
            <Text style={styles.complete} numberOfLines={1}>
              {t('recipe.haveEverything')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.chevron}>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

export default function RecipesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => apiClient.suggestRecipes(),
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.leafGreen} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>{t('recipe.loadError')}</Text>
        <Text style={styles.errorSub}>
          {error instanceof Error ? error.message : t('common.unknownError')}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => refetch()}>
          <Text style={styles.buttonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const suggestions = data?.suggestions ?? [];

  if (suggestions.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>{t('recipe.empty')}</Text>
        <Text style={styles.emptySub}>{t('recipe.addMore')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>{t('nav.recipes')}</Text>
      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.recipe.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <RecipeCard suggestion={item} onPress={() => router.push(`/recipe/${item.recipe.id}`)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.warmCream,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
    backgroundColor: colors.warmCream,
  },
  title: {
    fontSize: 22,
    fontFamily: font.black,
    color: colors.charcoal,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  imageWrap: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 150,
  },
  imagePlaceholder: {
    backgroundColor: colors.heroMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: font.bold,
  },
  cardBody: {
    padding: 14,
    paddingRight: 34,
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: font.bold,
    color: colors.charcoal,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.creamSurface,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: font.semibold,
    color: colors.textMuted,
  },
  ingredientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.softMint,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ingredientChipText: {
    fontSize: 12,
    fontFamily: font.semibold,
    color: colors.forestGreen,
  },
  track: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.creamSurface,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  missing: {
    flex: 1,
    fontSize: 13,
    color: colors.coralOrange,
  },
  complete: {
    flex: 1,
    fontSize: 13,
    fontFamily: font.semibold,
    color: colors.leafGreen,
  },
  chevron: {
    position: 'absolute',
    right: 8,
    bottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: font.bold,
    color: colors.charcoal,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: font.bold,
    color: colors.coralOrange,
    textAlign: 'center',
  },
  errorSub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  button: {
    ...buttonLip,
    backgroundColor: colors.leafGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonText: {
    color: colors.onBrand,
    fontSize: 15,
    fontFamily: font.semibold,
  },
});
