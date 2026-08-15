import { Ionicons } from '@expo/vector-icons';
import type { ConfirmOcrItem, OcrJob, OcrParsedItem, StockLocation } from '@pantryai/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
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
import { colors, font } from '../src/theme';

const POLL_MS = 2_000;
const TIMEOUT_MS = 60_000;

interface ReviewRow extends StockFieldsValue {
  index: number;
  name: string;
  confidence: number;
  selected: boolean;
}

function toReviewRows(items: OcrParsedItem[]): ReviewRow[] {
  return items.map((item, index) => ({
    index,
    name: item.name,
    confidence: item.confidence,
    selected: true,
    quantity: item.quantity != null ? String(item.quantity) : '',
    unit: item.unit ?? '',
    expirationDate: item.expirationDate,
    location: 'PANTRY' as StockLocation,
  }));
}

// Builds what we send for one row. We only add a field if it has a real value,
// otherwise we leave it out and the backend keeps the value it read from the receipt.
function toConfirmItem(row: ReviewRow): ConfirmOcrItem {
  const item: ConfirmOcrItem = { index: row.index, location: row.location };
  const qty = parseFloat(row.quantity);
  if (!isNaN(qty) && qty > 0) item.quantity = qty;
  if (row.unit.trim()) item.unit = row.unit.trim();
  if (row.expirationDate) item.expirationDate = row.expirationDate;
  return item;
}

export default function ScanResultScreen() {
  const { t } = useTranslation();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const startedAt = useRef(Date.now());
  const [rows, setRows] = useState<ReviewRow[] | null>(null);

  const {
    data: job,
    isError,
    error,
  } = useQuery<OcrJob>({
    queryKey: ['ocr-job', jobId],
    queryFn: () => apiClient.getOcrJob(jobId ?? ''),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'COMPLETED' || status === 'FAILED') return false;
      if (Date.now() - startedAt.current > TIMEOUT_MS) return false;
      return POLL_MS;
    },
    enabled: !!jobId,
    retry: 2,
  });

  // fill the editable list once, as soon as the receipt is done processing
  useEffect(() => {
    if (job?.status === 'COMPLETED' && rows === null) {
      setRows(toReviewRows((job.parsedItems ?? []) as OcrParsedItem[]));
    }
  }, [job, rows]);

  const confirm = useMutation({
    mutationFn: (items: ConfirmOcrItem[]) => apiClient.confirmOcrJob(jobId ?? '', { items }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stocks'] });
      void queryClient.invalidateQueries({ queryKey: ['waste'] });
      router.replace('/(tabs)');
    },
    onError: (err) => {
      Alert.alert(
        t('scanResult.addFailed'),
        err instanceof Error ? err.message : t('common.error'),
      );
    },
  });

  const updateRow = (index: number, patch: Partial<ReviewRow>) => {
    setRows((prev) =>
      prev ? prev.map((r) => (r.index === index ? { ...r, ...patch } : r)) : prev,
    );
  };

  const handleConfirm = () => {
    const selected = (rows ?? []).filter((r) => r.selected);
    if (selected.length === 0) {
      Alert.alert(t('scanResult.noneSelected'), t('scanResult.noneSelectedMessage'));
      return;
    }
    confirm.mutate(selected.map(toConfirmItem));
  };

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>{t('scanResult.loadError')}</Text>
        <Text style={styles.errorSub}>
          {error instanceof Error ? error.message : t('common.unknownError')}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>{t('scanResult.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isTerminal = job?.status === 'COMPLETED' || job?.status === 'FAILED';
  const timedOut = !isTerminal && !!job && Date.now() - startedAt.current > TIMEOUT_MS;

  if (!job || job.status === 'PENDING' || job.status === 'PROCESSING') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.leafGreen} />
        <Text style={styles.processingText}>{t('scanResult.processing')}</Text>
        <Text style={styles.processingSubText}>{t('scanResult.processingHint')}</Text>
      </View>
    );
  }

  if (timedOut) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>{t('scanResult.timeout')}</Text>
        <Text style={styles.errorSub}>{t('scanResult.timeoutMessage')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.buttonText}>{t('scanResult.goToStock')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (job.status === 'FAILED') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>{t('scanResult.failed')}</Text>
        <Text style={styles.errorSub}>{job.error ?? t('common.unknownError')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>{t('scanResult.tryAgain')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // The job is done but the effect hasn't built the rows yet. Without this we fall
  // through to the "no items" screen for a frame, which looked like the scan had
  // found nothing before the list appeared.
  if (rows === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.leafGreen} />
        <Text style={styles.processingText}>{t('scanResult.processing')}</Text>
      </View>
    );
  }

  const reviewRows = rows;
  const selectedCount = reviewRows.filter((r) => r.selected).length;

  if (reviewRows.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>{t('scanResult.noItemsTitle')}</Text>
        <Text style={styles.errorSub}>{t('scanResult.noItems')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.buttonText}>{t('scanResult.goToStock')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>
          {job.retailer ?? t('scanResult.receiptDefault')} · {t('scanResult.reviewItems')}
        </Text>
        <Text style={styles.subtitle}>{t('scanResult.reviewHint')}</Text>

        {reviewRows.map((row) => (
          <View key={row.index} style={[styles.itemCard, !row.selected && styles.itemCardOff]}>
            <TouchableOpacity
              style={styles.itemHeader}
              onPress={() => updateRow(row.index, { selected: !row.selected })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: row.selected }}
            >
              <Ionicons
                name={row.selected ? 'checkbox' : 'square-outline'}
                size={22}
                color={row.selected ? colors.leafGreen : colors.textMuted}
              />
              <Text style={styles.itemName}>{row.name}</Text>
              {row.confidence < 0.5 && (
                <View style={styles.lowConfidenceBadge}>
                  <Text style={styles.lowConfidenceText}>{t('scanResult.lowConfidence')}</Text>
                </View>
              )}
            </TouchableOpacity>

            {row.selected ? (
              <View style={styles.itemFields}>
                <StockFields value={row} onChange={(next) => updateRow(row.index, next)} />
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, confirm.isPending && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={confirm.isPending}
        >
          <Text style={styles.buttonText}>
            {confirm.isPending
              ? t('scanResult.adding')
              : t('scanResult.addSelected', { count: selectedCount })}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    gap: 12,
    backgroundColor: colors.warmCream,
  },
  title: {
    fontSize: 18,
    fontFamily: font.bold,
    color: colors.charcoal,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 8,
  },
  processingText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
  },
  processingSubText: {
    fontSize: 14,
    color: '#666',
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#c62828',
    textAlign: 'center',
  },
  errorSub: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  itemCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  itemCardOff: {
    opacity: 0.6,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontFamily: font.bold,
    color: colors.charcoal,
  },
  itemFields: {
    borderTopWidth: 1,
    borderTopColor: colors.creamSurface,
    paddingTop: 12,
  },
  lowConfidenceBadge: {
    backgroundColor: '#fff3e0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lowConfidenceText: {
    fontSize: 11,
    color: '#e65100',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.creamSurface,
    backgroundColor: colors.white,
  },
  button: {
    backgroundColor: colors.leafGreen,
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
