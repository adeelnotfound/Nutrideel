import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Modal from '../common/Modal';
import { colors, radius, cardShadow } from '../../theme';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  caloriesConsumed: number;
  calorieTarget: number;
  proteinConsumed: number;
  proteinTarget: number;
  carbsConsumed: number;
  carbsTarget: number;
  fatConsumed: number;
  fatTarget: number;
  steps: number;
  activeCaloriesBurned: number;
  onAdvanceToNextDay: () => void;
}

export default function DayDoneModal(props: Props) {
  const delta = props.caloriesConsumed - props.calorieTarget;
  const isOver = delta > 0;

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="Day Summary">
      <View style={{ gap: 14 }}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>{isOver ? '⚠️' : '✅'}</Text>
          <Text style={styles.heroTitle}>
            {isOver ? `${delta} kcal over target` : `${Math.abs(delta)} kcal under target`}
          </Text>
          <Text style={styles.heroSub}>
            {props.caloriesConsumed} / {props.calorieTarget} kcal logged today
          </Text>
        </View>

        <View style={styles.statGrid}>
          <Stat label="Protein" value={`${Math.round(props.proteinConsumed)}g`} target={`/ ${props.proteinTarget}g`} />
          <Stat label="Carbs" value={`${Math.round(props.carbsConsumed)}g`} target={`/ ${props.carbsTarget}g`} />
          <Stat label="Fat" value={`${Math.round(props.fatConsumed)}g`} target={`/ ${props.fatTarget}g`} />
        </View>

        <View style={styles.statGrid}>
          <Stat label="Steps" value={props.steps.toLocaleString()} target="" />
          <Stat label="Active kcal" value={String(props.activeCaloriesBurned)} target="" />
        </View>

        <Pressable
          style={styles.advanceBtn}
          onPress={() => {
            props.onAdvanceToNextDay();
            props.onClose();
          }}
        >
          <Text style={styles.advanceBtnText}>Advance to Tomorrow →</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Stat({ label, value, target }: { label: string; value: string; target: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value} <Text style={styles.statTarget}>{target}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: { backgroundColor: colors.cardAlt, borderRadius: radius.lg, padding: 18, alignItems: 'center', ...cardShadow },
  heroEmoji: { fontSize: 28, marginBottom: 6 },
  heroTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  heroSub: { color: colors.textFaint, fontSize: 12, marginTop: 4 },
  statGrid: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 10 },
  statLabel: { color: colors.textFaint, fontSize: 10.5, fontWeight: '700' },
  statValue: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 3 },
  statTarget: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  advanceBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  advanceBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
