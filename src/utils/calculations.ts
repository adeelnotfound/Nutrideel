import {
  ActivityBaseline,
  Gender,
  GoalType,
  HeightUnit,
  UserUnits,
  WeightUnit,
  FoodUnit,
  LiquidUnit,
  EnergyUnit,
} from '../types';

export interface BMIData {
  bmi: number;
  category: 'Underweight' | 'Normal weight' | 'Overweight' | 'Obesity';
  color: string;
  disclaimer: string;
}

export function calculateBMI(weightKg: number, heightCm: number): BMIData {
  if (weightKg <= 0 || heightCm <= 0) {
    return {
      bmi: 0,
      category: 'Normal weight',
      color: 'text-slate-500',
      disclaimer: 'BMI is a preliminary screening metric and does not distinguish between muscle mass and fat tissue.',
    };
  }

  const heightM = heightCm / 100;
  const bmi = Number((weightKg / (heightM * heightM)).toFixed(1));

  let category: BMIData['category'] = 'Normal weight';
  let color = 'text-emerald-600 dark:text-emerald-400';

  if (bmi < 18.5) {
    category = 'Underweight';
    color = 'text-sky-600 dark:text-sky-400';
  } else if (bmi >= 18.5 && bmi < 25) {
    category = 'Normal weight';
    color = 'text-emerald-600 dark:text-emerald-400';
  } else if (bmi >= 25 && bmi < 30) {
    category = 'Overweight';
    color = 'text-amber-600 dark:text-amber-400';
  } else {
    category = 'Obesity';
    color = 'text-rose-600 dark:text-rose-400';
  }

  return {
    bmi,
    category,
    color,
    disclaimer: 'BMI is an epidemiological metric. It does not measure body fat distribution, bone density, or athletic muscularity.',
  };
}

// ----------------- Unit Conversions ----------------- //

export function convertWeightFromKg(kg: number, targetUnit: WeightUnit): { value: number; label: string; formatted: string } {
  if (targetUnit === 'lb') {
    const lb = Number((kg * 2.20462).toFixed(1));
    return { value: lb, label: 'lb', formatted: `${lb} lb` };
  }
  if (targetUnit === 'st_lb') {
    const totalLb = kg * 2.20462;
    const stone = Math.floor(totalLb / 14);
    const remLb = Number((totalLb % 14).toFixed(1));
    return { value: Number(totalLb.toFixed(1)), label: 'st', formatted: `${stone} st ${remLb} lb` };
  }
  return { value: Number(kg.toFixed(1)), label: 'kg', formatted: `${Number(kg.toFixed(1))} kg` };
}

export function convertWeightToKg(value: number, fromUnit: WeightUnit, extraLb?: number): number {
  if (fromUnit === 'lb') {
    return Number((value / 2.20462).toFixed(2));
  }
  if (fromUnit === 'st_lb') {
    const totalLb = value * 14 + (extraLb || 0);
    return Number((totalLb / 2.20462).toFixed(2));
  }
  return Number(value.toFixed(2));
}

export function convertHeightFromCm(cm: number, targetUnit: HeightUnit): { value: number; label: string; formatted: string } {
  if (targetUnit === 'ft_in') {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { value: Number(totalInches.toFixed(1)), label: 'ft/in', formatted: `${feet}'${inches}"` };
  }
  return { value: Math.round(cm), label: 'cm', formatted: `${Math.round(cm)} cm` };
}

export function convertHeightToCm(feetOrCm: number, targetUnit: HeightUnit, inches = 0): number {
  if (targetUnit === 'ft_in') {
    return Math.round((feetOrCm * 12 + inches) * 2.54);
  }
  return Math.round(feetOrCm);
}

