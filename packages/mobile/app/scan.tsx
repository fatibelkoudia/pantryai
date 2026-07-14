import { ApiClientError } from '@pantryai/shared';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiClient } from '../src/api/client';
import { buttonLip, colors, font } from '../src/theme';

type ScanMode = 'ean' | 'receipt';

export default function ScanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { mode: initialMode } = useLocalSearchParams<{ mode?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>(initialMode === 'receipt' ? 'receipt' : 'ean');
  const cameraRef = useRef<CameraView>(null);
  const processingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      processingRef.current = false;
      setScannedCode(null);
      setUploading(false);
    }, []),
  );

  const handleBarcodeScan = useCallback(
    async ({ data }: { data: string }) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setScannedCode(data);

      try {
        const product = await apiClient.getProductByEan13(data);
        router.push({
          pathname: '/add-stock',
          params: {
            productId: product.id,
            productName: product.name,
            brand: product.brand ?? '',
            imageUrl: product.imageUrl ?? '',
          },
        });
      } catch (err) {
        console.error('[ScanScreen] EAN lookup failed:', err);
        const message =
          err instanceof ApiClientError && err.status === 404
            ? t('scan.productNotFound')
            : err instanceof ApiClientError
              ? `API error ${err.status}: ${err.message}`
              : err instanceof Error
                ? err.message
                : t('common.unknownError');
        Alert.alert(t('scan.lookupFailed'), message, [
          {
            text: t('common.ok'),
            onPress: () => {
              processingRef.current = false;
              setScannedCode(null);
            },
          },
        ]);
      }
    },
    [router, t],
  );

  const handleCaptureReceipt = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setUploading(true);

    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (!photo) throw new Error(t('common.unknownError'));

      // React Native FormData takes a { uri, name, type } object where the
      // browser takes a Blob, so we cast to keep the shared client's signature.
      const file = {
        uri: photo.uri,
        name: 'receipt.jpg',
        type: 'image/jpeg',
      } as unknown as Blob;

      const { jobId } = await apiClient.scanReceipt(file);
      router.push({ pathname: '/scan-result', params: { jobId } });
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? `API error ${err.status}: ${err.message}`
          : err instanceof Error
            ? err.message
            : t('common.unknownError');
      Alert.alert(t('receipt.uploadFailed'), message, [
        {
          text: t('common.ok'),
          onPress: () => {
            processingRef.current = false;
            setUploading(false);
          },
        },
      ]);
    }
  }, [router, t]);

  const switchMode = useCallback((mode: ScanMode) => {
    setScanMode(mode);
    processingRef.current = false;
    setScannedCode(null);
    setUploading(false);
  }, []);

  if (!permission) {
    return <View style={styles.centered} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>{t('scan.cameraPermission')}</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>{t('scan.grantPermission')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const busy = scannedCode !== null || uploading;

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
        onBarcodeScanned={scanMode === 'ean' && !busy ? handleBarcodeScan : undefined}
      />

      {/* Dim overlay while looking up a code or uploading a photo */}
      {busy && <View style={styles.dimOverlay} />}

      {busy ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          {scannedCode ? <Text style={styles.loadingCode}>{scannedCode}</Text> : null}
          <Text style={styles.loadingText}>
            {scanMode === 'ean' ? t('scan.lookingUp') : t('scan.submitting')}
          </Text>
        </View>
      ) : (
        <View style={styles.scanOverlay}>
          <View style={styles.modeToggle}>
            {(['ean', 'receipt'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.modeButton, scanMode === mode && styles.modeButtonActive]}
                onPress={() => switchMode(mode)}
              >
                <Text
                  style={[styles.modeButtonText, scanMode === mode && styles.modeButtonTextActive]}
                >
                  {mode === 'ean' ? t('scan.barcodeMode') : t('scan.receiptMode')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={scanMode === 'ean' ? styles.scanArea : styles.receiptArea} />
          <Text style={styles.hint}>
            {scanMode === 'ean' ? t('scan.barcodeTip') : t('scan.receiptTip')}
          </Text>
          {scanMode === 'receipt' && (
            <TouchableOpacity
              style={styles.shutter}
              onPress={handleCaptureReceipt}
              accessibilityRole="button"
              accessibilityLabel={t('scan.captureA11y')}
            >
              <View style={styles.shutterInner} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  button: {
    ...buttonLip,
    backgroundColor: colors.leafGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: colors.onBrand,
    fontSize: 16,
    fontFamily: font.semibold,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingCode: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanArea: {
    width: 260,
    height: 160,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 8,
  },
  // taller frame, receipts are portrait
  receiptArea: {
    width: 240,
    height: 340,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 8,
  },
  hint: {
    marginTop: 20,
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
    marginBottom: 32,
  },
  modeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
  },
  modeButtonActive: {
    backgroundColor: '#fff',
  },
  modeButtonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: colors.leafGreen,
    fontWeight: '700',
  },
  shutter: {
    marginTop: 28,
    width: 68,
    height: 68,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
});
