import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import Modal from '../common/Modal';
import { radius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';
import { ActivityEntry, ActivityType } from '../../types';
import { getSystemLocalISOString } from '../../utils/date';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  existingActivities: ActivityEntry[];
  onSaveActivity: (entry: Omit<ActivityEntry, 'id'>, existingId?: string) => void;
  onDeleteActivity: (id: string) => void;
}

const TYPES: ActivityType[] = ['walking', 'running', 'cycling', 'gym', 'swimming', 'sports', 'custom'];

export default function LogActivityModal({ isOpen, onClose, currentDate, existingActivities, onSaveActivity, onDeleteActivity }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [type, setType] = useState<ActivityType>('walking');
  const [name, setName] = useState('');
  const [steps, setSteps] = useState('');
  const [duration, setDuration] = useState('');
  const [calsBurned, setCalsBurned] = useState('');

  const handleSave = () => {
    if (!steps && !duration && !calsBurned) return;
    onSaveActivity({
      date: currentDate,
      timestamp: getSystemLocalISOString(),
      type,
      name: name.trim() || type,
      duration_minutes: Number(duration) || 0,
      steps: Number(steps) || 0,
      calories_burned: Number(calsBurned) || 0,
      source: 'logged',
    });
    setName('');
    setSteps('');
    setDuration('');
    setCalsBurned('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Activity">
      <View style={{ gap: 12 }}>
        <View>
          <Text style={styles.label}>Activity type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TYPES.map((t) => (
              <Pressable key={t} style={[styles.typeChip, type === t && styles.typeChipActive]} onPress={() => setType(t)}>
                <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View>
          <Text style={styles.label}>Activity name (optional)</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Evening walk" placeholderTextColor={colors.textFaint} />
        </View>

        <View style={styles.row2}>
          <Field label="Steps" value={steps} onChangeText={setSteps} />
          <Field label="Duration (min)" value={duration} onChangeText={setDuration} />
        </View>
        <Field label="Calories burned" value={calsBurned} onChangeText={setCalsBurned} />

        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Activity</Text>
        </Pressable>

        {existingActivities.length > 0 && (
          <View style={styles.existingWrap}>
            <Text style={styles.existingTitle}>Today's activities</Text>
            {existingActivities.map((a) => (
              <View key={a.id} style={styles.existingRow}>
                <Text style={styles.existingText}>
                  {a.name} · {a.steps} steps · {a.calories_burned} kcal
                </Text>
                <Pressable onPress={() => onDeleteActivity(a.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

function Field(props: { label: string; value: string; onChangeText: (t: string) => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.textFaint}
      />
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 12, color: colors.text, borderWidth: 1, borderColor: colors.border },
  row2: { flexDirection: 'row', gap: 10 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  typeChipActive: { backgroundColor: colors.emeraldBg, borderColor: colors.emerald },
  typeChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  typeChipTextActive: { color: colors.emerald },
  saveBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  existingWrap: { marginTop: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  existingTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  existingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  existingText: { color: colors.text, fontSize: 12, flex: 1 },
  removeText: { color: colors.rose, fontSize: 11, fontWeight: '700' },
});
