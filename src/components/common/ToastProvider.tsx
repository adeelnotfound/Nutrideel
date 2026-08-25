import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../theme';

type ToastKind = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Never throw over a missing toast provider — a toast is a nice-to-have, not
    // something that should crash a screen if a component tree ever renders
    // without the provider above it.
    return { show: () => {} };
  }
  return ctx;
}

const ICONS: Record<ToastKind, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { name: 'checkmark-circle', color: colors.emerald },
  error: { name: 'alert-circle', color: colors.rose },
  info: { name: 'information-circle', color: colors.sky },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const show = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      idRef.current += 1;
      const id = idRef.current;
      setToast({ id, message, kind });

      if (timerRef.current) clearTimeout(timerRef.current);

      opacity.setValue(0);
      translateY.setValue(12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();

      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 12, duration: 200, useNativeDriver: true }),
        ]).start(() => {
          setToast((current) => (current?.id === id ? null : current));
        });
      }, 2200);
    },
    [opacity, translateY]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View style={[styles.wrap, { opacity, transform: [{ translateY }] }]} pointerEvents="none">
          <View style={styles.toast}>
            <Ionicons name={ICONS[toast.kind].name} size={16} color={ICONS[toast.kind].color} />
            <Text style={styles.text} numberOfLines={2}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 84, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 11,
    paddingHorizontal: 14,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { color: colors.text, fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
});