export function convertFoodQuantity(qty: number, fromUnit: FoodUnit, targetUnit: FoodUnit): number {
  // Base is grams
  let grams = qty;
  switch (fromUnit) {
    case 'oz': grams = qty * 28.3495; break;
    case 'kg': grams = qty * 1000; break;
    case 'lb': grams = qty * 453.592; break;
    case 'tbsp': grams = qty * 15; break;
    case 'tsp': grams = qty * 5; break;
    case 'cup': grams = qty * 240; break;
    default: grams = qty; break;
  }

  switch (targetUnit) {
    case 'oz': return Number((grams / 28.3495).toFixed(1));
    case 'kg': return Number((grams / 1000).toFixed(2));
    case 'lb': return Number((grams / 453.592).toFixed(2));
    case 'g': return Math.round(grams);
    default: return qty;
  }
}

export function convertEnergy(kcal: number, unit: EnergyUnit): { value: number; label: string } {
  if (unit === 'kJ') {
    return { value: Math.round(kcal * 4.184), label: 'kJ' };
  }
  return { value: Math.round(kcal), label: 'kcal' };
}

// ----------------- BMR & TDEE Calculations ----------------- //

export function calculateBMR(weightKg: number, heightCm: number, age: number, gender: Gender, bodyFatPct?: number): number {
  // If body fat is provided, use Katch-McArdle formula for greater lean mass accuracy
  if (bodyFatPct && bodyFatPct > 3 && bodyFatPct < 60) {
    const leanMassKg = weightKg * (1 - bodyFatPct / 100);
    return Math.round(370 + 21.6 * leanMassKg);
  }

  // Otherwise use Mifflin-St Jeor equation
  if (gender === 'male') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  }
  if (gender === 'female') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
  }
  // Gender neutral average
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 78);
}

export function getBaselineMultiplier(baseline: ActivityBaseline): number {
  switch (baseline) {
    case 'sedentary':
      return 1.2; // Little to no exercise, desk job
    case 'light':
      return 1.375; // Light exercise 1-3 days/week
    case 'moderate':
      return 1.55; // Moderate exercise 3-5 days/week
    case 'very':
    case 'very_active':
      return 1.725; // Heavy exercise / workouts 6-7 days/week
    case 'extra_active':
      return 1.9; // Very intense exercise / physical labor
    default:
      return 1.2;
  }
}

export function calculateTDEE(bmr: number, baseline: ActivityBaseline): number {
  const multiplier = getBaselineMultiplier(baseline);
  return Math.round(bmr * multiplier);
}

export function calculateRecommendedTargets(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender,
  activityBaseline: ActivityBaseline,
  goal: GoalType,
  targetRateKgWeek = -0.5,
  bodyFatPct?: number
): {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  explanation: string;
} {
  const bmr = calculateBMR(weightKg, heightCm, age, gender, bodyFatPct);
  const tdee = calculateTDEE(bmr, activityBaseline);

  let calorieTarget = tdee;
  let explanation = 'Maintenance target matching your estimated energy expenditure.';

  // ~7700 kcal deficit/surplus per 1kg weight change (~1100 kcal daily delta for 1kg/week)
  const dailyDelta = Math.round((targetRateKgWeek * 7700) / 7);

  if (goal === 'lose') {
    calorieTarget = Math.max(1200, tdee + dailyDelta); // Safe floor
    explanation = `Targeting a safe deficit of ${Math.abs(dailyDelta)} kcal/day for ~${Math.abs(targetRateKgWeek)} kg/week steady fat loss.`;
  } else if (goal === 'gain') {
    calorieTarget = tdee + Math.max(250, dailyDelta);
    explanation = `Targeting a controlled surplus of ${dailyDelta} kcal/day for lean muscle accumulation.`;
  } else if (goal === 'custom') {
    calorieTarget = Math.max(1200, tdee + dailyDelta);
  }

  // Protein: ~1.8g to 2.2g per kg bodyweight for active/cutting individuals
  const proteinG = Math.round(Math.min(weightKg * 2.0, (calorieTarget * 0.30) / 4));
  // Fat: ~25% of calories
  const fatG = Math.round((calorieTarget * 0.25) / 9);
  // Carbs: Remainder of calories
  const carbCalories = Math.max(0, calorieTarget - (proteinG * 4 + fatG * 9));
  const carbG = Math.round(carbCalories / 4);

  return {
    bmr,
    tdee,
    calorieTarget,
    proteinG,
    carbG,
    fatG,
    explanation,
  };
}

