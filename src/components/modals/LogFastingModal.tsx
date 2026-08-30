import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import Modal from '../common/Modal';
import { radius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';
import { FastingEntry, FastingReason } from '../../types';
import { getSystemLocalISOString } from '../../utils/date';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  existingFast?: FastingEntry;
  onSaveFasting: (entry: Omit<FastingEntry, 'id'>, existingId?: string) => void;
  onDeleteFasting: (id: string) => void;
}

const REASONS: FastingReason[] = ['intermittent', 'religious', 'medical', 'personal', 'other'];

export default function LogFastingModal({ isOpen, onClose, currentDate, existingFast, onSaveFasting, onDeleteFasting }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [hours, setHours] = useState(existingFast ? String(existingFast.duration_hours) : '16');
  const [reason, setReason] = useState<FastingReason>(existingFast?.reason || 'intermittent');
  const [notes, setNotes] = useState(existingFast?.notes || '');

  const handleSave = () => {
    const h = Number(hours);
    if (!h || h <= 0) return;
    const now = new Date();
    const start = new Date(now.getTime() - h * 3600 * 1000);
    onSaveFasting(
      {
        date: currentDate,
        start_time: start.toISOString(),
        end_time: now.toISOString(),
        duration_hours: h,
        reason,
        notes: notes.trim() || undefined,
        source: 'logged',
      },
      existingFast?.id
    );
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Fasting">
      <View style={{ gap: 12 }}>
        <View>
          <Text style={styles.label}>Fasting duration (hours)</Text>
          <TextInput style={styles.bigInput} value={hours} onChangeText={setHours} keyboardType="numeric" placeholderTextColor={colors.textFaint} />
        </View>

        <View>
          <Text style={styles.label}>Reason</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {REASONS.map((r) => (
              <Pressable key={r} style={[styles.chip, reason === r && styles.chipActive]} onPress={() => setReason(r)}>
                <Text style={[styles.chipText, reason === r && styles.chipTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholderTextColor={colors.textFaint} />
        </View>

        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Fast</Text>
        </Pressable>
        {existingFast && (
          <Pressable
            style={styles.deleteBtn}
            onPress={() => {
              onDeleteFasting(existingFast.id);
              onClose();
            }}
          >
            <Text style={styles.deleteBtnText}>Delete Entry</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  bigInput: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 14, color: colors.text, fontSize: 20, fontWeight: '800', borderWidth: 1, borderColor: colors.border },
  input: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 12, color: colors.text, borderWidth: 1, borderColor: colors.border },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.emeraldBg, borderColor: colors.emerald },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  chipTextActive: { color: colors.emerald },
  saveBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  deleteBtn: { borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: colors.rose },
  deleteBtnText: { color: colors.rose, fontWeight: '800', fontSize: 13 },
});
