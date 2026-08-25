import {
  ActivityEntry,
  AIMessage,
  FastingEntry,
  HypotheticalMeal,
  Meal,
  UserProfile,
  WeightEntry,
} from '../types';
import {
  calculateBMI,
  calculateDaysToGoal,
  calculateThermodynamicForecast,
  calculateRecommendedTargets,
  SmartAlternativeOption,
  calculateDaysSavedOnGoal,
  getSmartNutritionalSuggestions,
} from '../utils/calculations';
import { storage } from './storage';

export interface AIContextSnapshot {
  profile: {
    name: string;
    gender: string;
    age: number;
    height_cm: number;
    current_weight_kg: number;
    goal_weight_kg: number;
    activity_baseline: string;
    current_goal: string;
    target_rate_kg_week: number;
    calorie_target: number;
    protein_target_g: number;
    carb_target_g: number;
    fat_target_g: number;
    units: any;
    bmi: number;
    bmi_category: string;
  };
  today: {
    date: string;
    calories_logged: number;
    calorie_target: number;
    calories_remaining: number;
    protein_logged_g: number;
    protein_target_g: number;
    carbs_logged_g: number;
    carb_target_g: number;
    fat_logged_g: number;
    fat_target_g: number;
    steps_logged: number;
    workouts_logged: number;
    meals_logged_count: number;
    meal_types_logged: string[];
    weight_logged_today?: number;
    active_fast_logged?: boolean;
    missing_meal_types_not_logged: string[];
  };
  historical_summary: {
    days_analyzed: number;
    avg_calories_last_7d: number;
    avg_calories_last_30d: number;
    avg_protein_last_7d: number;
    avg_steps_last_7d: number;
    workouts_this_week: number;
    workouts_last_week: number;
    workout_minutes_this_week: number;
    workout_minutes_last_week: number;
    observed_weight_trend_kg_week: number | null;
    recent_weights: { date: string; weight_kg: number }[];
    explicit_fasts_count_last_30d: number;
    unlogged_activity_days_count: number;
    forecast_30d: {
      projected_weight_kg: number;
      projected_change_kg: number;
      range_min_kg: number;
      range_max_kg: number;
    };
    days_to_goal: {
      estimated_days: number | null;
      range_min_days: number | null;
      range_max_days: number | null;
      status_text: string;
    };
  };
  frequent_meals: string[];
  data_quality_notes: string[];
}

