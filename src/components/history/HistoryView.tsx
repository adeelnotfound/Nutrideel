import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';
import { Meal, WeightEntry, ActivityEntry, FastingEntry, UserProfile } from '../../types';
import { formatSystemDisplayDate } from '../../utils/date';
import FadeInView from '../common/FadeInView';

interface Props {
  meals: Meal[];
  weights: WeightEntry[];
  activities: ActivityEntry[];
  fasts: FastingEntry[];
  profile: UserProfile;
  onSelectDate: (date: string) => void;
  onDeleteMeal: (mealId: string) => void;
}

interface DaySummary {
  date: string;
  totalCals: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
  weightKg?: number;
  steps: number;
}

export default function HistoryView({ meals, weights, activities, profile, onSelectDate }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const summaries = useMemo<DaySummary[]>(() => {
    const byDate: Record<string, DaySummary> = {};

    meals.forEach((m) => {
      if (!byDate[m.date]) byDate[m.date] = { date: m.date, totalCals: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0, steps: 0 };
      byDate[m.date].mealCount += 1;
      m.foods.forEach((f) => {
        byDate[m.date].totalCals += f.calories || 0;
        byDate[m.date].protein += f.protein || 0;
        byDate[m.date].carbs += f.carbs || 0;
        byDate[m.date].fat += f.fat || 0;
      });
    });

    weights.forEach((w) => {
      if (!byDate[w.date]) byDate[w.date] = { date: w.date, totalCals: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0, steps: 0 };
      byDate[w.date].weightKg = w.weight_kg;
    });

    activities.forEach((a) => {
      if (!byDate[a.date]) byDate[a.date] = { date: a.date, totalCals: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0, steps: 0 };
      byDate[a.date].steps += a.steps || 0;
    });

    return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
  }, [meals, weights, activities]);

  if (summaries.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="calendar-clear-outline" size={32} color={colors.textFaint} />
        <Text style={styles.emptyText}>No history yet. Start logging on the Today tab.</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={summaries}
      keyExtractor={(item) => item.date}
      renderItem={({ item, index }) => {
        const isExpanded = expandedDate === item.date;
        const isOver = item.totalCals > profile.calorie_target;
        return (
          <FadeInView delay={Math.min(index, 8) * 30}>
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={() => setExpandedDate(isExpanded ? null : item.date)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateText}>{formatSystemDisplayDate(item.date)}</Text>
                <Text style={styles.metaText}>
                  {item.mealCount > 0 ? `${item.mealCount} meal${item.mealCount !== 1 ? 's' : ''}` : 'No meals'}
                  {item.weightKg ? ` · ${item.weightKg}kg` : ''}
                  {item.steps > 0 ? ` · ${item.steps.toLocaleString()} steps` : ''}
                </Text>
              </View>
              {item.totalCals > 0 && (
                <Text style={[styles.calsText, isOver && styles.calsOver]}>{Math.round(item.totalCals)} kcal</Text>
              )}
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textFaint} style={{ marginLeft: 8 }} />
            </Pressable>

            {isExpanded && (
              <View style={styles.expandedWrap}>
                <View style={styles.macroRow}>
                  <MiniStat label="Protein" value={`${Math.round(item.protein)}g`} />
                  <MiniStat label="Carbs" value={`${Math.round(item.carbs)}g`} />
                  <MiniStat label="Fat" value={`${Math.round(item.fat)}g`} />
                </View>
                <Pressable style={styles.jumpBtn} onPress={() => onSelectDate(item.date)}>
                  <Text style={styles.jumpBtnText}>View Full Day</Text>
                </Pressable>
              </View>
            )}
          </View>
          </FadeInView>
        );
      }}
    />
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  list: { padding: 14, paddingBottom: 100 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  dateText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  metaText: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  calsText: { color: colors.emerald, fontWeight: '800', fontSize: 13 },
  calsOver: { color: colors.amber },
  expandedWrap: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  macroRow: { flexDirection: 'row', gap: 8 },
  miniStat: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius.sm, paddingVertical: 8, alignItems: 'center' },
  miniStatValue: { color: colors.text, fontWeight: '800', fontSize: 12.5 },
  miniStatLabel: { color: colors.textFaint, fontSize: 9.5, marginTop: 1 },
  jumpBtn: { marginTop: 10, backgroundColor: colors.emeraldBg, borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center' },
  jumpBtnText: { color: colors.emerald, fontWeight: '700', fontSize: 11.5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 10 },
  emptyText: { color: colors.textFaint, fontSize: 13, textAlign: 'center' },
});
