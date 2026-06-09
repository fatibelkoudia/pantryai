import type { RecipeSuggestion } from '@pantryai/shared';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../src/api/client';
import { buttonLip, colors, font } from '../../src/theme';

function RecipeCard({ suggestion }: { suggestion: RecipeSuggestion }) {
  const { recipe, score, matchedIngredients, missingIngredients } = suggestion;
  const percent = Math.round(score * 100);

  return (
    <View style={styles.card}>
      {recipe.imageUrl ? (
        <Image source={{ uri: recipe.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : null}

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{recipe.name}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{percent}%</Text>
          </View>
        </View>

        {recipe.category ? <Text style={styles.category}>{recipe.category}</Text> : null}

        <Text style={styles.label}>You have</Text>
        <Text style={styles.have}>
          {matchedIngredients.length > 0 ? matchedIngredients.join(', ') : 'None yet'}
        </Text>

        {missingIngredients.length > 0 ? (
          <>
            <Text style={styles.label}>Missing</Text>
            <Text style={styles.missing}>{missingIngredients.join(', ')}</Text>
          </>
        ) : (
          <Text style={styles.complete}>You have everything you need!</Text>
        )}
      </View>
    </View>
  );
}

export default function RecipesScreen() {
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
        <Text style={styles.errorTitle}>Could not load recipes</Text>
        <Text style={styles.errorSub}>
          {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => refetch()}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const suggestions = data?.suggestions ?? [];

  if (suggestions.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No recipes match your stock yet</Text>
        <Text style={styles.emptySub}>Add more items to your stock to unlock recipe ideas.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recipe ideas</Text>
      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.recipe.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <RecipeCard suggestion={item} />}
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
    gap: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 160,
  },
  cardBody: {
    padding: 14,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: font.bold,
    color: colors.charcoal,
  },
  badge: {
    backgroundColor: colors.leafGreen,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.onBrand,
    fontSize: 12,
    fontFamily: font.bold,
  },
  category: {
    fontSize: 13,
    color: colors.textMuted,
  },
  label: {
    fontSize: 13,
    fontFamily: font.semibold,
    color: colors.charcoal,
    marginTop: 6,
  },
  have: {
    fontSize: 14,
    color: colors.textMuted,
  },
  missing: {
    fontSize: 14,
    color: colors.coralOrange,
  },
  complete: {
    fontSize: 14,
    fontFamily: font.semibold,
    color: colors.leafGreen,
    marginTop: 6,
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
