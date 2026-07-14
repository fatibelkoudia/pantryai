import { ApiClientError } from '@pantryai/shared';
import type { Product } from '@pantryai/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../src/api/client';
import { colors } from '../src/theme';

const MIN_SEARCH_LENGTH = 2;
const DEBOUNCE_MS = 300;

export default function ManualEntryScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // wait a moment after typing before we search, so we don't fire a request per keystroke
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(name.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [name]);

  const { data, isFetching } = useQuery({
    queryKey: ['product-search', searchTerm],
    queryFn: () => apiClient.listProducts({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.length >= MIN_SEARCH_LENGTH,
  });

  const matches = data?.items ?? [];

  const goToAddStock = (product: Pick<Product, 'id' | 'name' | 'brand'>) => {
    router.push({
      pathname: '/add-stock',
      params: {
        productId: product.id,
        productName: product.name,
        brand: product.brand ?? '',
      },
    });
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert(t('manualEntry.missingName'), t('manualEntry.missingNameMessage'));
      return;
    }

    setIsCreating(true);
    try {
      const created = await apiClient.createProduct({
        name: trimmedName,
        ...(brand.trim() ? { brand: brand.trim() } : {}),
      });
      goToAddStock(created);
    } catch (err) {
      const message =
        err instanceof ApiClientError && err.status === 401
          ? t('manualEntry.notLoggedIn')
          : err instanceof ApiClientError
            ? err.message
            : t('common.error');
      Alert.alert(t('common.errorTitle'), message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>{t('manualEntry.productNameLabel')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('manualEntry.productNamePlaceholder')}
            placeholderTextColor="#aaa"
            autoFocus
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('manualEntry.brandLabel')}</Text>
          <TextInput
            style={styles.input}
            value={brand}
            onChangeText={setBrand}
            placeholder={t('manualEntry.brandPlaceholder')}
            placeholderTextColor="#aaa"
          />
        </View>

        {searchTerm.length >= MIN_SEARCH_LENGTH && (
          <View style={styles.results}>
            <View style={styles.resultsHeader}>
              <Text style={styles.label}>{t('manualEntry.existingProducts')}</Text>
              {isFetching && <ActivityIndicator size="small" color={colors.leafGreen} />}
            </View>

            {matches.length > 0 ? (
              matches.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.resultRow}
                  onPress={() => goToAddStock(product)}
                >
                  <Text style={styles.resultName}>{product.name}</Text>
                  {!!product.brand && <Text style={styles.resultBrand}>{product.brand}</Text>}
                </TouchableOpacity>
              ))
            ) : !isFetching ? (
              <Text style={styles.noMatch}>{t('manualEntry.noMatch')}</Text>
            ) : null}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, isCreating && styles.submitButtonDisabled]}
          onPress={handleCreate}
          disabled={isCreating}
        >
          <Text style={styles.submitButtonText}>
            {isCreating ? t('manualEntry.creating') : t('manualEntry.createButton')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    padding: 24,
    gap: 20,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fafafa',
  },
  results: {
    gap: 8,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultRow: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  resultName: {
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
  },
  resultBrand: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  noMatch: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  submitButton: {
    backgroundColor: colors.leafGreen,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
