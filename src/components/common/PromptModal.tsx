import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal as RNModal, KeyboardAvoidingView, Platform } from 'react-native';
import { radius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  isOpen: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

// React Native's Alert.prompt only exists on iOS — Android has no built-in equivalent,
// so this is a small cross-platform replacement for "type a name and confirm" flows.
export default function PromptModal({ isOpen, title, message, placeholder, initialValue, confirmLabel = 'Save', onCancel, onConfirm }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [value, setValue] = useState(initialValue || '');

  useEffect(() => {
    if (isOpen) setValue(initialValue || '');
  }, [isOpen, initialValue]);

  return (
    <RNModal visible={isOpen} animationType="fade" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={colors.textFaint}
            autoFocus
            onSubmitEditing={() => value.trim() && onConfirm(value.trim())}
          />
          <View style={styles.row}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, !value.trim() && styles.confirmBtnDisabled]}
              onPress={() => value.trim() && onConfirm(value.trim())}
              disabled={!value.trim()}
            >
              <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 15, fontWeight: '800' },
  message: { color: colors.textFaint, fontSize: 12, marginTop: 4, lineHeight: 16 },
  input: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 12, color: colors.text, borderWidth: 1, borderColor: colors.border, marginTop: 14 },
  row: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  confirmBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.emerald },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
