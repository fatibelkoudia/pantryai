import { ApiClientError } from '@pantryai/shared';
import type { StockLocation } from '@pantryai/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
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

const LOCATIONS: StockLocation[] = ['FRIDGE', 'FREEZER', 'PANTRY'];

export default function AddStockScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { productId, productName, brand } = useLocalSearchParams<{
    productId: string;
    productName: string;
    brand: string;
  }>();

  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [location, setLocation] = useState<StockLocation>('PANTRY');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!quantity || !unit) {
      Alert.alert(t('addStock.missingFields'), t('addStock.missingFieldsMessage'));
      return;
    }

    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      Alert.alert(t('addStock.invalidQuantity'), t('addStock.invalidQuantityMessage'));
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.createStockItem({
        productId: productId ?? '',
        quantity: parsedQty,
        unit,
        expirationDate: expirationDate.trim() || undefined,
        location,
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
          <Text style={styles.productName}>{productName}</Text>
          {!!brand && <Text style={styles.productBrand}>{brand}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('addStock.quantityLabel')}</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            placeholder={t('addStock.quantityPlaceholder')}
            placeholderTextColor="#aaa"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('addStock.unitLabel')}</Text>
          <TextInput
            style={styles.input}
            value={unit}
            onChangeText={setUnit}
            placeholder={t('addStock.unitPlaceholder')}
            placeholderTextColor="#aaa"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('addStock.expirationLabel')}</Text>
          <TextInput
            style={styles.input}
            value={expirationDate}
            onChangeText={setExpirationDate}
            placeholder={t('addStock.expirationPlaceholder')}
            placeholderTextColor="#aaa"
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('addStock.locationLabel')}</Text>
          <View style={styles.locationRow}>
            {LOCATIONS.map((loc) => (
              <TouchableOpacity
                key={loc}
                style={[styles.locationButton, location === loc && styles.locationButtonActive]}
                onPress={() => setLocation(loc)}
              >
                <Text style={[styles.locationText, location === loc && styles.locationTextActive]}>
                  {t(`locations.${loc}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

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
    marginBottom: 8,
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
  locationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  locationButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  locationButtonActive: {
    borderColor: colors.leafGreen,
    backgroundColor: '#e8f5e9',
  },
  locationText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  locationTextActive: {
    color: colors.leafGreen,
    fontWeight: '700',
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
