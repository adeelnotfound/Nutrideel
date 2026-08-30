import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { FoodEntry, Meal, MealType, UserProfile, WeightEntry, ActivityEntry, FastingEntry } from './types';
import { storage } from './services/storage';
import { createAIContextSnapshot } from './services/aiService';
import { maybeApplyAdaptiveGoals } from './services/adaptiveGoals';
import { getSystemLocalDateString, getSystemLocalTimeString } from './utils/date';

import Header from './components/common/Header';
import BottomTabBar, { TabId } from './components/common/BottomTabBar';
import TodayScreen from './screens/TodayScreen';
import HistoryView from './components/history/HistoryView';
import ProgressView from './components/progress/ProgressView';
import AIChatView from './components/ai/AIChatView';
import ProfileView from './components/profile/ProfileView';
import OnboardingWizard from './components/onboarding/OnboardingWizard';

import AddFoodModal from './components/modals/AddFoodModal';
import EditFoodModal from './components/modals/EditFoodModal';
import LogWeightModal from './components/modals/LogWeightModal';
import LogActivityModal from './components/modals/LogActivityModal';
import LogFastingModal from './components/modals/LogFastingModal';
import HypotheticalMealModal from './components/modals/HypotheticalMealModal';
import DayDoneModal from './components/modals/DayDoneModal';
import { useTheme } from './contexts/ThemeContext';
import { useToast } from './components/common/ToastProvider';
import { haptics } from './utils/haptics';

