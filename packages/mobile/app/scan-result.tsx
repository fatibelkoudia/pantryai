import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { OcrJob, OcrParsedItem } from '@pantryai/shared';
import { apiClient } from '../src/api/client';

const POLL_MS = 2_000;
const TIMEOUT_MS = 60_000;

export default function ScanResultScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const startedAt = useRef(Date.now());

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

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not load result</Text>
        <Text style={styles.errorSub}>
          {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isTerminal = job?.status === 'COMPLETED' || job?.status === 'FAILED';
  const timedOut = !isTerminal && !!job && Date.now() - startedAt.current > TIMEOUT_MS;

  if (!job || job.status === 'PENDING' || job.status === 'PROCESSING') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={styles.processingText}>Processing your receipt…</Text>
        <Text style={styles.processingSubText}>This usually takes a few seconds</Text>
      </View>
    );
  }

  if (timedOut) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Still processing…</Text>
        <Text style={styles.errorSub}>Your items will appear in your stock shortly.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.buttonText}>Go to Stock</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (job.status === 'FAILED') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Processing failed</Text>
        <Text style={styles.errorSub}>{job.error ?? 'Unknown error'}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const items = (job.parsedItems ?? []) as OcrParsedItem[];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {job.retailer ?? 'Receipt'} — {items.length} item{items.length !== 1 ? 's' : ''} added
      </Text>

      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              {(item.quantity != null || item.unit) && (
                <Text style={styles.itemMeta}>
                  {[item.quantity, item.unit].filter(Boolean).join(' ')}
                </Text>
              )}
            </View>
            {item.confidence < 0.5 && (
              <View style={styles.lowConfidenceBadge}>
                <Text style={styles.lowConfidenceText}>Low confidence</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No items were detected in this receipt.</Text>
        }
      />

      <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.buttonText}>Go to Stock</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
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
    gap: 8,
    paddingBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  itemMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  lowConfidenceBadge: {
    backgroundColor: '#fff3e0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  lowConfidenceText: {
    fontSize: 11,
    color: '#e65100',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 15,
    marginTop: 32,
  },
  button: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
