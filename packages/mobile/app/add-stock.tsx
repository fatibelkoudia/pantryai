import { ApiClientError } from '@pantryai/shared';
import type { StockLocation } from '@pantryai/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useAuthStore } from '../src/store/auth';

const LOCATIONS: StockLocation[] = ['FRIDGE', 'FREEZER', 'PANTRY'];

const LOCATION_LABELS: Record<StockLocation, string> = {
  FRIDGE: 'Fridge',
  FREEZER: 'Freezer',
  PANTRY: 'Pantry',
};

export default function AddStockScreen() {
  const router = useRouter();
  const { productId, productName, brand } = useLocalSearchParams<{
    productId: string;
    productName: string;
    brand: string;
  }>();

  const accessToken = useAuthStore((s) => s.accessToken);

  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [location, setLocation] = useState<StockLocation>('PANTRY');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!quantity || !unit) {
      Alert.alert('Missing fields', 'Please enter quantity and unit.');
      return;
    }

    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      Alert.alert('Invalid quantity', 'Please enter a valid positive number.');
      return;
    }

    apiClient.setAccessToken(accessToken);
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
          ? 'You must be logged in to add items to stock.'
          : err instanceof ApiClientError
            ? err.message
            : 'Something went wrong. Please try again.';
      Alert.alert('Error', message);
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
          <Text style={styles.label}>Quantity *</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            placeholder="e.g. 1.5"
            placeholderTextColor="#aaa"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Unit *</Text>
          <TextInput
            style={styles.input}
            value={unit}
            onChangeText={setUnit}
            placeholder="e.g. kg, L, pcs"
            placeholderTextColor="#aaa"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Expiration date</Text>
          <TextInput
            style={styles.input}
            value={expirationDate}
            onChangeText={setExpirationDate}
            placeholder="YYYY-MM-DD (optional)"
            placeholderTextColor="#aaa"
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Location</Text>
          <View style={styles.locationRow}>
            {LOCATIONS.map((loc) => (
              <TouchableOpacity
                key={loc}
                style={[styles.locationButton, location === loc && styles.locationButtonActive]}
                onPress={() => setLocation(loc)}
              >
                <Text style={[styles.locationText, location === loc && styles.locationTextActive]}>
                  {LOCATION_LABELS[loc]}
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
          <Text style={styles.submitButtonText}>{isSubmitting ? 'Adding…' : 'Add to Stock'}</Text>
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
    borderColor: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  locationText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  locationTextActive: {
    color: '#2e7d32',
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#2e7d32',
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