// ----------------- Forecasting Engine ----------------- //

export interface ForecastResult {
  days: number;
  projectedWeightKg: number;
  projectedChangeKg: number;
  rangeMinKg: number;
  rangeMaxKg: number;
  estimatedWeeklyRateKg: number;
  confidence: 'High' | 'Moderate' | 'Low';
  assumptions: string[];
}

export function calculateThermodynamicForecast(
  currentWeightKg: number,
  tdee: number,
  recentAvgCalorieIntake: number,
  recentWeightChangeRateKgWeek: number | null,
  days: number,
  hasEnoughData = true
): ForecastResult {
  // If we have empirical scale trend data, blend thermodynamic deficit with empirical rate
  const energyDeficitPerDay = tdee - recentAvgCalorieIntake;
  const theoreticalWeeklyRateKg = -(energyDeficitPerDay * 7) / 7700;

  let effectiveWeeklyRateKg = theoreticalWeeklyRateKg;
  if (recentWeightChangeRateKgWeek !== null && Math.abs(recentWeightChangeRateKgWeek) < 2.5) {
    // Weighted blend: 60% empirical trend, 40% energy balance
    effectiveWeeklyRateKg = Number((0.6 * recentWeightChangeRateKgWeek + 0.4 * theoreticalWeeklyRateKg).toFixed(2));
  }

  const weeks = days / 7;
  const projectedChangeKg = Number((effectiveWeeklyRateKg * weeks).toFixed(1));
  const projectedWeightKg = Number((currentWeightKg + projectedChangeKg).toFixed(1));

  // Uncertainty expands over time
  const uncertaintyMarginKg = Number((0.4 + 0.02 * days).toFixed(1));
  const rangeMinKg = Number((projectedWeightKg - uncertaintyMarginKg).toFixed(1));
  const rangeMaxKg = Number((projectedWeightKg + uncertaintyMarginKg).toFixed(1));

  const confidence = hasEnoughData && Math.abs(effectiveWeeklyRateKg) < 1.5 ? (days <= 30 ? 'High' : 'Moderate') : 'Low';

  const assumptions = [
    `Assumes continued average intake of ~${Math.round(recentAvgCalorieIntake)} kcal/day`,
    `Assumes activity remains aligned with your baseline TDEE of ~${Math.round(tdee)} kcal/day`,
    `Thermodynamic conversion constant: 7,700 kcal energy equivalent per 1.0 kg tissue`,
    `Scale weight fluctuations (glycogen, water retention, digestion) cause practical variance of ±${uncertaintyMarginKg} kg`,
  ];

  return {
    days,
    projectedWeightKg,
    projectedChangeKg,
    rangeMinKg,
    rangeMaxKg,
    estimatedWeeklyRateKg: Number(effectiveWeeklyRateKg.toFixed(2)),
    confidence,
    assumptions,
  };
}