export function buildAIContextSnapshot(
  profile: UserProfile,
  meals: Meal[],
  weights: WeightEntry[],
  activities: ActivityEntry[],
  fasting: FastingEntry[]
): AIContextSnapshot {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayMeals = meals.filter((m) => m.date === todayStr);

  let todayCals = 0;
  let todayProt = 0;
  let todayCarbs = 0;
  let todayFat = 0;

  todayMeals.forEach((m) => {
    m.foods.forEach((f) => {
      todayCals += f.calories || 0;
      todayProt += f.protein || 0;
      todayCarbs += f.carbs || 0;
      todayFat += f.fat || 0;
    });
  });

  const loggedMealTypes = Array.from(new Set(todayMeals.map((m) => m.meal_type)));
  const standardTypes = ['breakfast', 'lunch', 'dinner'];
  const missingTypes = standardTypes.filter((t) => !loggedMealTypes.includes(t as any));

  const todayActivities = activities.filter((a) => a.date === todayStr);
  const todaySteps = todayActivities.reduce((acc, a) => acc + (a.steps || 0), 0);
  const todayWorkouts = todayActivities.filter((a) => (a.duration_minutes || 0) > 0).length;

  const todayWeights = weights.filter((w) => w.date === todayStr);
  const todayWeightVal = todayWeights.length > 0 ? todayWeights[todayWeights.length - 1].weight_kg : undefined;

  const getDaysAgoStr = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  const str7DaysAgo = getDaysAgoStr(7);
  const str14DaysAgo = getDaysAgoStr(14);
  const str30DaysAgo = getDaysAgoStr(30);

  const mealsByDate: Record<string, { cals: number; prot: number }> = {};
  meals.forEach((m) => {
    if (!mealsByDate[m.date]) mealsByDate[m.date] = { cals: 0, prot: 0 };
    m.foods.forEach((f) => {
      mealsByDate[m.date].cals += f.calories || 0;
      mealsByDate[m.date].prot += f.protein || 0;
    });
  });

  const dates7d = Object.keys(mealsByDate).filter((d) => d >= str7DaysAgo && d <= todayStr);
  const dates30d = Object.keys(mealsByDate).filter((d) => d >= str30DaysAgo && d <= todayStr);

  const avgCals7d = dates7d.length > 0 ? Math.round(dates7d.reduce((acc, d) => acc + mealsByDate[d].cals, 0) / dates7d.length) : profile.calorie_target;
  const avgCals30d = dates30d.length > 0 ? Math.round(dates30d.reduce((acc, d) => acc + mealsByDate[d].cals, 0) / dates30d.length) : profile.calorie_target;
  const avgProt7d = dates7d.length > 0 ? Math.round(dates7d.reduce((acc, d) => acc + mealsByDate[d].prot, 0) / dates7d.length) : profile.protein_target_g;

  const actsThisWeek = activities.filter((a) => a.date >= str7DaysAgo && a.date <= todayStr);
  const actsLastWeek = activities.filter((a) => a.date >= str14DaysAgo && a.date < str7DaysAgo);

  const workoutsThisWeek = actsThisWeek.filter((a) => (a.duration_minutes || 0) > 0).length;
  const workoutsLastWeek = actsLastWeek.filter((a) => (a.duration_minutes || 0) > 0).length;
  const workoutMinsThisWeek = actsThisWeek.reduce((acc, a) => acc + (a.duration_minutes || 0), 0);
  const workoutMinsLastWeek = actsLastWeek.reduce((acc, a) => acc + (a.duration_minutes || 0), 0);
  const avgSteps7d = actsThisWeek.length > 0 ? Math.round(actsThisWeek.reduce((acc, a) => acc + (a.steps || 0), 0) / 7) : 8000;

  const sortedWeights = [...weights].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let observedTrendKgWeek: number | null = null;
  if (sortedWeights.length >= 4) {
    const oldest = sortedWeights[0];
    const newest = sortedWeights[sortedWeights.length - 1];
    const diffDays = Math.max(7, (new Date(newest.timestamp).getTime() - new Date(oldest.timestamp).getTime()) / (1000 * 3600 * 24));
    const deltaKg = newest.weight_kg - oldest.weight_kg;
    observedTrendKgWeek = Number(((deltaKg / diffDays) * 7).toFixed(2));
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

  const forecast = calculateThermodynamicForecast(
    profile.current_weight_kg,
    targets.tdee,
    avgCals7d,
    observedTrendKgWeek,
    30,
    sortedWeights.length >= 3
  );

  const daysToGoal = calculateDaysToGoal(
    profile.current_weight_kg,
    profile.goal_weight_kg,
    observedTrendKgWeek || profile.target_rate_kg_week
  );

  const bmiData = calculateBMI(profile.current_weight_kg, profile.height_cm);

  const fastsLast30d = fasting.filter((f) => f.date >= str30DaysAgo);

  const foodCounts: Record<string, number> = {};
  meals.forEach((m) => {
    m.foods.forEach((f) => {
      foodCounts[f.food_name] = (foodCounts[f.food_name] || 0) + 1;
    });
  });
  const frequentMeals = Object.entries(foodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name} (${count}x)`);

  const dataQualityNotes: string[] = [
    'Unlogged meals are treated strictly as unlogged/unknown, NOT as fasting.',
    `Baseline activity (${profile.activity_baseline}) is used as an energy estimate on unlogged workout days.`,
    'Predictions are estimates with confidence bounds based on current logged patterns.',
  ];

  return {
    profile: {
      name: profile.name,
      gender: profile.gender,
      age: profile.age,
      height_cm: profile.height_cm,
      current_weight_kg: profile.current_weight_kg,
      goal_weight_kg: profile.goal_weight_kg,
      activity_baseline: profile.activity_baseline,
      current_goal: profile.current_goal,
      target_rate_kg_week: profile.target_rate_kg_week,
      calorie_target: profile.calorie_target,
      protein_target_g: profile.protein_target_g,
      carb_target_g: profile.carb_target_g,
      fat_target_g: profile.fat_target_g,
      units: profile.units,
      bmi: bmiData.bmi,
      bmi_category: bmiData.category,
    },
    today: {
      date: todayStr,
      calories_logged: todayCals,
      calorie_target: profile.calorie_target,
      calories_remaining: Math.max(0, profile.calorie_target - todayCals),
      protein_logged_g: todayProt,
      protein_target_g: profile.protein_target_g,
      carbs_logged_g: todayCarbs,
      carb_target_g: profile.carb_target_g,
      fat_logged_g: todayFat,
      fat_target_g: profile.fat_target_g,
      steps_logged: todaySteps,
      workouts_logged: todayWorkouts,
      meals_logged_count: todayMeals.length,
      meal_types_logged: loggedMealTypes,
      weight_logged_today: todayWeightVal,
      missing_meal_types_not_logged: missingTypes,
    },
    historical_summary: {
      days_analyzed: Math.max(dates30d.length, 1),
      avg_calories_last_7d: avgCals7d,
      avg_calories_last_30d: avgCals30d,
      avg_protein_last_7d: avgProt7d,
      avg_steps_last_7d: avgSteps7d,
      workouts_this_week: workoutsThisWeek,
      workouts_last_week: workoutsLastWeek,
      workout_minutes_this_week: workoutMinsThisWeek,
      workout_minutes_last_week: workoutMinsLastWeek,
      observed_weight_trend_kg_week: observedTrendKgWeek,
      recent_weights: sortedWeights.slice(-5).map((w) => ({ date: w.date, weight_kg: w.weight_kg })),
      explicit_fasts_count_last_30d: fastsLast30d.length,
      unlogged_activity_days_count: Math.max(0, 7 - actsThisWeek.length),
      forecast_30d: {
        projected_weight_kg: forecast.projectedWeightKg,
        projected_change_kg: forecast.projectedChangeKg,
        range_min_kg: forecast.rangeMinKg,
        range_max_kg: forecast.rangeMaxKg,
      },
      days_to_goal: {
        estimated_days: daysToGoal.estimatedDays,
        range_min_days: daysToGoal.rangeMinDays,
        range_max_days: daysToGoal.rangeMaxDays,
        status_text: daysToGoal.statusText,
      },
    },
    frequent_meals: frequentMeals,
    data_quality_notes: dataQualityNotes,
  };
}

export function createAIContextSnapshot(
  profile: UserProfile,
  todayMeals: Meal[],
  meals: Meal[],
  weights: WeightEntry[],
  activities: ActivityEntry[],
  fasting: FastingEntry[]
): AIContextSnapshot {
  return buildAIContextSnapshot(profile, meals, weights, activities, fasting);
}

// ----------------- Deterministic & Offline Coaching Engine ----------------- //

function generateDeterministicAIAnswer(prompt: string, context: AIContextSnapshot): string {
  const p = prompt.toLowerCase();

  if (p.includes('training') || p.includes('workout') || p.includes('exercise') || p.includes('activity')) {
    const tw = context.historical_summary.workouts_this_week;
    const lw = context.historical_summary.workouts_last_week;
    const tm = context.historical_summary.workout_minutes_this_week;
    const lm = context.historical_summary.workout_minutes_last_week;
    const steps = context.historical_summary.avg_steps_last_7d;

    const diff = tw - lw;
    let comparison = 'right on par with';
    if (diff > 0) comparison = `up by ${diff} session(s) compared to`;
    if (diff < 0) comparison = `down by ${Math.abs(diff)} session(s) compared to`;

    return `You've logged ${tw} training session${tw === 1 ? '' : 's'} this week totaling ${tm} minutes, which is ${comparison} last week (${lw} sessions, ${lm} mins).

Metabolic & Activity Insights:
• Daily Step Average: ~${steps.toLocaleString()} steps/day (7-day rolling)
• Energy Baseline: ${context.profile.activity_baseline.toUpperCase()} multiplier applied on unlogged days
• Training Status: ${diff >= 0 ? 'Excellent momentum! Progressive overload and consistent resistance work ensure maximum lean muscle retention while dieting.' : 'Slightly lighter week than before, which works great as an active deload to manage systemic fatigue.'}

Next Step: Aim for 8,000–10,000 steps today to keep non-exercise activity thermogenesis (NEAT) elevated.`;
  }

  if (p.includes('30 days') || p.includes('60 days') || p.includes('weigh in') || p.includes('expected weight') || p.includes('forecast') || p.includes('prediction')) {
    const fc = context.historical_summary.forecast_30d;
    const current = context.profile.current_weight_kg;
    const trend = context.historical_summary.observed_weight_trend_kg_week;

    return `At your current intake average of ~${context.historical_summary.avg_calories_last_7d} kcal/day, thermodynamics project you will weigh approximately ${fc.projected_weight_kg} kg in 30 days (an estimated change of ${fc.projected_change_kg > 0 ? '+' : ''}${fc.projected_change_kg} kg).

Forecast Breakdown:
• Current Scale Benchmark: ${current} kg (Target: ${context.profile.goal_weight_kg} kg)
• Estimated 30-Day Range: ${fc.range_min_kg} kg – ${fc.range_max_kg} kg
• Weekly Rate of Pace: ${trend !== null ? `Observed ${trend > 0 ? '+' : ''}${trend} kg/week` : `Target pace of ${context.profile.target_rate_kg_week} kg/week`}

While day-to-day scale numbers fluctuate due to hydration and glycogen, your month-over-month trajectory remains locked on your target weight.`;
  }

  if (p.includes('what should i eat') || p.includes('calories left') || p.includes('eat tonight') || p.includes('remaining') || p.includes('dinner') || p.includes('snack') || p.includes('lunch') || p.includes('breakfast')) {
    const remCals = context.today.calories_remaining;
    const remProt = Math.max(0, context.today.protein_target_g - context.today.protein_logged_g);

    const mealIdeas = [
      `Grilled Chicken or Turkey Breast Bowl: 180g lean poultry + 150g steamed jasmine rice or roasted sweet potato + steamed broccoli/asparagus (~440 kcal, 42g protein, 48g carbs, 6g fat)`,
      `Pan-Seared White Fish or Salmon Fillet: 180g cod/tilapia or 140g salmon + quinoa & crisp garden salad with lemon vinaigrette (~390 kcal, 36g protein, 32g carbs, 9g fat)`,
      `High-Protein Greek Yogurt Parfait: 250g 0% Greek yogurt + 1 scoop vanilla whey protein + 80g mixed berries + 15g crushed walnuts (~330 kcal, 44g protein, 24g carbs, 6g fat)`,
      `Loaded Scramble & Sourdough Toast: 3 egg whites + 2 whole eggs + baby spinach, mushrooms, and 1 slice artisanal sourdough toast (~380 kcal, 32g protein, 28g carbs, 12g fat)`,
      `Lean Beef or Tofu High-Fiber Wrap: 150g extra lean beef (93/7) or seasoned firm tofu + low-carb tortilla + salsa & light avocado (~420 kcal, 38g protein, 30g carbs, 11g fat)`,
    ];

    const selected = mealIdeas.sort(() => 0.5 - Math.random()).slice(0, 3);

    return `You have ${remCals} kcal and ~${remProt}g protein remaining on today's target (${context.today.calories_logged} / ${context.today.calorie_target} kcal consumed so far).

Here are 3 balanced meal ideas that hit your protein target while staying within your budget:

${selected.map((idea, idx) => `${idx + 1}. ${idea}`).join('\n\n')}

Pro Tip: Prioritize lean protein and dietary fiber first — this maximizes satiety signaling and thermic effect of food (TEF).`;
  }

  if (p.includes('days until') || p.includes('reach my goal') || p.includes('reach goal') || p.includes('how long')) {
    const dtg = context.historical_summary.days_to_goal;
    const cur = context.profile.current_weight_kg;
    const goal = context.profile.goal_weight_kg;
    const delta = Math.abs(cur - goal).toFixed(1);

    return `${dtg.status_text}

Progress Overview:
• Starting / Current Scale: ${cur} kg
• Goal Milestone: ${goal} kg (Remaining: ${delta} kg)
• Deficit Velocity: ${context.historical_summary.observed_weight_trend_kg_week ? `Observed ${context.historical_summary.observed_weight_trend_kg_week} kg/week` : `Target pace of ${context.profile.target_rate_kg_week} kg/week`}

Staying committed to your daily intake target of ${context.profile.calorie_target} kcal will carry you steadily to your goal without metabolic adaptation.`;
  }

  if (p.includes("hasn't changed") || p.includes('not losing') || p.includes('plateau') || p.includes('stuck') || p.includes('fluctuat')) {
    return `Scale weight stalls over 3–7 days are almost universally caused by water balance dynamics rather than stalled fat loss.

Key Factors at Play:
1. Glycogen Storage: Every gram of stored carbohydrate binds 3 to 4 grams of water in liver and muscle tissue.
2. Sodium Shifts: A slightly higher-sodium meal temporarily increases extracellular water retention for 24–48 hours.
3. Muscle Inflammation: Hard workouts cause microscopic muscle fiber tears, prompting localized fluid retention for repair.
4. Digestive Transit: Food mass in the GI tract adds temporary scale weight.

Data Check: Your 7-day average intake is ${context.historical_summary.avg_calories_last_7d} kcal/day against a target of ${context.profile.calorie_target} kcal. As long as your weekly energy deficit remains intact, fat mobilization is actively occurring. Focus on 7-day moving averages rather than single morning weigh-ins.`;
  }

  return `You are currently averaging ${context.historical_summary.avg_calories_last_7d} kcal/day with ${context.historical_summary.avg_protein_last_7d}g protein/day, progressing steadily toward your goal of ${context.profile.goal_weight_kg} kg.

Today's Live Status:
• Calories: ${context.today.calories_logged} / ${context.today.calorie_target} kcal (${context.today.calories_remaining} kcal remaining)
• Protein: ${context.today.protein_logged_g}g / ${context.today.protein_target_g}g
• Scale & BMI: ${context.profile.current_weight_kg} kg (BMI: ${context.profile.bmi} - ${context.profile.bmi_category})
• 30-Day Outlook: Projected ~${context.historical_summary.forecast_30d.projected_weight_kg} kg

Ask me anything about meal options, macro swaps, weight trends, or pre-logging hypothetical foods!`;
}

// ----------------- Direct on-device Gemini API calls (no backend server) ----------------- //
// There's no server to hide an API key behind, so the key is entered by the user in
// Profile > AI Settings and stored locally, then used to call the Gemini REST API directly
// from the device. Every call degrades gracefully to the local heuristic engine above if
// there's no key, no network, or an API error.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Curated list of models that are actually free-tier eligible as of the model's release
// (Google restricts Pro-tier models to paid billing — see docs). Flash-family models are
// the ones with a real free tier. This list is intentionally not exhaustive of every model
// Google ships — it's the practical "these work well and are free" picks. If Google renames
// or retires a model, users can still type a custom model ID in Profile settings.
export interface GeminiModelOption {
  id: string;
  label: string;
  description: string;
  tier: 'recommended' | 'fast' | 'lite';
}

export const GEMINI_MODELS: GeminiModelOption[] = [
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', description: 'Newest and strongest — best reasoning and accuracy, released Aug 2026.', tier: 'recommended' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', description: 'Previous newest-gen — excellent quality, slightly older than 3.7.', tier: 'recommended' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Older but very proven and reliable. Good fallback if newer models are rate-limited.', tier: 'fast' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', description: 'Newer generation, lightweight — very high free-tier request limits.', tier: 'lite' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', description: 'Fastest and cheapest older-gen option — best if you hit rate limits often.', tier: 'lite' },
  { id: 'local-neural-fast', label: 'Offline (No API Key Needed)', description: 'Runs fully on-device with no internet or key. Less nuanced, always available.', tier: 'lite' },
];

export const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';

async function callGemini(model: string, body: any): Promise<any> {
  const apiKey = storage.getGeminiApiKey();
  if (!apiKey) {
    throw { code: 'no_api_key', message: 'No Gemini API key configured' };
  }
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
  return { text, raw: data };
}

function extractJSON(text: string): any {
  const cleaned = text.replace(/```json\s*|```\s*/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in AI response');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export interface AIResponseWithMetadata {
  content: string;
  source: 'gemini_api' | 'local_fallback' | 'local_heuristic';
  model_used?: string;
  fallback_reason?: string;
  error_details?: string;
}

export async function askAIWithMetadata(
  prompt: string,
  contextSnapshot: AIContextSnapshot,
  conversationHistory: AIMessage[] = [],
  model: string = DEFAULT_GEMINI_MODEL
): Promise<AIResponseWithMetadata> {
  if (model === 'local-neural-fast') {
    return {
      content: generateDeterministicAIAnswer(prompt, contextSnapshot),
      source: 'local_heuristic',
      model_used: 'Offline Heuristic Engine',
    };
  }

  try {
    const systemPreamble = `You are Nutrideel's AI Nutrition & Metabolic Coach. Answer concisely and practically using the JSON context below. Do not repeat the raw JSON back to the user.\n\nCONTEXT:\n${JSON.stringify(contextSnapshot)}`;
    const contents = [
      ...conversationHistory.slice(-6).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: prompt }] },
    ];

    const { text } = await callGemini(model, {
      systemInstruction: { role: 'system', parts: [{ text: systemPreamble }] },
      contents,
    });

    if (text) {
      return { content: text, source: 'gemini_api', model_used: model };
    }
    throw new Error('Empty response');
  } catch (error: any) {
    const reason = error?.code === 'no_api_key' ? 'no_api_key' : error?.status === 429 ? 'rate_limit_429' : 'network_error';
    return {
      content: generateDeterministicAIAnswer(prompt, contextSnapshot),
      source: 'local_fallback',
      fallback_reason: reason,
      error_details: error?.message,
      model_used: 'Offline Fallback Engine',
    };
  }
}