export default function RootNavigator() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const toast = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(() => storage.getUserProfile());
  const [currentDate, setCurrentDate] = useState<string>(() => getSystemLocalDateString());
  const [activeTab, setActiveTab] = useState<TabId>('today');

  const [isAddFoodOpen, setIsAddFoodOpen] = useState(false);
  const [selectedMealTypeForAdd, setSelectedMealTypeForAdd] = useState<MealType>('breakfast');
  const [editingFoodInfo, setEditingFoodInfo] = useState<{ mealId: string; food: FoodEntry } | null>(null);
  const [isLogWeightOpen, setIsLogWeightOpen] = useState(false);
  const [isLogActivityOpen, setIsLogActivityOpen] = useState(false);
  const [isLogFastingOpen, setIsLogFastingOpen] = useState(false);
  const [isHypotheticalOpen, setIsHypotheticalOpen] = useState(false);
  const [isDayDoneOpen, setIsDayDoneOpen] = useState(false);

  const [meals, setMeals] = useState<Meal[]>(() => storage.getMeals());
  const [weights, setWeights] = useState<WeightEntry[]>(() => storage.getWeights());
  const [activities, setActivities] = useState<ActivityEntry[]>(() => storage.getActivities());
  const [fasts, setFasts] = useState<FastingEntry[]>(() => storage.getFasts());

  useEffect(() => {
    const unsubscribe = storage.subscribeToStorage(() => {
      setMeals(storage.getMeals());
      setWeights(storage.getWeights());
      setActivities(storage.getActivities());
      setFasts(storage.getFasts());
      setProfile(storage.getUserProfile());
    });
    return unsubscribe;
  }, []);

  const adaptiveCheckedRef = React.useRef(false);
  useEffect(() => {
    if (!profile || adaptiveCheckedRef.current) return;
    adaptiveCheckedRef.current = true;
    const result = maybeApplyAdaptiveGoals(profile, meals, weights, activities);
    if (result.updated && result.newProfile) {
      storage.saveProfile(result.newProfile);
      setProfile(result.newProfile);
      const direction = result.deltaKcal > 0 ? 'up' : 'down';
      toast.show(
        `Adaptive Goals: calorie target adjusted ${direction} to ${result.newProfile.calorie_target} kcal based on your recent trend`,
        'info'
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (!profile) {
    return <OnboardingWizard onComplete={(newProfile) => setProfile(newProfile)} />;
  }

  const loggedDates = Array.from(
    new Set([...meals.map((m) => m.date), ...weights.map((w) => w.date), ...activities.map((a) => a.date)])
  );

  let currentStreak = 0;
  if (loggedDates.length > 0) {
    const today = getSystemLocalDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = getSystemLocalDateString(yesterdayDate);
    const datesSet = new Set(loggedDates);

    let checkDateStr = datesSet.has(today) ? today : datesSet.has(yesterday) ? yesterday : null;
    if (checkDateStr) {
      const parts = checkDateStr.split('-').map(Number);
      let d = new Date(parts[0], parts[1] - 1, parts[2]);
      while (true) {
        const str = getSystemLocalDateString(d);
        if (datesSet.has(str)) {
          currentStreak++;
          d.setDate(d.getDate() - 1);
        } else break;
      }
    }
  }

  const todayMeals = meals.filter((m) => m.date === currentDate);
  const todayWeights = weights.filter((w) => w.date === currentDate);
  const todayActivities = activities.filter((a) => a.date === currentDate);
  const todayFasts = fasts.filter((f) => f.date === currentDate);

  const caloriesConsumed = todayMeals.reduce((acc, m) => acc + m.foods.reduce((fAcc, f) => fAcc + (f.calories || 0), 0), 0);
  const proteinConsumed = todayMeals.reduce((acc, m) => acc + m.foods.reduce((fAcc, f) => fAcc + (f.protein || 0), 0), 0);
  const carbConsumed = todayMeals.reduce((acc, m) => acc + m.foods.reduce((fAcc, f) => fAcc + (f.carbs || 0), 0), 0);
  const fatConsumed = todayMeals.reduce((acc, m) => acc + m.foods.reduce((fAcc, f) => fAcc + (f.fat || 0), 0), 0);

  const todaySteps = todayActivities.reduce((acc, a) => acc + (a.steps || 0), 0);
  const activeCaloriesBurned = todayActivities.reduce((acc, a) => acc + (a.calories_burned || 0), 0);
  const latestTodayWeight = todayWeights.length > 0 ? todayWeights[todayWeights.length - 1] : undefined;
  const latestTodayFast = todayFasts.length > 0 ? todayFasts[todayFasts.length - 1] : undefined;

  const handleResetAllData = async () => {
    await storage.clearAllData();
    setMeals([]);
    setWeights([]);
    setActivities([]);
    setFasts([]);
    setProfile(null);
    setActiveTab('today');
    setCurrentDate(getSystemLocalDateString());
    haptics.warning();
  };

  const handleOpenAddFood = (mealType: MealType) => {
    setSelectedMealTypeForAdd(mealType);
    setIsAddFoodOpen(true);
  };

  const handleFoodAdded = (entry: FoodEntry) => {
    let targetMeal = todayMeals.find((m) => m.meal_type === selectedMealTypeForAdd);
    if (!targetMeal) {
      storage.addMeal({
        date: currentDate,
        meal_type: selectedMealTypeForAdd,
        timestamp: `${currentDate}T${getSystemLocalTimeString()}:00.000Z`,
        foods: [entry],
      } as any);
    } else {
      targetMeal.foods.push(entry);
      storage.updateMeal(targetMeal);
    }
    haptics.success();
    toast.show(`${entry.food_name} logged`, 'success');
  };

  const handleBundleMealAdded = (items: Omit<FoodEntry, 'id'>[]) => {
    let targetMeal = todayMeals.find((m) => m.meal_type === selectedMealTypeForAdd);
    const newFoodEntries: FoodEntry[] = items.map((it, idx) => ({ ...it, id: `f_${Date.now()}_${idx}` } as FoodEntry));

    if (!targetMeal) {
      storage.addMeal({
        date: currentDate,
        meal_type: selectedMealTypeForAdd,
        timestamp: `${currentDate}T${getSystemLocalTimeString()}:00.000Z`,
        foods: newFoodEntries,
      } as any);
    } else {
      targetMeal.foods.push(...newFoodEntries);
      storage.updateMeal(targetMeal);
    }
    haptics.success();
    toast.show(`${items.length} item${items.length !== 1 ? 's' : ''} logged`, 'success');
  };

  const handleDeleteFood = (mealId: string, foodId: string) => {
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) return;
    meal.foods = meal.foods.filter((f) => f.id !== foodId);
    if (meal.foods.length === 0) storage.deleteMeal(mealId);
    else storage.updateMeal(meal);
    haptics.light();
  };

  const handleSaveEditedFood = (mealId: string, updatedFood: FoodEntry) => {
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) return;
    meal.foods = meal.foods.map((f) => (f.id === updatedFood.id ? updatedFood : f));
    storage.updateMeal(meal);
    setMeals(storage.getMeals());
    haptics.success();
    toast.show('Food updated', 'success');
  };

  const handleAdvanceToNextDay = () => {
    const parts = currentDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 1);
    setCurrentDate(getSystemLocalDateString(d));
    haptics.selection();
  };

  const contextSnapshot = createAIContextSnapshot(profile, todayMeals, meals, weights, activities, fasts);

  return (
    <View style={styles.root}>
      <Header currentDate={currentDate} onDateChange={setCurrentDate} streakCount={currentStreak} />

      <View style={styles.content}>
        {activeTab === 'today' && (
          <TodayScreen
            profile={profile}
            todayMeals={todayMeals}
            caloriesConsumed={caloriesConsumed}
            proteinConsumed={proteinConsumed}
            carbConsumed={carbConsumed}
            fatConsumed={fatConsumed}
            todaySteps={todaySteps}
            todayActivities={todayActivities}
            activeCaloriesBurned={activeCaloriesBurned}
            latestTodayWeight={latestTodayWeight}
            latestTodayFast={latestTodayFast}
            onOpenAddFood={handleOpenAddFood}
            onOpenWeightModal={() => setIsLogWeightOpen(true)}
            onOpenActivityModal={() => setIsLogActivityOpen(true)}
            onOpenFastingModal={() => setIsLogFastingOpen(true)}
            onOpenDayDone={() => setIsDayDoneOpen(true)}
            onOpenHypothetical={() => setIsHypotheticalOpen(true)}
            onDeleteMeal={(id) => storage.deleteMeal(id)}
            onDeleteFood={handleDeleteFood}
            onEditFood={(mealId, food) => setEditingFoodInfo({ mealId, food })}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            meals={meals}
            weights={weights}
            activities={activities}
            fasts={fasts}
            profile={profile}
            onSelectDate={(date) => {
              setCurrentDate(date);
              setActiveTab('today');
            }}
            onDeleteMeal={(id) => storage.deleteMeal(id)}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressView meals={meals} weights={weights} activities={activities} fasts={fasts} profile={profile} />
        )}

        {activeTab === 'ai' && <AIChatView contextSnapshot={contextSnapshot} profile={profile} />}

        {activeTab === 'profile' && (
          <ProfileView
            profile={profile}
            onUpdateProfile={setProfile}
            onResetData={handleResetAllData}
          />
        )}
      </View>

      <BottomTabBar activeTab={activeTab} onChangeTab={setActiveTab} />

      <AddFoodModal
        isOpen={isAddFoodOpen}
        onClose={() => setIsAddFoodOpen(false)}
        mealType={selectedMealTypeForAdd}
        currentDate={currentDate}
        onFoodAdded={handleFoodAdded}
        onMealAdded={handleBundleMealAdded}
      />

      <LogWeightModal
        isOpen={isLogWeightOpen}
        onClose={() => setIsLogWeightOpen(false)}
        currentDate={currentDate}
        userWeightUnit={profile.units.weight}
        lastWeightKg={latestTodayWeight?.weight_kg || profile.current_weight_kg}
        existingWeight={latestTodayWeight}
        onSaveWeight={(entry, existingId) => {
          storage.saveOrUpdateWeightForDate(entry, existingId);
          setWeights(storage.getWeights());
          haptics.success();
          toast.show('Weight logged', 'success');
        }}
        onDeleteWeight={(id) => {
          storage.deleteWeight(id);
          setWeights(storage.getWeights());
          haptics.light();
        }}
      />

      <LogActivityModal
        isOpen={isLogActivityOpen}
        onClose={() => setIsLogActivityOpen(false)}
        currentDate={currentDate}
        existingActivities={todayActivities}
        onSaveActivity={(act, existingId) => {
          storage.saveOrUpdateActivityForDate(act, existingId);
          setActivities(storage.getActivities());
          haptics.success();
          toast.show('Activity logged', 'success');
        }}
        onDeleteActivity={(id) => {
          storage.deleteActivity(id);
          setActivities(storage.getActivities());
          haptics.light();
        }}
      />

      <LogFastingModal
        isOpen={isLogFastingOpen}
        onClose={() => setIsLogFastingOpen(false)}
        currentDate={currentDate}
        existingFast={latestTodayFast}
        onSaveFasting={(fast, existingId) => {
          storage.saveOrUpdateFastingForDate(fast, existingId);
          setFasts(storage.getFasts());
          haptics.success();
          toast.show('Fasting logged', 'success');
        }}
        onDeleteFasting={(id) => {
          storage.deleteFasting(id);
          setFasts(storage.getFasts());
          haptics.light();
        }}
      />

      <HypotheticalMealModal
        isOpen={isHypotheticalOpen}
        onClose={() => setIsHypotheticalOpen(false)}
        contextSnapshot={contextSnapshot}
        onCommitMeal={(mealType, items) => {
          setSelectedMealTypeForAdd(mealType);
          handleBundleMealAdded(items);
        }}
      />


      <EditFoodModal
        isOpen={!!editingFoodInfo}
        onClose={() => setEditingFoodInfo(null)}
        mealId={editingFoodInfo?.mealId || ''}
        food={editingFoodInfo?.food || null}
        onSave={handleSaveEditedFood}
        onDelete={handleDeleteFood}
      />

      <DayDoneModal
        isOpen={isDayDoneOpen}
        onClose={() => setIsDayDoneOpen(false)}
        currentDate={currentDate}
        caloriesConsumed={caloriesConsumed}
        calorieTarget={profile.calorie_target || 2000}
        proteinConsumed={proteinConsumed}
        proteinTarget={profile.protein_target_g || 150}
        carbsConsumed={carbConsumed}
        carbsTarget={profile.carb_target_g || 200}
        fatConsumed={fatConsumed}
        fatTarget={profile.fat_target_g || 65}
        steps={todaySteps}
        activeCaloriesBurned={activeCaloriesBurned}
        onAdvanceToNextDay={handleAdvanceToNextDay}
      />
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
});