export function calculateDaysToGoal(
  currentWeightKg: number,
  goalWeightKg: number,
  weeklyRateKg: number
): { estimatedDays: number | null; rangeMinDays: number | null; rangeMaxDays: number | null; statusText: string } {
  const weightDelta = goalWeightKg - currentWeightKg;

  if (Math.abs(weightDelta) < 0.2) {
    return {
      estimatedDays: 0,
      rangeMinDays: 0,
      rangeMaxDays: 0,
      statusText: 'Goal weight achieved! Currently in maintenance phase.',
    };
  }

  // Direction checks
  if ((weightDelta < 0 && weeklyRateKg >= 0) || (weightDelta > 0 && weeklyRateKg <= 0)) {
    return {
      estimatedDays: null,
      rangeMinDays: null,
      rangeMaxDays: null,
      statusText: 'Current trajectory is not moving toward your goal weight.',
    };
  }

  if (Math.abs(weeklyRateKg) < 0.05) {
    return {
      estimatedDays: null,
      rangeMinDays: null,
      rangeMaxDays: null,
      statusText: 'Not enough weight trajectory velocity to compute goal timeline.',
    };
  }

  const weeksNeeded = Math.abs(weightDelta / weeklyRateKg);
  const estimatedDays = Math.round(weeksNeeded * 7);
  const rangeMinDays = Math.max(1, Math.round(estimatedDays * 0.85));
  const rangeMaxDays = Math.round(estimatedDays * 1.25);

  return {
    estimatedDays,
    rangeMinDays,
    rangeMaxDays,
    statusText: `Estimated ${estimatedDays} days (range: ${rangeMinDays}–${rangeMaxDays} days) at ~${Math.abs(weeklyRateKg).toFixed(2)} kg/week.`,
  };
}

// ----------------- Under-logging & Data Quality ----------------- //

export interface DataQualityAlert {
  type: 'under_logging' | 'missing_meals' | 'missing_activity' | 'irregular_weigh_in' | 'consistent_tracking';
  severity: 'info' | 'warning';
  title: string;
  message: string;
  recommendation?: string;
}

export function assessDataQuality(
  daysAnalyzed: number,
  daysWithMeals: number,
  avgCalories: number,
  bmr: number,
  daysWithActivity: number,
  daysWithWeights: number
): DataQualityAlert[] {
  const alerts: DataQualityAlert[] = [];

  if (daysAnalyzed === 0) return alerts;

  // Rule: Low calorie check relative to BMR
  if (daysWithMeals >= 3 && avgCalories > 0 && avgCalories < bmr * 0.7) {
    alerts.push({
      type: 'under_logging',
      severity: 'warning',
      title: 'Unusually Low Logged Intake',
      message:
        'Your recent logged intake appears unusually low relative to your expected basal metabolic rate. This may reflect incomplete logging, snack omissions, or temporary low appetite.',
      recommendation: 'Track cooking oils and sauces to ensure all calories are captured.',
    });
  }

  // Missing meals across days
  const mealAdherence = daysWithMeals / daysAnalyzed;
  if (mealAdherence < 0.6 && daysAnalyzed >= 7) {
    alerts.push({
      type: 'missing_meals',
      severity: 'info',
      title: 'Missing Meal Logs',
      message: `Meals were logged on ${daysWithMeals} of the last ${daysAnalyzed} days. Note: Unlogged periods are preserved as unknown, never assumed as fasting.`,
      recommendation: 'Log quick meals or snacks to improve forecasting accuracy.',
    });
  }

  // Missing activity
  if (daysWithActivity < daysAnalyzed * 0.4 && daysAnalyzed >= 7) {
    alerts.push({
      type: 'missing_activity',
      severity: 'info',
      title: 'Baseline Activity In Use',
      message: 'No specific workouts were logged on several days. Projections automatically apply your configured baseline activity as an estimate.',
      recommendation: 'Sync step counts or log exercise sessions for tailored burn metrics.',
    });
  }

  if (alerts.length === 0 && daysWithMeals >= 5) {
    alerts.push({
      type: 'consistent_tracking',
      severity: 'info',
      title: 'High Tracking Quality',
      message: 'Your recent logging consistency provides high-confidence data for forecasting and trend analysis.',
      recommendation: 'Maintain your current tracking routine for optimal predictability.',
    });
  }

  return alerts;
}

// ----------------- Extended Helpers for Progress & Analytics ----------------- //

