import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Meal, MealType, UserProfile, WeightEntry, ActivityEntry, FastingEntry, FoodEntry } from '../types';
import { useTheme } from '../contexts/ThemeContext';
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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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

const makeStyles = (colors: any) => StyleSheet.create({
  scroll: { padding: 14, paddingBottom: 100, gap: 14 },
  mealsWrap: { marginTop: 14 },
});
