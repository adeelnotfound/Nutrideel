import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, cardShadow } from '../../theme';
import ProgressBar from '../common/ProgressBar';
import { FastingEntry, WeightEntry, WeightUnit } from '../../types';
import { convertWeightFromKg } from '../../utils/calculations';

interface Props {
  calorieTarget: number;
  caloriesConsumed: number;
  proteinTarget: number;
  proteinConsumed: number;
  carbTarget: number;
  carbConsumed: number;
  fatTarget: number;
  fatConsumed: number;
  steps: number;
  activeCaloriesBurned: number;
  todayWeight?: WeightEntry;
  todayFast?: FastingEntry;
  weightUnit: WeightUnit;
  onOpenWeightModal: () => void;
  onOpenActivityModal: () => void;
  onOpenFastingModal: () => void;
  onOpenDayDone: () => void;
}

export default function MacroSummary({
  calorieTarget,
  caloriesConsumed,
  proteinTarget,
  proteinConsumed,
  carbTarget,
  carbConsumed,
  fatTarget,
  fatConsumed,
  steps,
  activeCaloriesBurned,
  todayWeight,
  todayFast,
  weightUnit,
  onOpenWeightModal,
  onOpenActivityModal,
  onOpenFastingModal,
  onOpenDayDone,
}: Props) {
  const caloriesRemaining = Math.max(0, calorieTarget - caloriesConsumed);
  const isOver = caloriesConsumed > calorieTarget && calorieTarget > 0;
  const calPercent = Math.min(100, Math.round((caloriesConsumed / (calorieTarget || 1)) * 100));

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>DAILY CALORIE BUDGET</Text>
          <View style={styles.calRow}>
            <Text style={styles.calBig}>{caloriesConsumed.toLocaleString()}</Text>
            <Text style={styles.calTarget}> / {calorieTarget.toLocaleString()} kcal</Text>
          </View>
          <Text style={[styles.calStatus, { color: isOver ? colors.amber : colors.emerald }]}>
            {isOver ? `+${caloriesConsumed - calorieTarget} kcal over target` : `${caloriesRemaining.toLocaleString()} kcal remaining`}
          </Text>
        </View>
        <Pressable onPress={onOpenDayDone} style={styles.dayDoneBtn}>
          <Text style={styles.dayDoneText}>✨ Day Done</Text>
        </Pressable>
      </View>

      <View style={styles.progressOuter}>
        <ProgressBar pct={calPercent} color={isOver ? colors.amber : colors.emerald} height={10} />
        <Text style={styles.pctText}>{calPercent}%</Text>
      </View>

      <View style={styles.macroRow}>
        <MacroCol label="Protein" consumed={proteinConsumed} target={proteinTarget} color={colors.sky} />
        <MacroCol label="Carbs" consumed={carbConsumed} target={carbTarget} color={colors.amber} />
        <MacroCol label="Fat" consumed={fatConsumed} target={fatTarget} color={colors.violet} />
      </View>

      <View style={styles.vitalsRow}>
        <Pressable style={styles.vitalBtn} onPress={onOpenActivityModal}>
          <View style={styles.vitalHeader}>
            <Ionicons name="footsteps-outline" size={14} color={colors.emerald} />
            <Text style={styles.vitalLabel}>Steps</Text>
          </View>
          <Text style={styles.vitalValue}>{steps > 0 ? steps.toLocaleString() : 'Log steps'}</Text>
          <Text style={styles.vitalSub}>{activeCaloriesBurned > 0 ? `${activeCaloriesBurned} kcal burned` : '0 kcal burned'}</Text>
        </Pressable>

        <Pressable style={styles.vitalBtn} onPress={onOpenWeightModal}>
          <View style={styles.vitalHeader}>
            <Ionicons name="scale-outline" size={14} color={colors.violet} />
            <Text style={styles.vitalLabel}>Weight</Text>
          </View>
          <Text style={styles.vitalValue}>
            {todayWeight ? convertWeightFromKg(todayWeight.weight_kg, weightUnit).formatted : 'Log weight'}
          </Text>
          <Text style={styles.vitalSub}>{todayWeight?.body_fat_pct ? `${todayWeight.body_fat_pct}% BF` : 'Today'}</Text>
        </Pressable>

        <Pressable style={styles.vitalBtn} onPress={onOpenFastingModal}>
          <View style={styles.vitalHeader}>
            <Ionicons name="time-outline" size={14} color={colors.sky} />
            <Text style={styles.vitalLabel}>Fasting</Text>
          </View>
          <Text style={styles.vitalValue}>{todayFast ? `${todayFast.duration_hours}h fast` : 'Not fasting'}</Text>
          <Text style={styles.vitalSub}>{todayFast ? todayFast.reason : 'Explicit log only'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MacroCol({ label, consumed, target, color }: { label: string; consumed: number; target: number; color: string }) {
  const pct = target > 0 ? (consumed / target) * 100 : 0;
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {Math.round(consumed)}/{Math.round(target)}g
        </Text>
      </View>
      <ProgressBar pct={pct} color={color} height={6} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: colors.border, ...cardShadow },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  calRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  calBig: { fontSize: 32, fontWeight: '800', color: colors.text },
  calTarget: { fontSize: 15, color: colors.textMuted, fontWeight: '600' },
  calStatus: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  dayDoneBtn: { backgroundColor: colors.emeraldBg, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: colors.emerald },
  dayDoneText: { color: colors.emerald, fontSize: 12, fontWeight: '800' },
  progressOuter: { marginTop: 14, marginBottom: 4 },
  pctText: { fontSize: 10, color: colors.textFaint, marginTop: 4, textAlign: 'right' },
  macroRow: { flexDirection: 'row', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  macroHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  macroLabel: { fontSize: 11, fontWeight: '700', color: colors.text },
  macroValue: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  vitalsRow: { flexDirection: 'row', gap: 8, paddingTop: 14 },
  vitalBtn: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.border },
  vitalHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vitalLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  vitalValue: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 4 },
  vitalSub: { fontSize: 10, color: colors.textFaint, marginTop: 1 },
});