export function calculateTargetCalories(tdee: number, goal: GoalType, customDeficit?: number): number {
  const delta = customDeficit !== undefined ? customDeficit : 500;
  if (goal === 'lose') return Math.max(1200, Math.round(tdee - delta));
  if (goal === 'gain') return Math.round(tdee + delta);
  return Math.round(tdee);
}

export interface DailySeriesPoint {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weight: number | null;
  rolling_weight_avg: number | null;
  steps: number;
  deficit: number;
}

export function generateRollingAverages(
  meals: { date: string; foods: { calories?: number; protein?: number; carbs?: number; fat?: number }[] }[],
  weights: { date: string; weight_kg: number }[],
  activities: { date: string; steps?: number }[],
  windowDays = 7
): DailySeriesPoint[] {
  // Collect all unique dates
  const dateSet = new Set<string>();
  meals.forEach((m) => dateSet.add(m.date));
  weights.forEach((w) => dateSet.add(w.date));
  activities.forEach((a) => dateSet.add(a.date));

  const sortedDates = Array.from(dateSet).sort();
  if (sortedDates.length === 0) return [];

  // Group by date
  const mealMap: Record<string, { cals: number; prot: number; carbs: number; fat: number }> = {};
  meals.forEach((m) => {
    if (!mealMap[m.date]) mealMap[m.date] = { cals: 0, prot: 0, carbs: 0, fat: 0 };
    m.foods.forEach((f) => {
      mealMap[m.date].cals += f.calories || 0;
      mealMap[m.date].prot += f.protein || 0;
      mealMap[m.date].carbs += f.carbs || 0;
      mealMap[m.date].fat += f.fat || 0;
    });
  });

  const weightMap: Record<string, number> = {};
  weights.forEach((w) => {
    weightMap[w.date] = w.weight_kg;
  });

  const stepMap: Record<string, number> = {};
  activities.forEach((a) => {
    stepMap[a.date] = (stepMap[a.date] || 0) + (a.steps || 0);
  });

  const result: DailySeriesPoint[] = [];

  for (let i = 0; i < sortedDates.length; i++) {
    const d = sortedDates[i];
    const m = mealMap[d] || { cals: 0, prot: 0, carbs: 0, fat: 0 };
    const w = weightMap[d] !== undefined ? weightMap[d] : null;
    const s = stepMap[d] || 0;

    // Calculate rolling average weight over preceding window
    let rollingWeight: number | null = null;
    const windowWeights: number[] = [];
    for (let j = Math.max(0, i - windowDays + 1); j <= i; j++) {
      const pastDate = sortedDates[j];
      if (weightMap[pastDate] !== undefined) {
        windowWeights.push(weightMap[pastDate]);
      }
    }
    if (windowWeights.length > 0) {
      const sum = windowWeights.reduce((a, b) => a + b, 0);
      rollingWeight = Number((sum / windowWeights.length).toFixed(1));
    }

    result.push({
      date: d,
      calories: m.cals,
      protein: m.prot,
      carbs: m.carbs,
      fat: m.fat,
      weight: w,
      rolling_weight_avg: rollingWeight || w,
      steps: s,
      deficit: 0,
    });
  }

  return result;
}

export interface AdaptiveMetabolicModel {
  theoreticalTdee: number;
  observedTdee: number | null;
  adaptiveTdee: number;
  dailyDeficit: number;
  adaptationWeight: number; // 0 to 0.50 empirical weighting
  calibrationStatus: 'baseline' | 'calibrating' | 'calibrated';
  calibrationLabel: string;
  dataPointsUsed: number;
  empiricalWeeklyRateKg: number | null;
  projectedWeeklyRateKg: number;
}

export interface SmartAlternativeOption {
  id: string;
  title: string;
  category: 'swap' | 'activity' | 'protein' | 'hydration' | 'portion' | 'meal_timing';
  description: string;
  calorieDelta: number; // e.g. -180 kcal
  proteinDeltaG?: number; // e.g. +14g
  daysSavedOnGoal: number; // e.g. 14 days
  difficulty: 'Easy' | 'Moderate';
  targetedHabit?: string;
  source?: 'gemini_api' | 'local_fallback';
}

