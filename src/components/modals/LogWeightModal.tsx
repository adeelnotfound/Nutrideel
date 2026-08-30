import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import Modal from '../common/Modal';
import { radius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';
import { WeightEntry, WeightUnit } from '../../types';
import { convertWeightFromKg, convertWeightToKg } from '../../utils/calculations';
import { getSystemLocalISOString } from '../../utils/date';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  userWeightUnit: WeightUnit;
  lastWeightKg: number;
  existingWeight?: WeightEntry;
  onSaveWeight: (entry: Omit<WeightEntry, 'id'>, existingId?: string) => void;
  onDeleteWeight: (id: string) => void;
}

export default function LogWeightModal({ isOpen, onClose, currentDate, userWeightUnit, lastWeightKg, existingWeight, onSaveWeight, onDeleteWeight }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [value, setValue] = useState('');
  const [stoneLbValue, setStoneLbValue] = useState('');
  const [notes, setNotes] = useState('');
  const isStLb = userWeightUnit === 'st_lb';

  useEffect(() => {
    if (isOpen) {
      const kg = existingWeight?.weight_kg ?? lastWeightKg;
      const converted = convertWeightFromKg(kg, userWeightUnit);
      if (isStLb) {
        setValue(String(Math.floor(converted.value / 14)));
        setStoneLbValue((converted.value % 14).toFixed(1));
      } else {
        setValue(converted.value.toFixed(1));
        setStoneLbValue('');
      }
      setNotes(existingWeight?.notes || '');
    }
  }, [isOpen, existingWeight, lastWeightKg, userWeightUnit]);

  const handleSave = () => {
    const numVal = Number(value);
    if (!numVal && !isStLb) return;
    if (isStLb && !numVal && !Number(stoneLbValue)) return;
    const kg = isStLb
      ? convertWeightToKg(numVal, 'st_lb', Number(stoneLbValue) || 0)
      : convertWeightToKg(numVal, userWeightUnit);
    if (kg <= 0) return;
    onSaveWeight(
      {
        date: currentDate,
        timestamp: getSystemLocalISOString(),
        weight_kg: Number(kg.toFixed(2)),
        notes: notes.trim() || undefined,
        source: 'logged',
      },
      existingWeight?.id
    );
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Weight">
      <View style={{ gap: 12 }}>
        {isStLb ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Stone</Text>
              <TextInput
                style={styles.bigInput}
                value={value}
                onChangeText={setValue}
                keyboardType="numeric"
                placeholder="11"
                placeholderTextColor={colors.textFaint}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Pounds</Text>
              <TextInput
                style={styles.bigInput}
                value={stoneLbValue}
                onChangeText={setStoneLbValue}
                keyboardType="decimal-pad"
                placeholder="3.2"
                placeholderTextColor={colors.textFaint}
              />
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.label}>Weight ({userWeightUnit})</Text>
            <TextInput
              style={styles.bigInput}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor={colors.textFaint}
            />
          </View>
        )}
        <View>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Morning weigh-in, fasted"
            placeholderTextColor={colors.textFaint}
          />
        </View>
        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Weight</Text>
        </Pressable>
        {existingWeight && (
          <Pressable
            style={styles.deleteBtn}
            onPress={() => {
              onDeleteWeight(existingWeight.id);
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
  bigInput: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 14, color: colors.text, fontSize: 22, fontWeight: '800', borderWidth: 1, borderColor: colors.border },
  input: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 12, color: colors.text, borderWidth: 1, borderColor: colors.border },
  saveBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  deleteBtn: { borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: colors.rose },
  deleteBtnText: { color: colors.rose, fontWeight: '800', fontSize: 13 },
});
