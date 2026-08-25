import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { colors, radius, cardShadow } from '../../theme';
import { Meal, WeightEntry, ActivityEntry, FastingEntry, UserProfile, TimeRangeFilter } from '../../types';
import { calculateThermodynamicForecast, calculateDaysToGoal, calculateRecommendedTargets } from '../../utils/calculations';
import { getSystemLocalDateString } from '../../utils/date';
import LineChart from '../common/LineChart';
import FadeInView from '../common/FadeInView';

interface Props {
  meals: Meal[];
  weights: WeightEntry[];
  activities: ActivityEntry[];
  fasts: FastingEntry[];
  profile: UserProfile;
}

const RANGES: { id: TimeRangeFilter; days: number; label: string }[] = [
  { id: '1W', days: 7, label: '1W' },
  { id: '2W', days: 14, label: '2W' },
  { id: '1M', days: 30, label: '1M' },
  { id: '3M', days: 90, label: '3M' },
];

export default function ProgressView({ meals, weights, activities, profile }: Props) {
  const [range, setRange] = useState<TimeRangeFilter>('1M');

  const rangeDays = RANGES.find((r) => r.id === range)?.days || 30;
  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - rangeDays);
    return getSystemLocalDateString(d);
  }, [rangeDays]);

  const sortedWeights = [...weights].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const weightsInRange = sortedWeights.filter((w) => w.date >= cutoff);

  let observedTrend: number | null = null;
  if (sortedWeights.length >= 4) {
    const oldest = sortedWeights[0];
    const newest = sortedWeights[sortedWeights.length - 1];
    const diffDays = Math.max(7, (new Date(newest.timestamp).getTime() - new Date(oldest.timestamp).getTime()) / 86400000);
    observedTrend = Number((((newest.weight_kg - oldest.weight_kg) / diffDays) * 7).toFixed(2));
  }

  const targets = calculateRecommendedTargets(
    profile.current_weight_kg,
    profile.height_cm,
    profile.age,
    profile.gender,
    profile.activity_baseline,
    profile.current_goal,
    profile.target_rate_kg_week
  );

  const calsByDate: Record<string, number> = {};
  meals.forEach((m) => {
    if (m.date < cutoff) return;
    calsByDate[m.date] = (calsByDate[m.date] || 0) + m.foods.reduce((a, f) => a + (f.calories || 0), 0);
  });
  const calDates = Object.keys(calsByDate).sort();
  const calChartData = calDates.map((d) => ({ label: d.slice(5), value: calsByDate[d] }));

  const avgCalsInRange = calDates.length > 0 ? Math.round(calDates.reduce((a, d) => a + calsByDate[d], 0) / calDates.length) : profile.calorie_target;

  const forecast = calculateThermodynamicForecast(profile.current_weight_kg, targets.tdee, avgCalsInRange, observedTrend, 30, sortedWeights.length >= 3);
  const daysToGoal = calculateDaysToGoal(profile.current_weight_kg, profile.goal_weight_kg, observedTrend || profile.target_rate_kg_week);

  const weightChartData = weightsInRange.map((w) => ({ label: w.date.slice(5), value: w.weight_kg }));

  const stepsByDate: Record<string, number> = {};
  activities.forEach((a) => {
    if (a.date < cutoff) return;
    stepsByDate[a.date] = (stepsByDate[a.date] || 0) + (a.steps || 0);
  });
  const stepDates = Object.keys(stepsByDate).sort();
  const stepChartData = stepDates.map((d) => ({ label: d.slice(5), value: stepsByDate[d] }));

  return (
    <ScrollView contentContainerStyle={styles.scrollOuter}>
      <FadeInView style={styles.scroll}>
      <View style={styles.rangeRow}>
        {RANGES.map((r) => (
          <Pressable key={r.id} style={[styles.rangeChip, range === r.id && styles.rangeChipActive]} onPress={() => setRange(r.id)}>
            <Text style={[styles.rangeChipText, range === r.id && styles.rangeChipTextActive]}>{r.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.statGrid}>
        <SmallStat label="TDEE" value={`${targets.tdee}`} sub="kcal/day" />
        <SmallStat
          label="Weight Trend"
          value={observedTrend !== null ? `${observedTrend > 0 ? '+' : ''}${observedTrend}` : '—'}
          sub="kg/week"
        />
        <SmallStat label="Days to Goal" value={daysToGoal.estimatedDays !== null ? `${daysToGoal.estimatedDays}` : '—'} sub="days" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weight Trend</Text>
        <LineChart data={weightChartData} color={colors.violet} unit="kg" targetLine={profile.goal_weight_kg} />
        <Text style={styles.cardFootnote}>
          {weightsInRange.length} entries · dashed line is your {profile.goal_weight_kg}kg goal
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Calorie Intake</Text>
        <LineChart data={calChartData} color={colors.emerald} unit="kcal" targetLine={profile.calorie_target} />
        <Text style={styles.cardFootnote}>
          Avg {avgCalsInRange} kcal/day · dashed line is your {profile.calorie_target} kcal target
        </Text>
      </View>

      {stepChartData.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Steps</Text>
          <LineChart data={stepChartData} color={colors.sky} unit="steps" />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>30-Day Forecast</Text>
        <Text style={styles.bigValue}>{forecast.projectedWeightKg} kg</Text>
        <Text style={styles.cardSub}>
          Projected change: {forecast.projectedChangeKg > 0 ? '+' : ''}
          {forecast.projectedChangeKg} kg (range {forecast.rangeMinKg}–{forecast.rangeMaxKg} kg)
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Goal Status</Text>
        <Text style={styles.cardSub}>{daysToGoal.statusText}</Text>
      </View>
      </FadeInView>
    </ScrollView>
  );
}

function SmallStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.smallStat}>
      <Text style={styles.smallStatValue}>{value}</Text>
      <Text style={styles.smallStatLabel}>{label}</Text>
      <Text style={styles.smallStatSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 14, paddingBottom: 100, gap: 12 },
  scrollOuter: { flexGrow: 1 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  rangeChip: { flex: 1, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.cardAlt, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  rangeChipActive: { backgroundColor: colors.emeraldBg, borderColor: colors.emerald },
  rangeChipText: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  rangeChipTextActive: { color: colors.emerald },
  statGrid: { flexDirection: 'row', gap: 8 },
  smallStat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, alignItems: 'center' },
  smallStatValue: { color: colors.text, fontSize: 17, fontWeight: '800' },
  smallStatLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  smallStatSub: { color: colors.textFaint, fontSize: 9, marginTop: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, ...cardShadow },
  cardTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10 },
  cardFootnote: { color: colors.textFaint, fontSize: 10.5, marginTop: 8 },
  bigValue: { color: colors.text, fontSize: 24, fontWeight: '800' },
  cardSub: { color: colors.textFaint, fontSize: 11.5, marginTop: 4, lineHeight: 16 },
});