export function calculateDaysSavedOnGoal(
  currentDeficit: number,
  remainingWeightKg: number,
  dailyCalDelta: number
): number {
  if (remainingWeightKg <= 0) return 0;
  const absDelta = Math.abs(dailyCalDelta);
  const baseDeficit = Math.max(100, currentDeficit);
  const baseDailyRateKg = (baseDeficit * 0.453592) / 3500;
  const newDailyRateKg = ((baseDeficit + absDelta) * 0.453592) / 3500;
  if (baseDailyRateKg <= 0 || newDailyRateKg <= 0) return 0;
  const baseDays = Math.round(remainingWeightKg / baseDailyRateKg);
  const newDays = Math.round(remainingWeightKg / newDailyRateKg);
  return Math.max(1, baseDays - newDays);
}

export function calculateAdaptiveMetabolicModel(
  dailySeries: DailySeriesPoint[],
  currentWeight: number,
  theoreticalTdee: number,
  avgIntakeOverride?: number
): AdaptiveMetabolicModel {
  const pointsWithWeight = dailySeries.filter((p) => p.weight !== null && p.weight > 0);
  const pointsWithCalories = dailySeries.filter((p) => p.calories > 0);

  const totalDays = dailySeries.length;
  const avgIntake = avgIntakeOverride || (pointsWithCalories.length > 0
    ? Math.round(pointsWithCalories.reduce((acc, p) => acc + p.calories, 0) / pointsWithCalories.length)
    : theoreticalTdee - 500);

  // If fewer than 3 weigh-ins across history, use baseline theoretical physics
  if (pointsWithWeight.length < 3 || totalDays < 5) {
    const defaultDeficit = Math.max(0, theoreticalTdee - avgIntake);
    const weeklyRate = Number((-(defaultDeficit * 7) / 7700).toFixed(2));

    return {
      theoreticalTdee,
      observedTdee: null,
      adaptiveTdee: theoreticalTdee,
      dailyDeficit: defaultDeficit,
      adaptationWeight: 0,
      calibrationStatus: 'baseline',
      calibrationLabel: 'Standard Metabolic Baseline (Awaiting history logs)',
      dataPointsUsed: pointsWithWeight.length,
      empiricalWeeklyRateKg: null,
      projectedWeeklyRateKg: weeklyRate,
    };
  }

  // Calculate empirical weight change velocity over logged window
  const firstPoint = pointsWithWeight[0];
  const lastPoint = pointsWithWeight[pointsWithWeight.length - 1];

  const firstDate = new Date(firstPoint.date).getTime();
  const lastDate = new Date(lastPoint.date).getTime();
  const elapsedDays = Math.max(1, Math.round((lastDate - firstDate) / (1000 * 3600 * 24)));

  const weightDeltaKg = (lastPoint.rolling_weight_avg || lastPoint.weight!) - (firstPoint.rolling_weight_avg || firstPoint.weight!);
  const dailyRateKg = weightDeltaKg / elapsedDays;
  const empiricalWeeklyRateKg = Number((dailyRateKg * 7).toFixed(2));

  // Compute observed TDEE: Observed TDEE = Mean Intake + (Daily Weight Rate * 7700 kcal/kg)
  const rawObservedTdee = Math.round(avgIntake + dailyRateKg * 7700);

  // Physiologically bound observed TDEE within ±25% of theoretical TDEE to reject water weight noise
  const minSensibleTdee = Math.round(theoreticalTdee * 0.75);
  const maxSensibleTdee = Math.round(theoreticalTdee * 1.25);
  const clampedObservedTdee = Math.max(minSensibleTdee, Math.min(maxSensibleTdee, rawObservedTdee));

  // Bayesian shrinkage / adaptive weighting:
  // Starts small (15%), grows to 35%, capped at 50% so model is NEVER purely reliant on past noise!
  let adaptationWeight = 0.15;
  let calibrationStatus: 'baseline' | 'calibrating' | 'calibrated' = 'calibrating';
  let calibrationLabel = `Calibrating (${pointsWithWeight.length} weigh-ins over ${elapsedDays}d)`;

  if (elapsedDays >= 14 && pointsWithWeight.length >= 7) {
    adaptationWeight = 0.35;
    calibrationStatus = 'calibrating';
    calibrationLabel = `Adapted to recent trend (35% learned, 65% baseline)`;
  }
  if (elapsedDays >= 21 && pointsWithWeight.length >= 12) {
    adaptationWeight = 0.50; // Maximum cap: balanced 50/50 blend
    calibrationStatus = 'calibrated';
    calibrationLabel = `Self-Calibrated Model (50% personal metabolism, 50% baseline)`;
  }

  // Blended Adaptive TDEE
  const adaptiveTdee = Math.round(
    (1 - adaptationWeight) * theoreticalTdee + adaptationWeight * clampedObservedTdee
  );

  const dailyDeficit = adaptiveTdee - avgIntake;
  const projectedWeeklyRateKg = Number((-(dailyDeficit * 7) / 7700).toFixed(2));

  return {
    theoreticalTdee,
    observedTdee: clampedObservedTdee,
    adaptiveTdee,
    dailyDeficit,
    adaptationWeight,
    calibrationStatus,
    calibrationLabel,
    dataPointsUsed: pointsWithWeight.length,
    empiricalWeeklyRateKg,
    projectedWeeklyRateKg,
  };
}

