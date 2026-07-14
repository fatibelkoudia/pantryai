import { ApiClientError } from '@pantryai/shared';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiClient } from '../src/api/client';
import { buttonLip, colors, font } from '../src/theme';

type ScanMode = 'ean' | 'qr';

export default function ScanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>('ean');
  const processingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      processingRef.current = false;
      setScannedCode(null);
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

  const handleQrScan = useCallback(
    async ({ data }: { data: string }) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setScannedCode(data);

      if (!data.startsWith('http://') && !data.startsWith('https://')) {
        Alert.alert(t('scan.notReceiptQr'), t('scan.notReceiptQrMessage'), [
          {
            text: t('common.ok'),
            onPress: () => {
              processingRef.current = false;
              setScannedCode(null);
            },
          },
        ]);
        return;
      }

      try {
        const { jobId } = await apiClient.scanQrReceipt(data);
        router.push({ pathname: '/scan-result', params: { jobId } });
      } catch (err) {
        const message =
          err instanceof ApiClientError
            ? `API error ${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : t('common.unknownError');
        Alert.alert(t('scan.qrFailed'), message, [
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
    [router],
  );

  const switchMode = useCallback((mode: ScanMode) => {
    setScanMode(mode);
    processingRef.current = false;
    setScannedCode(null);
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

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: [scanMode === 'ean' ? 'ean13' : 'qr'] }}
        onBarcodeScanned={
          scannedCode ? undefined : scanMode === 'ean' ? handleBarcodeScan : handleQrScan
        }
      />

      {/* Dim overlay once a code is detected */}
      {scannedCode && <View style={styles.dimOverlay} />}

      {scannedCode ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingCode}>{scannedCode}</Text>
          <Text style={styles.loadingText}>
            {scanMode === 'ean' ? t('scan.lookingUp') : t('scan.submitting')}
          </Text>
        </View>
      ) : (
        <View style={styles.scanOverlay}>
          <View style={styles.modeToggle}>
            {(['ean', 'qr'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.modeButton, scanMode === mode && styles.modeButtonActive]}
                onPress={() => switchMode(mode)}
              >
                <Text
                  style={[styles.modeButtonText, scanMode === mode && styles.modeButtonTextActive]}
                >
                  {mode === 'ean' ? t('scan.barcodeMode') : t('scan.qrMode')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.scanArea} />
          <Text style={styles.hint}>
            {scanMode === 'ean' ? t('scan.barcodeTip') : t('scan.qrTip')}
          </Text>
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
});
