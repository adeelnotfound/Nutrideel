import React, { useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Modal as RNModal } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';
import { lookupBarcodeProduct, BarcodeProductResult } from '../../services/openFoodFacts';
import { useToast } from '../common/ToastProvider';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called with a found product; caller is responsible for routing it into the food-log flow. */
  onProductFound: (result: BarcodeProductResult) => void;
  /** Called when the scanned barcode wasn't found in Open Food Facts, so the caller can offer manual entry / offline fallback. */
  onNotFound: (barcode: string) => void;
}

// Supported symbologies for packaged-food barcodes (EAN-13/UPC-A, plus the shorter variants
// that show up on smaller packaging).
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'];

export default function BarcodeScannerModal({ isOpen, onClose, onProductFound, onNotFound }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const toast = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const lockRef = useRef(false);

  const reset = useCallback(() => {
    lockRef.current = false;
    setScanning(true);
    setLoading(false);
  }, []);

  const close = () => {
    reset();
    onClose();
  };

  const handleScanned = async (result: BarcodeScanningResult) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setScanning(false);
    setLoading(true);
    try {
      const lookup = await lookupBarcodeProduct(result.data);
      setLoading(false);
      if (lookup.found) {
        onProductFound(lookup);
        close();
      } else {
        if (lookup.error === 'network_error') {
          toast.show('Could not reach Open Food Facts — check your connection', 'error');
        }
        onNotFound(lookup.barcode);
        close();
      }
    } catch {
      setLoading(false);
      toast.show('Something went wrong scanning that barcode', 'error');
      reset();
    }
  };

  return (
    <RNModal visible={isOpen} animationType="slide" onRequestClose={close}>
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={colors.emerald} />
          </View>
        ) : !permission.granted ? (
          <View style={styles.centerFill}>
            <Ionicons name="camera-outline" size={40} color={colors.textFaint} />
            <Text style={styles.permText}>Camera access is needed to scan barcodes.</Text>
            <Pressable style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Grant Camera Access</Text>
            </Pressable>
            <Pressable style={styles.cancelLink} onPress={close}>
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES as any }}
              onBarcodeScanned={scanning ? handleScanned : undefined}
            />
            <View style={styles.overlay} pointerEvents="box-none">
              <View style={styles.topBar}>
                <Pressable style={styles.closeBtn} onPress={close} hitSlop={10}>
                  <Ionicons name="close" size={22} color="#fff" />
                </Pressable>
                <Text style={styles.topBarTitle}>Scan Barcode</Text>
                <View style={{ width: 22 }} />
              </View>

              <View style={styles.frameWrap}>
                <View style={styles.frame} />
                <Text style={styles.hint}>{loading ? 'Looking up product…' : 'Line up the barcode inside the frame'}</Text>
              </View>

              {loading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </RNModal>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14, backgroundColor: colors.bg },
    permText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
    permBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 20 },
    permBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    cancelLink: { marginTop: 4, padding: 8 },
    cancelLinkText: { color: colors.textFaint, fontSize: 12.5, fontWeight: '600' },
    overlay: { flex: 1, justifyContent: 'space-between' },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 54,
      paddingHorizontal: 18,
      paddingBottom: 14,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    closeBtn: { width: 22 },
    topBarTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },
    frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
    frame: { width: 260, height: 150, borderRadius: radius.md, borderWidth: 3, borderColor: colors.emerald, backgroundColor: 'transparent' },
    hint: { color: '#fff', fontSize: 12.5, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm },
    loadingRow: { alignItems: 'center', paddingBottom: 60 },
  });
