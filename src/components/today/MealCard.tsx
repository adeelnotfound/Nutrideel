import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, getMealTypeMeta } from '../../theme';
import { useTheme } from '../../contexts/ThemeContext';
import { Meal, MealType, FoodEntry } from '../../types';

interface Props {
  mealType: MealType;
  meals: Meal[];
  onAddFood: (mealType: MealType) => void;
  onDeleteMeal: (mealId: string) => void;
  onDeleteFood: (mealId: string, foodId: string) => void;
  onEditFood: (mealId: string, food: FoodEntry) => void;
}

export default function MealCard({ mealType, meals, onAddFood, onDeleteFood, onEditFood }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const mealTypeMeta = getMealTypeMeta(colors);
  const meta = mealTypeMeta[mealType] || mealTypeMeta.custom;
  const allFoods = meals.flatMap((m) => m.foods.map((f) => ({ food: f, mealId: m.id })));
  const totalCals = allFoods.reduce((acc, x) => acc + (x.food.calories || 0), 0);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={17} color={meta.color} />
          </View>
          <View>
            <Text style={styles.title}>{meta.label}</Text>
            <Text style={styles.subtitle}>
              {allFoods.length > 0 ? `${allFoods.length} item${allFoods.length > 1 ? 's' : ''} · ${Math.round(totalCals)} kcal` : 'Nothing logged yet'}
            </Text>
          </View>
        </View>
        <Pressable style={styles.addBtn} onPress={() => onAddFood(mealType)}>
          <Ionicons name="add" size={18} color={colors.emerald} />
        </Pressable>
      </View>

      {allFoods.length > 0 && (
        <View style={styles.list}>
          {allFoods.map(({ food, mealId }) => (
            <Pressable key={food.id} style={styles.foodRow} onPress={() => onEditFood(mealId, food)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.foodName} numberOfLines={1}>{food.food_name}</Text>
                <Text style={styles.foodMeta}>
                  {food.quantity} {food.unit} · P{Math.round(food.protein)} C{Math.round(food.carbs)} F{Math.round(food.fat)}
                </Text>
              </View>
              <Text style={styles.foodCals}>{Math.round(food.calories)}</Text>
              <Pressable hitSlop={8} onPress={() => onDeleteFood(mealId, food.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={15} color={colors.rose} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 14, fontWeight: '800', textTransform: 'capitalize' },
  subtitle: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
  addBtn: { width: 30, height: 30, borderRadius: 999, backgroundColor: colors.emeraldBg, alignItems: 'center', justifyContent: 'center' },
  list: { marginTop: 12, gap: 2, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  foodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 8 },
  foodName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  foodMeta: { color: colors.textFaint, fontSize: 10.5, marginTop: 1 },
  foodCals: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  deleteBtn: { padding: 4 },
});
