import { ApiClientError } from '@pantryai/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../src/api/client';
import { StockFields, type StockFieldsValue } from '../src/components/StockFields';
import { colors } from '../src/theme';

export default function AddStockScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { productId, productName, brand, imageUrl } = useLocalSearchParams<{
    productId: string;
    productName: string;
    brand: string;
    imageUrl: string;
  }>();

  const [fields, setFields] = useState<StockFieldsValue>({
    quantity: '',
    unit: '',
    expirationDate: undefined,
    location: 'PANTRY',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!fields.quantity || !fields.unit) {
      Alert.alert(t('addStock.missingFields'), t('addStock.missingFieldsMessage'));
      return;
    }

    const parsedQty = parseFloat(fields.quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      Alert.alert(t('addStock.invalidQuantity'), t('addStock.invalidQuantityMessage'));
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.createStockItem({
        productId: productId ?? '',
        quantity: parsedQty,
        unit: fields.unit,
        expirationDate: fields.expirationDate || undefined,
        location: fields.location,
      });
      router.replace('/(tabs)');
    } catch (err) {
      const message =
        err instanceof ApiClientError && err.status === 401
          ? t('addStock.notLoggedIn')
          : err instanceof ApiClientError
            ? err.message
            : t('common.error');
      Alert.alert(t('common.errorTitle'), message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.productHeader}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
          ) : null}
          <View style={styles.productHeaderText}>
            <Text style={styles.productName}>{productName}</Text>
            {!!brand && <Text style={styles.productBrand}>{brand}</Text>}
          </View>
        </View>

        <StockFields value={fields} onChange={setFields} />

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? t('addStock.submitting') : t('addStock.submitButton')}
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
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.creamSurface,
  },
  productHeaderText: {
    flex: 1,
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  productBrand: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
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
