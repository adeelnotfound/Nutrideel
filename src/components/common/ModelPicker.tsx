import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal as RNModal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../../theme';
import { GEMINI_MODELS } from '../../services/aiService';

interface Props {
  selectedModel: string;
  onSelect: (modelId: string) => void;
  compact?: boolean;
}

export default function ModelPicker({ selectedModel, onSelect, compact }: Props) {
  const [open, setOpen] = useState(false);
  const current = GEMINI_MODELS.find((m) => m.id === selectedModel) || GEMINI_MODELS[0];

  return (
    <View>
      <Pressable style={[styles.trigger, compact && styles.triggerCompact]} onPress={() => setOpen(true)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.triggerLabel}>{current.label}</Text>
          {!compact && <Text style={styles.triggerDesc}>{current.description}</Text>}
        </View>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      <RNModal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Choose AI Model</Text>
            {GEMINI_MODELS.map((m) => {
              const isSelected = m.id === selectedModel;
              return (
                <Pressable
                  key={m.id}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => {
                    onSelect(m.id);
                    setOpen(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>{m.label}</Text>
                    <Text style={styles.optionDesc}>{m.description}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.emerald} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </RNModal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border },
  triggerCompact: { paddingVertical: 8 },
  triggerLabel: { color: colors.text, fontWeight: '700', fontSize: 12.5 },
  triggerDesc: { color: colors.textFaint, fontSize: 10.5, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8 },
  sheetTitle: { color: colors.text, fontWeight: '800', fontSize: 15, marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: radius.md, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  optionSelected: { borderColor: colors.emerald, backgroundColor: colors.emeraldBg },
  optionLabel: { color: colors.text, fontWeight: '700', fontSize: 13 },
  optionLabelSelected: { color: colors.emerald },
  optionDesc: { color: colors.textFaint, fontSize: 10.5, marginTop: 2 },
});
