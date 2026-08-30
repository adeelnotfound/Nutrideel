import { Meal, UserProfile, WeightEntry, ActivityEntry } from '../types';
import { storage } from './storage';
import {
  generateRollingAverages,
  calculateAdaptiveMetabolicModel,
  calculateBMR,
  calculateTDEE,
  AdaptiveMetabolicModel,
} from '../utils/calculations';

const CHECK_INTERVAL_DAYS = 7;
// Cap how much a single weekly correction can move the calorie target by, so a
// couple of noisy days (or a big meal) can never swing the plan too far at once.
const MAX_WEEKLY_CORRECTION_KCAL = 150;
const MIN_CALORIE_FLOOR = 1200;

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  return Math.abs(Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
}

export function computeAdaptiveModel(
  profile: UserProfile,
  meals: Meal[],
  weights: WeightEntry[],
  activities: ActivityEntry[]
): AdaptiveMetabolicModel {
  const dailySeries = generateRollingAverages(
    meals.map((m) => ({ date: m.date, foods: m.foods })),
    weights.map((w) => ({ date: w.date, weight_kg: w.weight_kg })),
    activities.map((a) => ({ date: a.date, steps: a.steps }))
  );

  const bmr = calculateBMR(profile.current_weight_kg, profile.height_cm, profile.age, profile.gender);
  const theoreticalTdee = calculateTDEE(bmr, profile.activity_level || profile.activity_baseline);

  return calculateAdaptiveMetabolicModel(dailySeries, profile.current_weight_kg, theoreticalTdee);
}

interface ApplyResult {
  updated: boolean;
  newProfile?: UserProfile;
  model: AdaptiveMetabolicModel;
  deltaKcal: number;
}

/**
 * Runs at most once every CHECK_INTERVAL_DAYS. If Adaptive Goals is enabled and enough
 * history exists (calibrationStatus !== 'baseline'), nudges the calorie target toward
 * the empirically observed TDEE, capped to a small weekly correction, and rebalances
 * carbs so protein/fat grams (the "pinned" macros) stay put — mirroring fud-ai's
 * "pinned macros stay pinned, unlocked macros auto-balance" behavior.
 */
export function maybeApplyAdaptiveGoals(
  profile: UserProfile,
  meals: Meal[],
  weights: WeightEntry[],
  activities: ActivityEntry[]
): ApplyResult {
  const model = computeAdaptiveModel(profile, meals, weights, activities);
  const today = new Date().toISOString().slice(0, 10);

  if (!storage.getAdaptiveGoalsEnabled()) {
    return { updated: false, model, deltaKcal: 0 };
  }

  const lastCheck = storage.getAdaptiveGoalsLastCheck();
  if (lastCheck && daysBetween(lastCheck, today) < CHECK_INTERVAL_DAYS) {
    return { updated: false, model, deltaKcal: 0 };
  }

  storage.saveAdaptiveGoalsLastCheck(today);

  if (model.calibrationStatus === 'baseline') {
    // Not enough history yet to trust an empirical correction.
    return { updated: false, model, deltaKcal: 0 };
  }

  const rawDelta = model.adaptiveTdee - model.theoreticalTdee;
  const cappedDelta = Math.max(-MAX_WEEKLY_CORRECTION_KCAL, Math.min(MAX_WEEKLY_CORRECTION_KCAL, rawDelta));

  if (Math.abs(cappedDelta) < 20) {
    // Not worth a change / notification.
    return { updated: false, model, deltaKcal: 0 };
  }

  const newCalorieTarget = Math.max(MIN_CALORIE_FLOOR, Math.round(profile.calorie_target + cappedDelta));
  const proteinG = profile.protein_target_g; // pinned
  const fatG = profile.fat_target_g; // pinned
  const carbCalories = Math.max(0, newCalorieTarget - (proteinG * 4 + fatG * 9));
  const carbG = Math.round(carbCalories / 4);

  const newProfile: UserProfile = {
    ...profile,
    calorie_target: newCalorieTarget,
    target_calories_override: newCalorieTarget,
    carb_target_g: carbG,
  };

  storage.saveAdaptiveGoalsLastModel(model);

  return { updated: true, newProfile, model, deltaKcal: cappedDelta };
}
