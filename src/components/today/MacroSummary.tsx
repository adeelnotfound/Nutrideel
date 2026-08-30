import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, cardShadow } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';
import ProgressBar from '../common/ProgressBar';
import ProgressRing from '../common/ProgressRing';
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
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  // MFP-style budget: goal + exercise earns you extra room, food spends it.
  const adjustedBudget = calorieTarget + activeCaloriesBurned;
  const caloriesRemaining = Math.max(0, adjustedBudget - caloriesConsumed);
  const isOver = caloriesConsumed > adjustedBudget && calorieTarget > 0;
  const calPercent = Math.round((caloriesConsumed / (adjustedBudget || 1)) * 100);
  const ringPercent = Math.min(100, calPercent);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <ProgressRing
          size={92}
          strokeWidth={9}
          pct={ringPercent}
          color={isOver ? colors.amber : colors.emerald}
          trackColor={colors.cardAlt}
        >
          <Text style={styles.ringValue}>{isOver ? `+${Math.round(caloriesConsumed - adjustedBudget)}` : Math.round(caloriesRemaining)}</Text>
          <Text style={styles.ringLabel}>{isOver ? 'over' : 'left'}</Text>
        </ProgressRing>

        <View style={styles.budgetBreakdown}>
          <Text style={styles.label}>DAILY CALORIE BUDGET</Text>
          <BudgetLine label="Goal" value={calorieTarget} icon="flag-outline" />
          <BudgetLine label="Food" value={caloriesConsumed} icon="restaurant-outline" sign="-" />
          <BudgetLine label="Exercise" value={activeCaloriesBurned} icon="flame-outline" sign="+" />
        </View>
      </View>

      <Pressable onPress={onOpenDayDone} style={styles.dayDoneBtn}>
        <Ionicons name="checkmark-circle-outline" size={16} color={colors.emerald} />
        <Text style={styles.dayDoneText}>Mark day done</Text>
      </Pressable>

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

function BudgetLine({ label, value, icon, sign }: { label: string; value: number; icon: any; sign?: '+' | '-' }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.budgetLine}>
      <Ionicons name={icon} size={13} color={colors.textFaint} style={{ width: 16 }} />
      <Text style={styles.budgetLabel}>{label}</Text>
      <Text style={styles.budgetValue}>{sign ? `${sign} ` : ''}{Math.round(value).toLocaleString()}</Text>
    </View>
  );
}

function MacroCol({ label, consumed, target, color }: { label: string; consumed: number; target: number; color: string }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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

const makeStyles = (colors: any) => StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: colors.border, ...cardShadow },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  ringValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  ringLabel: { fontSize: 10, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.4 },
  budgetBreakdown: { flex: 1, gap: 6 },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 2 },
  budgetLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  budgetLabel: { flex: 1, fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
  budgetValue: { fontSize: 12.5, color: colors.text, fontWeight: '700' },
  dayDoneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.emeraldBg, borderRadius: radius.md, paddingVertical: 9, marginTop: 12, borderWidth: 1, borderColor: colors.emerald },
  dayDoneText: { color: colors.emerald, fontSize: 12.5, fontWeight: '800' },
  macroRow: { flexDirection: 'row', gap: 14, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 14 },
  macroHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  macroLabel: { fontSize: 11, fontWeight: '700', color: colors.text },
  macroValue: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  vitalsRow: { flexDirection: 'row', gap: 8 },
  vitalBtn: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.border },
  vitalHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vitalLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  vitalValue: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 4 },
  vitalSub: { fontSize: 10, color: colors.textFaint, marginTop: 1 },
});