export function forecastWeightThermodynamic(
  currentWeight: number,
  avgDailyDeficit: number,
  days: number
): {
  projected_weight_kg: number;
  projected_change_kg: number;
  weight_delta_kg: number;
  confidence_interval_kg: [number, number];
} {
  // Slight metabolic adaptation decay (~2% per 30 days of prolonged deficit)
  const adaptationFactor = 1 - (days / 365) * 0.08;
  const effectiveDeficit = avgDailyDeficit * adaptationFactor;

  const totalDeficit = effectiveDeficit * days;
  const projectedChangeKg = Number((-totalDeficit / 7700).toFixed(1));
  const projectedWeightKg = Number((currentWeight + projectedChangeKg).toFixed(1));

  // Uncertainty interval scales with time horizon (±0.4kg to ±1.5kg)
  const marginKg = Number((0.4 + 0.018 * days).toFixed(1));
  const minBound = Number((projectedWeightKg - marginKg).toFixed(1));
  const maxBound = Number((projectedWeightKg + marginKg).toFixed(1));

  return {
    projected_weight_kg: projectedWeightKg,
    projected_change_kg: projectedChangeKg,
    weight_delta_kg: projectedChangeKg,
    confidence_interval_kg: [minBound, maxBound],
  };
}

export function getSmartNutritionalSuggestions(
  currentDeficit: number,
  currentWeight: number,
  targetWeight: number,
  avgProteinG: number,
  avgSteps: number
): SmartAlternativeOption[] {
  const suggestions: SmartAlternativeOption[] = [];
  const remainingWeightKg = Math.max(0, currentWeight - targetWeight);

  // Helper to compute days saved on target for a given daily calorie reduction
  const calcDaysSaved = (dailyCalDelta: number): number => {
    if (remainingWeightKg <= 0) return 0;
    const baseDailyRateKg = Math.max(0.01, (Math.max(100, currentDeficit) * 0.453592) / 3500);
    const newDailyRateKg = Math.max(0.01, ((Math.max(100, currentDeficit) + dailyCalDelta) * 0.453592) / 3500);
    const baseDays = Math.round(remainingWeightKg / baseDailyRateKg);
    const newDays = Math.round(remainingWeightKg / newDailyRateKg);
    return Math.max(1, baseDays - newDays);
  };

  // Suggestion 1: High Protein Satiety Swap
  suggestions.push({
    id: 'greek_yogurt_swap',
    title: 'Swap High-Fat Dairy/Dessert for 0% Greek Yogurt',
    category: 'swap',
    description: 'Replacing evening desserts or whole creams with Greek yogurt adds ~15g pure protein while cutting ~160 kcal and boosting satiety.',
    calorieDelta: -160,
    proteinDeltaG: 15,
    daysSavedOnGoal: calcDaysSaved(160),
    difficulty: 'Easy',
  });

  // Suggestion 2: Activity / Steps Booster
  if (avgSteps < 10000) {
    const addSteps = avgSteps < 6000 ? 3000 : 2500;
    const burnKcal = Math.round(addSteps * 0.04);
    suggestions.push({
      id: 'step_booster',
      title: `Add a brisk ${Math.round(addSteps / 1000)}k step stroll daily`,
      category: 'activity',
      description: `Adding ~${addSteps.toLocaleString()} steps increases daily non-exercise expenditure (NEAT) by ~${burnKcal} kcal without triggering compensatory appetite.`,
      calorieDelta: -burnKcal,
      daysSavedOnGoal: calcDaysSaved(burnKcal),
      difficulty: 'Easy',
    });
  }

  // Suggestion 3: Cooking Oil & Condiment Optimizer
  suggestions.push({
    id: 'oil_spray_swap',
    title: 'Switch to 1-Second Avocado/Olive Oil Spray',
    category: 'swap',
    description: 'Free-pouring cooking oil often adds 200+ hidden kcal per pan. Switching to a calibrated spray saves ~180 kcal effortlessly.',
    calorieDelta: -180,
    daysSavedOnGoal: calcDaysSaved(180),
    difficulty: 'Easy',
  });

  // Suggestion 4: Beverage / Zero-Calorie Hydration
  suggestions.push({
    id: 'beverage_swap',
    title: 'Zero-Calorie Sparkling Water & Flavored Infusions',
    category: 'hydration',
    description: 'Swapping caloric sodas, sweetened teas, or fruit juices for sparkling lemon water saves ~150–220 kcal with zero sacrifice on taste.',
    calorieDelta: -180,
    daysSavedOnGoal: calcDaysSaved(180),
    difficulty: 'Easy',
  });

  // Suggestion 5: Lean Protein Optimization
  const targetProt = currentWeight * 1.8;
  if (avgProteinG < targetProt) {
    suggestions.push({
      id: 'lean_protein_boost',
      title: 'Prioritize 93/7 Lean Poultry or Egg Whites',
      category: 'protein',
      description: `Targeting ~${Math.round(targetProt)}g protein increases the Thermic Effect of Food (TEF) by ~60 kcal/day and protects lean muscle tissue during your deficit.`,
      calorieDelta: -60,
      proteinDeltaG: 20,
      daysSavedOnGoal: calcDaysSaved(60),
      difficulty: 'Moderate',
    });
  }

  return suggestions;
}

export function assessDataQualityAndUnderlogging(
  dailySeries: DailySeriesPoint[],
  bmr: number,
  userTdee: number,
  totalWeightDelta: number
): DataQualityAlert[] {
  const daysAnalyzed = dailySeries.length;
  const daysWithMeals = dailySeries.filter((d) => d.calories > 0).length;
  const avgCalories = daysAnalyzed > 0 ? dailySeries.reduce((acc, d) => acc + d.calories, 0) / daysAnalyzed : 0;
  const daysWithActivity = dailySeries.filter((d) => d.steps > 0).length;
  const daysWithWeights = dailySeries.filter((d) => d.weight !== null).length;

  return assessDataQuality(daysAnalyzed, daysWithMeals, avgCalories, bmr, daysWithActivity, daysWithWeights);
}