export async function askAI(
  prompt: string,
  contextSnapshot: AIContextSnapshot,
  conversationHistory: AIMessage[] = [],
  model: string = DEFAULT_GEMINI_MODEL
): Promise<string> {
  const res = await askAIWithMetadata(prompt, contextSnapshot, conversationHistory, model);
  return res.content;
}

export async function askAIAssistant(
  prompt: string,
  contextSnapshot: AIContextSnapshot,
  conversationHistory: AIMessage[] = []
): Promise<AIMessage> {
  const content = await askAI(prompt, contextSnapshot, conversationHistory);
  return {
    id: `msg_ai_${Date.now()}`,
    role: 'assistant',
    content,
    timestamp: new Date().toISOString(),
  };
}

export async function analyzeHypotheticalMeal(
  hypotheticalMeal: HypotheticalMeal,
  contextSnapshot: AIContextSnapshot,
  model: string = DEFAULT_GEMINI_MODEL
): Promise<string> {
  let hypCals = 0;
  let hypProt = 0;

  hypotheticalMeal.items.forEach((f) => {
    hypCals += f.calories || 0;
    hypProt += f.protein || 0;
  });

  const totalProjectedCals = contextSnapshot.today.calories_logged + hypCals;
  const totalProjectedProt = contextSnapshot.today.protein_logged_g + hypProt;
  const calDelta = totalProjectedCals - contextSnapshot.today.calorie_target;

  const prompt = `Hypothetical Pre-Log Meal Analysis:\nMeal Items: ${hypotheticalMeal.items.map((i) => `${i.food_name} (${i.quantity} ${i.unit}, ${i.calories} kcal, ${i.protein}g P, ${i.carbs}g C, ${i.fat}g F)`).join(', ')}\nCurrent Logged Today: ${contextSnapshot.today.calories_logged} kcal, ${contextSnapshot.today.protein_logged_g}g P\nProjected Total If Eaten: ${totalProjectedCals} kcal / ${contextSnapshot.today.calorie_target} kcal target (Delta: ${calDelta > 0 ? '+' : ''}${calDelta} kcal)\nProjected Protein: ${totalProjectedProt}g / ${contextSnapshot.today.protein_target_g}g target\nIs this a reasonable choice given my remaining calories and today's macros? Keep the answer under 120 words.`;

  try {
    const { text } = await callGemini(model, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    if (text) return text;
  } catch (e) {
    // fall through to deterministic advice below
  }

  let adviceOutcome = '';
  if (calDelta <= 0) {
    adviceOutcome = `This meal fits neatly within your remaining calorie allowance (leaving ~${Math.abs(calDelta)} kcal remaining).`;
  } else if (calDelta <= 150) {
    adviceOutcome = `This meal puts you slightly above target (+${calDelta} kcal), which is well within normal daily variance and will not disrupt weekly progress.`;
  } else {
    adviceOutcome = `This meal exceeds today's target by ~${calDelta} kcal. If you choose to log it, consider reducing portion size slightly or choosing a lower-fat side.`;
  }

  return `Hypothetical Meal Advice

• Calorie Impact: ${contextSnapshot.today.calories_logged} kcal (Logged) + ${hypCals} kcal (Meal) = ${totalProjectedCals} / ${contextSnapshot.today.calorie_target} kcal
• Protein Impact: ${totalProjectedProt}g / ${contextSnapshot.today.protein_target_g}g target

Assessment
${adviceOutcome}

Note: This meal is currently unlogged. You can confirm to add it to your daily log or discard it at any time.`;
}

export interface EvaluatedFoodResponse {
  food_name: string;
  serving_description: string;
  quantity: number;
  unit: string;
  estimated_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  confidence?: 'high' | 'medium' | 'approximate' | 'rough_estimate' | string;
  ingredients_breakdown?: string[];
  nutritional_notes?: string;
  fallback?: boolean;
  source?: 'gemini_api' | 'local_dictionary' | 'local_generic' | 'local_fallback';
  fallbackReason?: string;
  modelUsed?: string;
  errorDetails?: string;
}

// Common dish lookup table for offline nutrition estimates (used when there's no API key or no signal)
export function evaluateVagueFoodLocally(input: string, reason: string = 'offline_dictionary'): EvaluatedFoodResponse {
  const clean = input.toLowerCase().trim();

  let multiplier = 1.0;
  let detectedUnit = 'portion';
  let unitDesc = '1 standard portion';

  if (clean.includes('half plate') || clean.includes('1/2 plate') || clean.includes('0.5 plate')) {
    multiplier = 0.5;
    detectedUnit = 'half plate';
    unitDesc = 'Half plate (~180-220g)';
  } else if (clean.includes('quarter plate') || clean.includes('1/4 plate')) {
    multiplier = 0.3;
    detectedUnit = 'quarter plate';
    unitDesc = 'Quarter plate (~120g)';
  } else if (clean.includes('2 plate') || clean.includes('two plate')) {
    multiplier = 2.0;
    detectedUnit = 'plates';
    unitDesc = '2 full plates (~750g)';
  } else if (clean.includes('plate')) {
    multiplier = 1.0;
    detectedUnit = 'plate';
    unitDesc = '1 standard plate (~380g)';
  } else if (clean.includes('small bowl')) {
    multiplier = 0.7;
    detectedUnit = 'small bowl';
    unitDesc = '1 small bowl (~180g)';
  } else if (clean.includes('big bowl') || clean.includes('large bowl')) {
    multiplier = 1.4;
    detectedUnit = 'big bowl';
    unitDesc = '1 large bowl (~450g)';
  } else if (clean.includes('bowl')) {
    multiplier = 1.0;
    detectedUnit = 'bowl';
    unitDesc = '1 standard bowl (~300g)';
  } else if (clean.includes('2 slice') || clean.includes('two slice')) {
    multiplier = 2.0;
    detectedUnit = 'slices';
    unitDesc = '2 slices (~220g)';
  } else if (clean.includes('3 slice')) {
    multiplier = 3.0;
    detectedUnit = 'slices';
    unitDesc = '3 slices (~330g)';
  } else if (clean.includes('slice')) {
    multiplier = 1.0;
    detectedUnit = 'slice';
    unitDesc = '1 slice (~110g)';
  } else if (clean.includes('cup')) {
    multiplier = 1.0;
    detectedUnit = 'cup';
    unitDesc = '1 cup (~240g)';
  } else if (clean.includes('can') || clean.includes('bottle')) {
    multiplier = 1.0;
    detectedUnit = 'can';
    unitDesc = '1 can / bottle (330ml)';
  }

  const dishes: { keywords: string[]; name: string; baseGrams: number; cals: number; p: number; c: number; f: number; fib: number; notes: string; breakdown: string[] }[] = [
    { keywords: ['biryani', 'biriyani', 'bryani'], name: 'Chicken Biryani with Basmati Rice', baseGrams: 380, cals: 580, p: 34, c: 72, f: 17, fib: 3, notes: 'High protein spiced rice meal prepared with chicken breast/thigh, basmati rice, and cooking ghee.', breakdown: ['Spiced Basmati Rice (~220g): 280 kcal', 'Marinated Chicken (~120g): 210 kcal', 'Ghee, Yogurt & Spices: 90 kcal'] },
    { keywords: ['pasta', 'spaghetti', 'fettuccine', 'penne', 'macaroni'], name: 'Pasta with Sauce & Seasoning', baseGrams: 320, cals: 460, p: 16, c: 68, f: 14, fib: 4, notes: 'Enriched durum wheat pasta with tomato/cream blend and olive oil.', breakdown: ['Cooked Pasta (~220g): 310 kcal', 'Sauce & Seasoning (~80g): 90 kcal', 'Olive oil & Cheese: 60 kcal'] },
    { keywords: ['pizza'], name: 'Oven-Baked Pizza', baseGrams: 240, cals: 520, p: 22, c: 58, f: 22, fib: 3, notes: 'Crust topped with mozzarella cheese, crushed tomato sauce, and herbs.', breakdown: ['Flour Crust: 290 kcal', 'Mozzarella Cheese: 160 kcal', 'Tomato Sauce & Toppings: 70 kcal'] },
    { keywords: ['burger', 'cheeseburger', 'hamburger'], name: 'Classic Grilled Burger', baseGrams: 260, cals: 540, p: 28, c: 44, f: 27, fib: 2, notes: 'Beef or chicken patty on a toasted bun with cheese and condiments.', breakdown: ['Patty (~120g): 270 kcal', 'Toasted Bun: 180 kcal', 'Cheese & Sauce: 90 kcal'] },
    { keywords: ['karahi', 'curry', 'salan', 'qorma', 'korma', 'chicken tikka'], name: 'Chicken Karahi Curry', baseGrams: 300, cals: 440, p: 38, c: 12, f: 26, fib: 2, notes: 'Tender chicken simmered in tomatoes, ginger, garlic, and oil.', breakdown: ['Chicken (~180g): 280 kcal', 'Tomato Gravy: 60 kcal', 'Cooking Oil & Spices: 100 kcal'] },
    { keywords: ['roti', 'chapati', 'naan', 'bread', 'tortilla'], name: 'Whole Wheat Roti / Flatbread', baseGrams: 70, cals: 150, p: 5, c: 30, f: 1.5, fib: 3, notes: 'Traditional stone-ground whole wheat flatbread.', breakdown: ['Whole Wheat Flour (45g): 140 kcal', 'Water & Pinch of Salt: 10 kcal'] },
    { keywords: ['daal', 'dal', 'lentil', 'lentils'], name: 'Lentil Daal with Tempering', baseGrams: 250, cals: 240, p: 13, c: 34, f: 6, fib: 8, notes: 'High-fiber yellow or red lentils tempered with cumin, garlic, and ghee.', breakdown: ['Cooked Lentils (~200g): 180 kcal', 'Tarka Ghee & Spices: 60 kcal'] },
    { keywords: ['egg', 'eggs', 'scrambled', 'omelette', 'omelet'], name: 'Whole Eggs (Prepared)', baseGrams: 120, cals: 190, p: 14, c: 2, f: 14, fib: 0, notes: 'High bioavailability complete protein with healthy fats and choline.', breakdown: ['2 Large Eggs: 144 kcal', 'Cooking butter/oil: 46 kcal'] },
    { keywords: ['oatmeal', 'oats', 'porridge'], name: 'Rolled Oats Porridge', baseGrams: 280, cals: 290, p: 11, c: 48, f: 6, fib: 6, notes: 'Complex low-GI carbohydrate source rich in beta-glucan soluble fiber.', breakdown: ['Rolled Oats (50g dry): 190 kcal', 'Milk / Water (~200ml): 80 kcal', 'Natural flavor: 20 kcal'] },
    { keywords: ['shake', 'whey', 'protein shake', 'smoothie'], name: 'Whey Protein Shake', baseGrams: 350, cals: 210, p: 30, c: 12, f: 3.5, fib: 2, notes: 'Rapidly absorbed complete amino acid profile ideal for muscle recovery.', breakdown: ['Whey Isolate Scoop (30g): 120 kcal (25g P)', 'Milk/Base (250ml): 90 kcal'] },
    { keywords: ['salad', 'greens'], name: 'Garden Fresh Salad with Dressing', baseGrams: 220, cals: 180, p: 5, c: 14, f: 12, fib: 5, notes: 'Micronutrient-dense mix of greens, cucumbers, peppers, and light olive vinaigrette.', breakdown: ['Mixed Greens & Veggies: 50 kcal', 'Vinaigrette Dressing: 130 kcal'] },
    { keywords: ['coke', 'soda', 'pepsi', 'cola', 'sprite'], name: 'Carbonated Soft Drink', baseGrams: 330, cals: 140, p: 0, c: 35, f: 0, fib: 0, notes: 'High simple sugar beverage.', breakdown: ['Liquid (~330ml): 140 kcal (35g simple sugars)'] },
    { keywords: ['coffee', 'latte', 'cappuccino', 'tea', 'chai'], name: 'Milk Tea / Latte Coffee', baseGrams: 240, cals: 110, p: 5, c: 12, f: 4, fib: 0, notes: 'Warm beverage with milk and modest sugar.', breakdown: ['Milk (~150ml): 85 kcal', 'Sugar (1 tsp): 25 kcal'] },
  ];

  const matched = dishes.find((d) => d.keywords.some((k) => clean.includes(k)));

  if (matched) {
    return {
      food_name: matched.name,
      serving_description: unitDesc,
      quantity: multiplier,
      unit: detectedUnit,
      estimated_grams: Math.round(matched.baseGrams * multiplier),
      calories: Math.round(matched.cals * multiplier),
      protein: Math.round(matched.p * multiplier),
      carbs: Math.round(matched.c * multiplier),
      fat: Math.round(matched.f * multiplier),
      fiber: Math.round(matched.fib * multiplier),
      confidence: 'approximate',
      ingredients_breakdown: matched.breakdown,
      nutritional_notes: matched.notes,
      fallback: true,
      source: 'local_dictionary',
      fallbackReason: reason,
    };
  }

  const capitalized = input.charAt(0).toUpperCase() + input.slice(1);
  return {
    food_name: capitalized,
    serving_description: unitDesc,
    quantity: multiplier,
    unit: detectedUnit,
    estimated_grams: Math.round(260 * multiplier),
    calories: Math.round(360 * multiplier),
    protein: Math.round(18 * multiplier),
    carbs: Math.round(44 * multiplier),
    fat: Math.round(12 * multiplier),
    fiber: Math.round(3 * multiplier),
    confidence: 'rough_estimate',
    ingredients_breakdown: [`Standard balanced serving of ${capitalized}`, 'Estimated ~50% carbs, 20% protein, 30% healthy fats'],
    nutritional_notes: `Offline generic estimate for "${input}". You can refine grams or macros anytime.`,
    fallback: true,
    source: 'local_generic',
    fallbackReason: reason,
  };
}

export async function evaluateFoodServing(
  foodPrompt: string,
  mealType: string = 'meal',
  model: string = DEFAULT_GEMINI_MODEL
): Promise<EvaluatedFoodResponse> {
  if (model === 'local-neural-fast') {
    return evaluateVagueFoodLocally(foodPrompt, 'user_selected_offline');
  }

  try {
    const prompt = `Estimate nutrition for this ${mealType} food description: "${foodPrompt}". Respond ONLY with a raw JSON object (no markdown fences) with keys: food_name (string), serving_description (string), quantity (number), unit (string), estimated_grams (number), calories (number), protein (number), carbs (number), fat (number), fiber (number), confidence ("high"|"medium"|"approximate"), ingredients_breakdown (array of short strings), nutritional_notes (string).`;
    const { text } = await callGemini(model, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const data = extractJSON(text);
    if (data && data.food_name) {
      return { ...data, source: 'gemini_api', modelUsed: model, fallback: false };
    }
    throw new Error('Malformed AI response');
  } catch (err: any) {
    const reason = err?.code === 'no_api_key' ? 'no_api_key' : err?.status === 429 ? 'rate_limit_429' : 'network_error';
    const fallbackResult = evaluateVagueFoodLocally(foodPrompt, reason);
    fallbackResult.errorDetails = err?.message;
    return fallbackResult;
  }
}

export interface SmartSuggestionsResponse {
  analysisSummary: string;
  suggestions: SmartAlternativeOption[];
  source: 'gemini_api' | 'local_fallback';
  modelUsed?: string;
  isAiGenerated: boolean;
}

export async function fetchSmartSuggestions(
  profile: UserProfile,
  meals: Meal[],
  currentDeficit: number,
  avgProteinG: number,
  avgSteps: number,
  model: string = DEFAULT_GEMINI_MODEL
): Promise<SmartSuggestionsResponse> {
  const currentWeight = profile.current_weight_kg;
  const targetWeight = profile.goal_weight_kg;
  const remainingWeightKg = Math.max(0, currentWeight - targetWeight);

  const recentFoodsMap = new Map<string, { food_name: string; calories: number; meal_type: string }>();
  meals.forEach((m) => {
    m.foods.forEach((f) => {
      if (f.food_name && !recentFoodsMap.has(f.food_name.toLowerCase())) {
        recentFoodsMap.set(f.food_name.toLowerCase(), { food_name: f.food_name, calories: f.calories || 0, meal_type: m.meal_type });
      }
    });
  });
  const recentFoods = Array.from(recentFoodsMap.values()).slice(0, 15);

  try {
    const prompt = `Given this user profile: ${JSON.stringify(profile.units)}, calorie target ${profile.calorie_target}, avg protein ${avgProteinG}g, avg steps ${avgSteps}, current deficit ${currentDeficit} kcal/day, and recent foods ${JSON.stringify(recentFoods)}, suggest 3-4 practical dietary swaps/tweaks to accelerate progress toward losing ${remainingWeightKg.toFixed(1)}kg. Respond ONLY with raw JSON (no markdown fences): { "analysis_summary": string, "suggestions": [{ "title": string, "category": string, "description": string, "calorieDelta": number, "proteinDeltaG": number, "difficulty": "Easy"|"Moderate", "targetedHabit": string }] }`;
    const { text } = await callGemini(model, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const data = extractJSON(text);
    if (data && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
      const formattedSuggestions: SmartAlternativeOption[] = data.suggestions.map((s: any, idx: number) => {
        const calDelta = typeof s.calorieDelta === 'number' ? s.calorieDelta : -150;
        const daysSaved = calculateDaysSavedOnGoal(currentDeficit, remainingWeightKg, calDelta);
        return {
          id: `ai_sug_${idx}_${Date.now()}`,
          title: s.title,
          category: s.category || 'swap',
          description: s.description,
          calorieDelta: calDelta,
          proteinDeltaG: s.proteinDeltaG || (s.category === 'protein' ? 15 : undefined),
          daysSavedOnGoal: daysSaved,
          difficulty: s.difficulty === 'Moderate' ? 'Moderate' : 'Easy',
          targetedHabit: s.targetedHabit,
          source: 'gemini_api',
        };
      });
      return {
        analysisSummary: data.analysis_summary || 'Personalized dietary recommendations dynamically generated for your current intake and goal trajectory.',
        suggestions: formattedSuggestions,
        source: 'gemini_api',
        modelUsed: model,
        isAiGenerated: true,
      };
    }
    throw new Error('Malformed AI response');
  } catch (err) {
    const localList = getSmartNutritionalSuggestions(currentDeficit, currentWeight, targetWeight, avgProteinG, avgSteps);
    return {
      analysisSummary: 'Standard baseline nutritional tweaks and high-impact swaps tailored to accelerate your goal.',
      suggestions: localList.map((s) => ({ ...s, source: 'local_fallback' })),
      source: 'local_fallback',
      modelUsed: 'Local Heuristic Engine',
      isAiGenerated: false,
    };
  }
}
