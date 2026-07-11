import { Ionicons } from '@expo/vector-icons';
import type { ShoppingItem } from '@pantryai/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../src/api/client';
import { buttonLip, colors, font } from '../../src/theme';

const SOURCE_LABELS: Record<ShoppingItem['source'], string> = {
  LOW_STOCK: 'Low / expiring',
  RECIPE: 'Recipe',
  MANUAL: 'Manual',
};

// lowercase + drop accents so "Pâtes" and "pates" compare equal
function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function ShoppingRow({
  item,
  onToggle,
  onRemove,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={onToggle} style={styles.check} accessibilityRole="checkbox">
        <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
          {item.checked ? <Ionicons name="checkmark" size={14} color={colors.onBrand} /> : null}
        </View>
      </TouchableOpacity>
      <View style={styles.rowBody}>
        <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>
          {item.name}
          {item.quantity != null ? `  ${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : ''}
        </Text>
        <Text style={styles.source}>{SOURCE_LABELS[item.source]}</Text>
      </View>
      <TouchableOpacity
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.name}`}
        style={styles.removeBtn}
      >
        <Ionicons name="trash-outline" size={18} color={colors.brickRed} />
      </TouchableOpacity>
    </View>
  );
}

export default function ShoppingScreen() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['shopping-list'],
    queryFn: () => apiClient.getShoppingList(),
  });
  // stock and recipe suggestions feed the two helper cards (same keys as the
  // Inventory and Recipes tabs, so the cache is shared)
  const stocks = useQuery({
    queryKey: ['stocks'],
    queryFn: () => apiClient.listStocks(),
  });
  const recipes = useQuery({
    queryKey: ['recipes'],
    queryFn: () => apiClient.suggestRecipes(),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
  }

  const generate = useMutation({
    // stock only: the "Complete your meals" card handles recipe ingredients now
    mutationFn: () => apiClient.generateShoppingList({ includeRecipes: false }),
    onSuccess: invalidate,
  });

  const add = useMutation({
    mutationFn: (itemName: string) => apiClient.addShoppingItem({ name: itemName }),
    onSuccess: async () => {
      setName('');
      setShowAdd(false);
      await invalidate();
    },
  });

  const toggle = useMutation({
    mutationFn: (item: ShoppingItem) =>
      apiClient.updateShoppingItem(item.id, { checked: !item.checked }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.deleteShoppingItem(id),
    onSuccess: invalidate,
  });

  const removeDuplicates = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => apiClient.deleteShoppingItem(id))),
    onSuccess: invalidate,
  });

  const addMissing = useMutation({
    mutationFn: (names: string[]) =>
      Promise.all(names.map((n) => apiClient.addShoppingItem({ name: n, source: 'RECIPE' }))),
    onSuccess: invalidate,
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  // "Check before buying": unchecked items we already have at home. Low/expiring
  // items are on the list on purpose (we're restocking them), so they don't count.
  const duplicates = useMemo(() => {
    const stockNames = new Set(
      (stocks.data?.items ?? []).map((item) => normalizeName(item.product.name)),
    );
    return items.filter(
      (item) =>
        !item.checked && item.source !== 'LOW_STOCK' && stockNames.has(normalizeName(item.name)),
    );
  }, [items, stocks.data]);

  // "Complete your meals": ingredients still missing for the suggested recipes,
  // minus whatever is already on the list.
  const suggestions = useMemo(
    () => (recipes.data?.suggestions ?? []).filter((s) => s.missingIngredients.length > 0),
    [recipes.data],
  );
  const missingItems = useMemo(() => {
    const listed = new Set(items.map((item) => normalizeName(item.name)));
    const out: string[] = [];
    for (const suggestion of suggestions) {
      for (const ingredient of suggestion.missingIngredients) {
        const key = normalizeName(ingredient);
        if (!listed.has(key)) {
          listed.add(key);
          out.push(ingredient);
        }
      }
    }
    return out;
  }, [items, suggestions]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.leafGreen} />
      </View>
    );
  }

  function handleAdd() {
    const trimmed = name.trim();
    if (trimmed) add.mutate(trimmed);
  }

  // A preview like "Rice, Yogurt, Frozen peas" that doesn't overflow the card.
  const duplicateNames =
    duplicates.length > 3
      ? `${duplicates
          .slice(0, 3)
          .map((d) => d.name)
          .join(', ')} and ${duplicates.length - 3} more`
      : duplicates.map((d) => d.name).join(', ');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Shopping</Text>
        <Text style={styles.subtitle}>Your list before you head out</Text>
      </View>

      {isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Could not load your list</Text>
          <TouchableOpacity style={styles.button} onPress={() => refetch()}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {/* Check before buying: things already at home */}
              {duplicates.length > 0 ? (
                <View style={styles.dupCard}>
                  <View style={styles.cardTitleRow}>
                    <View style={styles.cardIcon}>
                      <Ionicons name="basket-outline" size={20} color={colors.amberText} />
                    </View>
                    <Text style={styles.cardTitle}>Check before buying</Text>
                  </View>
                  <Text style={styles.cardBody}>
                    You already have these at home: {duplicateNames}
                  </Text>
                  <TouchableOpacity
                    style={styles.cardBtn}
                    onPress={() => removeDuplicates.mutate(duplicates.map((d) => d.id))}
                    disabled={removeDuplicates.isPending}
                    accessibilityRole="button"
                  >
                    <Text style={styles.cardBtnText}>
                      {removeDuplicates.isPending ? 'Removing…' : 'Remove duplicates'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Complete your meals: what's missing for the suggested recipes */}
              {missingItems.length > 0 ? (
                <View style={styles.mealsCard}>
                  <View style={styles.cardTitleRow}>
                    <View style={styles.cardIcon}>
                      <Ionicons name="restaurant-outline" size={20} color={colors.forestGreen} />
                    </View>
                    <Text style={styles.cardTitle}>Complete your meals</Text>
                  </View>
                  <Text style={styles.cardBody}>
                    Add {missingItems.length} item{missingItems.length > 1 ? 's' : ''} to cook{' '}
                    {suggestions.length} suggested recipe{suggestions.length > 1 ? 's' : ''}:
                  </Text>
                  <View style={styles.chipsWrap}>
                    {missingItems.map((ingredient) => (
                      <View key={ingredient} style={styles.chip}>
                        <Text style={styles.chipText}>{ingredient}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={styles.cardBtn}
                    onPress={() => addMissing.mutate(missingItems)}
                    disabled={addMissing.isPending}
                    accessibilityRole="button"
                  >
                    <Text style={styles.cardBtnText}>
                      {addMissing.isPending ? 'Adding…' : 'Add missing items'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* List header + stock generator */}
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>
                  Your list{items.length > 0 ? ` (${items.length})` : ''}
                </Text>
                <TouchableOpacity
                  style={styles.generatePill}
                  onPress={() => generate.mutate()}
                  disabled={generate.isPending}
                  accessibilityRole="button"
                >
                  <Ionicons name="refresh-outline" size={14} color={colors.forestGreen} />
                  <Text style={styles.generateText}>
                    {generate.isPending ? 'Generating…' : 'Generate from stock'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.generateHint}>
                Adds what&apos;s running low or expiring soon from your inventory.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Your shopping list is empty</Text>
              <Text style={styles.emptySub}>
                Generate it from your stock above, or add an item with the + button.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ShoppingRow
              item={item}
              onToggle={() => toggle.mutate(item)}
              onRemove={() => remove.mutate(item.id)}
            />
          )}
        />
      )}

      {/* FAB: add an item by hand */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAdd(true)}
        accessibilityRole="button"
        accessibilityLabel="Add an item"
      >
        <Ionicons name="add" size={28} color={colors.onBrand} />
      </TouchableOpacity>

      {/* Small add dialog opened by the FAB */}
      <Modal
        visible={showAdd}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAdd(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add an item</Text>
            <TextInput
              style={styles.modalInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Olive oil"
              placeholderTextColor={colors.textMuted}
              autoFocus
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowAdd(false)}
                accessibilityRole="button"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAdd, (!name.trim() || add.isPending) && styles.disabled]}
                onPress={handleAdd}
                disabled={!name.trim() || add.isPending}
                accessibilityRole="button"
              >
                <Text style={styles.modalAddText}>{add.isPending ? 'Adding…' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.warmCream },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
    backgroundColor: colors.warmCream,
  },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  title: { fontSize: 22, fontFamily: font.black, color: colors.forestGreen },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 8 },
  listHeader: { gap: 12, marginBottom: 4 },
  dupCard: {
    backgroundColor: colors.paleYellow,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  mealsCard: {
    backgroundColor: colors.heroMint,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontFamily: font.bold, color: colors.charcoal },
  cardBody: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12, fontFamily: font.semibold, color: colors.charcoal },
  cardBtn: {
    ...buttonLip,
    backgroundColor: colors.forestGreen,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cardBtnText: { color: colors.onBrand, fontSize: 13, fontFamily: font.bold },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 17, fontFamily: font.bold, color: colors.charcoal },
  generatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  generateText: { fontSize: 12, fontFamily: font.bold, color: colors.forestGreen },
  generateHint: { fontSize: 11, color: colors.textMuted, marginTop: -6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  check: { padding: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.leafGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.leafGreen },
  rowBody: { flex: 1 },
  itemName: { fontSize: 15, fontFamily: font.semibold, color: colors.charcoal },
  itemNameChecked: { textDecorationLine: 'line-through', color: colors.textMuted },
  source: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  removeBtn: { padding: 6 },
  emptyBox: { alignItems: 'center', gap: 6, padding: 24 },
  emptyTitle: { fontSize: 17, fontFamily: font.bold, color: colors.charcoal, textAlign: 'center' },
  emptySub: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  errorTitle: { fontSize: 16, fontFamily: font.bold, color: colors.charcoal, textAlign: 'center' },
  button: {
    ...buttonLip,
    backgroundColor: colors.forestGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: { color: colors.onBrand, fontSize: 15, fontFamily: font.semibold },
  fab: {
    ...buttonLip,
    position: 'absolute',
    right: 16,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: colors.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.charcoal,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontFamily: font.bold, color: colors.charcoal },
  modalInput: {
    backgroundColor: colors.creamSurface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: font.regular,
    color: colors.charcoal,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalCancel: { paddingHorizontal: 14, paddingVertical: 10 },
  modalCancelText: { fontSize: 14, fontFamily: font.semibold, color: colors.textMuted },
  modalAdd: {
    ...buttonLip,
    backgroundColor: colors.forestGreen,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  modalAddText: { fontSize: 14, fontFamily: font.bold, color: colors.onBrand },
  disabled: { opacity: 0.5 },
});
