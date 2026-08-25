import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Meal, MealType, UserProfile, WeightEntry, ActivityEntry, FastingEntry, FoodEntry } from '../types';
import { colors, radius } from '../theme';
import MacroSummary from '../components/today/MacroSummary';
import MealCard from '../components/today/MealCard';
import QuickActions from '../components/today/QuickActions';
import FadeInView from '../components/common/FadeInView';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'drink', 'custom'];

interface Props {
  profile: UserProfile;
  todayMeals: Meal[];
  caloriesConsumed: number;
  proteinConsumed: number;
  carbConsumed: number;
  fatConsumed: number;
  todaySteps: number;
  todayActivities: ActivityEntry[];
  activeCaloriesBurned: number;
  latestTodayWeight?: WeightEntry;
  latestTodayFast?: FastingEntry;
  onOpenAddFood: (mealType: MealType) => void;
  onOpenWeightModal: () => void;
  onOpenActivityModal: () => void;
  onOpenFastingModal: () => void;
  onOpenDayDone: () => void;
  onOpenHypothetical: () => void;
  onDeleteMeal: (mealId: string) => void;
  onDeleteFood: (mealId: string, foodId: string) => void;
  onEditFood: (mealId: string, food: FoodEntry) => void;
}

export default function TodayScreen(props: Props) {
  const { profile, todayMeals } = props;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <FadeInView>
        <MacroSummary
          calorieTarget={profile.calorie_target || 2000}
          caloriesConsumed={props.caloriesConsumed}
          proteinTarget={profile.protein_target_g || 150}
          proteinConsumed={props.proteinConsumed}
          carbTarget={profile.carb_target_g || 200}
          carbConsumed={props.carbConsumed}
          fatTarget={profile.fat_target_g || 65}
          fatConsumed={props.fatConsumed}
          steps={props.todaySteps}
          activeCaloriesBurned={props.activeCaloriesBurned}
          todayWeight={props.latestTodayWeight}
          todayFast={props.latestTodayFast}
          weightUnit={profile.units.weight}
          onOpenWeightModal={props.onOpenWeightModal}
          onOpenActivityModal={props.onOpenActivityModal}
          onOpenFastingModal={props.onOpenFastingModal}
          onOpenDayDone={props.onOpenDayDone}
        />

        <View style={styles.mealsWrap}>
          {MEAL_TYPES.map((type) => (
            <MealCard
              key={type}
              mealType={type}
              meals={todayMeals.filter((m) => m.meal_type === type)}
              onAddFood={props.onOpenAddFood}
              onDeleteMeal={props.onDeleteMeal}
              onDeleteFood={props.onDeleteFood}
              onEditFood={props.onEditFood}
            />
          ))}
        </View>

        <View style={styles.dayDoneCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dayDoneTitle}>Finished logging for today?</Text>
            <Text style={styles.dayDoneSub}>Lock in today's macros and advance to tomorrow.</Text>
          </View>
          <Pressable style={styles.dayDoneBtn} onPress={props.onOpenDayDone}>
            <Text style={styles.dayDoneBtnText}>✨ Day Done</Text>
          </Pressable>
        </View>
        </FadeInView>
      </ScrollView>

      <QuickActions
        onAddFood={() => props.onOpenAddFood('breakfast')}
        onLogWeight={props.onOpenWeightModal}
        onLogActivity={props.onOpenActivityModal}
        onLogFast={props.onOpenFastingModal}
        onOpenHypothetical={props.onOpenHypothetical}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 14, paddingBottom: 100, gap: 14 },
  mealsWrap: { marginTop: 14 },
  dayDoneCard: {
    marginTop: 4,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayDoneTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  dayDoneSub: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  dayDoneBtn: { backgroundColor: colors.emerald, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md },
  dayDoneBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
