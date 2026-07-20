import type { StockLocation } from '@pantryai/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { DateField } from './DateField';

const LOCATIONS: StockLocation[] = ['FRIDGE', 'FREEZER', 'PANTRY'];

export interface StockFieldsValue {
  quantity: string;
  unit: string;
  // date as "YYYY-MM-DD", empty means no date
  expirationDate?: string;
  location: StockLocation;
}

// The form with quantity, unit, expiration date and location.
// We use the same one everywhere we add or edit an item (manual add, barcode scan,
// receipt review and editing a stock item) so they all look the same.
// The parent gives the value and gets the changes back with onChange.
export function StockFields({
  value,
  onChange,
}: {
  value: StockFieldsValue;
  onChange: (next: StockFieldsValue) => void;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<StockFieldsValue>) => onChange({ ...value, ...patch });

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>{t('addStock.quantityLabel')}</Text>
          <TextInput
            style={styles.input}
            value={value.quantity}
            onChangeText={(quantity) => set({ quantity })}
            keyboardType="decimal-pad"
            placeholder={t('addStock.quantityPlaceholder')}
            placeholderTextColor="#aaa"
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>{t('addStock.unitLabel')}</Text>
          <TextInput
            style={styles.input}
            value={value.unit}
            onChangeText={(unit) => set({ unit })}
            placeholder={t('addStock.unitPlaceholder')}
            placeholderTextColor="#aaa"
            autoCapitalize="none"
          />
        </View>
      </View>

      <DateField
        label={t('addStock.expirationLabel')}
        value={value.expirationDate}
        onChange={(expirationDate) => set({ expirationDate })}
      />

      <View>
        <Text style={styles.label}>{t('addStock.locationLabel')}</Text>
        <View style={styles.locationRow}>
          {LOCATIONS.map((loc) => {
            const active = value.location === loc;
            return (
              <TouchableOpacity
                key={loc}
                style={[styles.locationButton, active && styles.locationButtonActive]}
                onPress={() => set({ location: loc })}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.locationText, active && styles.locationTextActive]}>
                  {t(`locations.${loc}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
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
  locationRow: { flexDirection: 'row', gap: 10 },
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
  locationText: { fontSize: 14, color: '#555', fontWeight: '500' },
  locationTextActive: { color: colors.leafGreen, fontWeight: '700' },
});
