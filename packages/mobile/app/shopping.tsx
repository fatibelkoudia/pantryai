import type { ShoppingItem } from '@pantryai/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../src/api/client';
import { colors } from '../src/theme';

const SOURCE_LABELS: Record<ShoppingItem['source'], string> = {
  LOW_STOCK: 'Low / expiring',
  RECIPE: 'Recipe',
  MANUAL: 'Manual',
};

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
          {item.checked ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
      </TouchableOpacity>
      <View style={styles.rowBody}>
        <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>
          {item.name}
          {item.quantity != null ? `  ${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : ''}
        </Text>
        <Text style={styles.source}>{SOURCE_LABELS[item.source]}</Text>
      </View>
      <TouchableOpacity onPress={onRemove} accessibilityLabel={`Remove ${item.name}`}>
        <Text style={styles.remove}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ShoppingScreen() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['shopping-list'],
    queryFn: () => apiClient.getShoppingList(),
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
  }

  const generate = useMutation({
    mutationFn: () => apiClient.generateShoppingList({}),
    onSuccess: invalidate,
  });

  const add = useMutation({
    mutationFn: (itemName: string) => apiClient.addShoppingItem({ name: itemName }),
    onSuccess: async () => {
      setName('');
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

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.leafGreen} />
      </View>
    );
  }

  const items = data?.items ?? [];

  function handleAdd() {
    const trimmed = name.trim();
    if (trimmed) add.mutate(trimmed);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shopping list</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.generateButton, generate.isPending && styles.buttonDisabled]}
          onPress={() => generate.mutate()}
          disabled={generate.isPending}
        >
          <Text style={styles.generateText}>
            {generate.isPending ? 'Generating…' : 'Generate from stock + recipes'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Add an item…"
          placeholderTextColor="#999"
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addButton, (!name.trim() || add.isPending) && styles.buttonDisabled]}
          onPress={handleAdd}
          disabled={!name.trim() || add.isPending}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Could not load your list</Text>
          <TouchableOpacity style={styles.generateButton} onPress={() => refetch()}>
            <Text style={styles.generateText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Your shopping list is empty</Text>
          <Text style={styles.emptySub}>Generate one from your stock or add an item above.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ShoppingRow
              item={item}
              onToggle={() => toggle.mutate(item)}
              onRemove={() => remove.mutate(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  actions: { paddingHorizontal: 16, paddingBottom: 8 },
  generateButton: {
    backgroundColor: colors.leafGreen,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  generateText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  addButton: {
    backgroundColor: colors.leafGreen,
    paddingHorizontal: 18,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  check: { padding: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.leafGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.leafGreen },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rowBody: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  itemNameChecked: { textDecorationLine: 'line-through', color: '#999', fontWeight: '400' },
  source: { fontSize: 12, color: '#999', marginTop: 2 },
  remove: { fontSize: 13, color: '#c62828' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#333', textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#777', textAlign: 'center' },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#c62828', textAlign: 'center' },
});
