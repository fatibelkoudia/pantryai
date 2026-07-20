import type { StockItemWithProduct, UpdateStockItemDto } from '@pantryai/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme';
import { BottomSheet } from './BottomSheet';
import { StockFields, type StockFieldsValue } from './StockFields';

function toFields(item: StockItemWithProduct): StockFieldsValue {
  return {
    quantity: String(item.quantity),
    unit: item.unit,
    expirationDate: item.expirationDate,
    location: item.location,
  };
}

// Bottom sheet to edit an item already in the stock (quantity, unit, date, location).
// It doesn't call the API itself, the parent does that with onSave.
export function EditStockSheet({
  item,
  saving,
  onClose,
  onSave,
}: {
  item: StockItemWithProduct | null;
  saving: boolean;
  onClose: () => void;
  onSave: (id: string, dto: UpdateStockItemDto) => void;
}) {
  const { t } = useTranslation();
  const [fields, setFields] = useState<StockFieldsValue>({
    quantity: '',
    unit: '',
    location: 'PANTRY',
  });

  // fill the form again each time we open a different item
  useEffect(() => {
    if (item) setFields(toFields(item));
  }, [item]);

  const handleSave = () => {
    if (!item) return;
    if (!fields.quantity || !fields.unit) {
      Alert.alert(t('addStock.missingFields'), t('addStock.missingFieldsMessage'));
      return;
    }
    const parsedQty = parseFloat(fields.quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      Alert.alert(t('addStock.invalidQuantity'), t('addStock.invalidQuantityMessage'));
      return;
    }
    onSave(item.id, {
      quantity: parsedQty,
      unit: fields.unit,
      // send null when there is no date so the backend removes the old one
      expirationDate: fields.expirationDate || null,
      location: fields.location,
    });
  };

  return (
    <BottomSheet visible={item !== null} title={t('stock.editTitle')} onClose={onClose}>
      {item ? <Text style={styles.productName}>{item.product.name}</Text> : null}

      <StockFields value={fields} onChange={setFields} />

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
        accessibilityRole="button"
      >
        <Text style={styles.saveButtonText}>
          {saving ? t('common.saving') : t('stock.saveChanges')}
        </Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  saveButton: {
    backgroundColor: colors.leafGreen,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
