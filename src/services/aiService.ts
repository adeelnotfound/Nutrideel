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
import { getProviderDef, modelSupportsVision } from './aiProviders';
import { estimateFoodOffline } from './offlineFoodEngine';

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

// ----------------- Direct on-device multi-provider AI calls (no backend server) ----------------- //
// There's no server to hide an API key behind, so keys are entered by the user in
// Profile > AI Access, stored encrypted on-device, and used to call the chosen
// provider's REST API directly from the device. Every call degrades gracefully to
// the local heuristic engine above if there's no key, no network, or an API error.
// The offline engine is picked the same way as any other provider (see aiProviders.ts).

export interface AICallOptions {
  systemPrompt?: string;
  userText: string;
  imageBase64?: string;
  imageMimeType?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

async function callGeminiFormat(baseUrl: string, model: string, apiKey: string, opts: AICallOptions) {
  const historyContents = (opts.history || []).map((h) => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }],
  }));
  const userParts: any[] = [{ text: opts.userText }];
  if (opts.imageBase64) {
    userParts.push({ inline_data: { mime_type: opts.imageMimeType || 'image/jpeg', data: opts.imageBase64 } });
  }
  const body: any = {
    contents: [...historyContents, { role: 'user', parts: userParts }],
    // Gemini 3.x models ('gemini-3.x-...') think by default before answering, and
    // thinking tokens are deducted from the SAME maxOutputTokens budget as the final
    // answer. With no explicit budget, a thinking-heavy model (3.7 Flash, 3.1 Pro
    // especially) can spend its entire output budget reasoning and return an EMPTY
    // text response with finishReason: MAX_TOKENS — which looks identical to a real
    // failure and was previously read as "empty response" -> silent offline fallback.
    // Capping thinking to 'low' and giving a generous explicit output budget fixes
    // this for the models that were actually failing, without touching non-thinking
    // (2.x/legacy) models which simply ignore an unrecognized generationConfig field.
    generationConfig: {
      maxOutputTokens: 4096,
      ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
    },
  };
  if (opts.systemPrompt) {
    // Gemini's `contents`/`systemInstruction` Content objects only accept role
    // 'user' or 'model' — there is no 'system' role in this API. Sending role:'system'
    // here doesn't match the documented request shape; some models silently ignore
    // unrecognized fields, but this is exactly the kind of extra/invalid field that a
    // stricter model can reject outright (or intermittently misbehave on) while an
    // older, more lenient model quietly tolerates it — which would explain "some
    // Gemini models fail, other providers are fine, other Gemini models are fine."
    body.systemInstruction = { parts: [{ text: opts.systemPrompt }] };
  }
  const res = await fetch(`${baseUrl}/${model}:generateContent?key=${apiKey}`, {
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
  if (!text) {
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      // Thinking consumed the whole output budget before any answer text was produced.
      // Surfaced distinctly so this doesn't read as a generic/unexplained empty response.
      throw new Error('Response cut off by thinking budget (MAX_TOKENS) — try again or use a lower thinking level');
    }
  }
  return { text };
}

async function callOpenAIFormat(baseUrl: string, model: string, apiKey: string, opts: AICallOptions, canSendImage: boolean) {
  const messages: any[] = [];
  if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt });
  (opts.history || []).forEach((h) => messages.push({ role: h.role, content: h.content }));

  if (opts.imageBase64 && canSendImage) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: opts.userText },
        { type: 'image_url', image_url: { url: `data:${opts.imageMimeType || 'image/jpeg'};base64,${opts.imageBase64}` } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: opts.userText });
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const text = data?.choices?.[0]?.message?.content || '';
  return { text };
}

async function callAnthropicFormat(baseUrl: string, model: string, apiKey: string, opts: AICallOptions, canSendImage: boolean) {
  const messages: any[] = (opts.history || []).map((h) => ({ role: h.role, content: h.content }));

  if (opts.imageBase64 && canSendImage) {
    messages.push({
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: opts.imageMimeType || 'image/jpeg', data: opts.imageBase64 } },
        { type: 'text', text: opts.userText },
      ],
    });
  } else {
    messages.push({ role: 'user', content: opts.userText });
  }

  const res = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 1536, system: opts.systemPrompt, messages }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const text = (data?.content || []).map((b: any) => b.text || '').join('');
  return { text };
}

// Central entry point every AI-powered feature routes through. Resolves the user's
// currently selected provider + model + key from storage, dispatches to the matching
// request shape, and drops images silently for providers/models that don't support vision.
async function callAIProvider(opts: AICallOptions, providerIdOverride?: string): Promise<{ text: string }> {
  const providerId = providerIdOverride || storage.getAIProvider();
  if (providerId === 'offline') {
    throw { code: 'no_api_key', message: 'Offline engine selected' };
  }

  const def = getProviderDef(providerId);
  const apiKey = storage.getAIKeyFor(providerId);
  const baseUrl = providerId === 'custom' ? storage.getCustomBaseUrl() : def.baseUrl;
  const model = storage.getSelectedModel(providerId);

  if (def.requiresKey && !apiKey) {
    throw { code: 'no_api_key', message: `No ${def.label} API key configured` };
  }
  if (!baseUrl) {
    throw { code: 'no_api_key', message: `No base URL configured for ${def.label}` };
  }
  if (!model) {
    throw { code: 'no_api_key', message: `No model selected for ${def.label}` };
  }

  const canSendImage = modelSupportsVision(providerId, model);

  if (def.apiFormat === 'gemini') {
    return callGeminiFormat(baseUrl, model, apiKey, opts);
  }
  if (def.apiFormat === 'anthropic') {
    return callAnthropicFormat(baseUrl, model, apiKey, opts, canSendImage);
  }
  return callOpenAIFormat(baseUrl, model, apiKey, opts, canSendImage);
}

// Wraps callAIProvider with a single automatic retry against the user's configured fallback
// provider (Profile > AI Coach > Fallback provider) if the primary provider fails for any
// reason (invalid/expired key, rate limit, network error, etc). If no fallback is configured,
// or the fallback also fails, the *original* primary error is what gets thrown — so existing
// callers' error-handling (which inspects err.code/err.status to build a fallbackReason) keeps
// working exactly as before, whether or not a fallback provider was tried in between.
async function callAIProviderWithFallback(opts: AICallOptions): Promise<{ text: string } & { providerUsed?: string }> {
  const primaryId = storage.getAIProvider();
  try {
    const result = await callAIProvider(opts, primaryId);
    return { ...result, providerUsed: primaryId };
  } catch (primaryErr: any) {
    const fallbackId = storage.getAIFallbackProvider();
    const fallbackHasKey = fallbackId && fallbackId !== 'offline' && fallbackId !== primaryId && (storage.getAIKeyFor(fallbackId) || !getProviderDef(fallbackId).requiresKey);
    if (!fallbackHasKey) {
      throw primaryErr;
    }
    try {
      const result = await callAIProvider(opts, fallbackId);
      return { ...result, providerUsed: fallbackId };
    } catch {
      // Both providers failed — surface the *primary's* error, since that's the one the
      // user actually configured as their main choice and is most relevant to fix.
      throw primaryErr;
    }
  }
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
  source: 'ai_api' | 'local_fallback' | 'local_heuristic';
  model_used?: string;
  fallback_reason?: string;
  error_details?: string;
}

export async function askAIWithMetadata(
  prompt: string,
  contextSnapshot: AIContextSnapshot,
  conversationHistory: AIMessage[] = []
): Promise<AIResponseWithMetadata> {
  const providerId = storage.getAIProvider();
  if (providerId === 'offline') {
    return {
      content: generateDeterministicAIAnswer(prompt, contextSnapshot),
      source: 'local_heuristic',
      model_used: 'Offline Heuristic Engine',
    };
  }

  const model = storage.getSelectedModel(providerId);
  try {
    const systemPreamble = `You are Nutrideel's AI Nutrition & Metabolic Coach. Answer concisely and practically using the JSON context below. Do not repeat the raw JSON back to the user.\n\nCONTEXT:\n${JSON.stringify(contextSnapshot)}`;
    const history = conversationHistory.slice(-6).map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content,
    }));

    const { text } = await callAIProviderWithFallback({ systemPrompt: systemPreamble, userText: prompt, history });

    if (text) {
      return { content: text, source: 'ai_api', model_used: model };
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
  conversationHistory: AIMessage[] = []
): Promise<string> {
  const res = await askAIWithMetadata(prompt, contextSnapshot, conversationHistory);
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
    if (storage.getAIProvider() === 'offline') throw { code: 'no_api_key' };
    const { text } = await callAIProviderWithFallback({ userText: prompt });
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
  source?: 'ai_api' | 'local_dictionary' | 'local_generic' | 'local_fallback' | 'barcode_off';
  fallbackReason?: string;
  modelUsed?: string;
  errorDetails?: string;
}

/**
 * Turns a fallback reason + raw error details into a message the user can actually act on,
 * instead of the generic "connect an AI provider" text that used to show even when a
 * provider *was* connected and the call genuinely failed (masking real errors — e.g. an
 * invalid key, a rate limit, or a network issue — as if no provider had been set up at all).
 */
export function describeFallbackReason(reason?: string, errorDetails?: string): string {
  switch (reason) {
    case 'user_selected_offline':
      return 'Offline estimate — connect an AI provider in Profile for AI-powered estimates.';
    case 'no_api_key':
      return 'Offline estimate — no valid API key found for your selected provider. Check your key in Profile.';
    case 'rate_limit_429':
      return 'Offline estimate — your AI provider is rate-limiting requests right now. Try again shortly.';
    case 'network_error':
      return `Offline estimate — the AI request failed${errorDetails ? `: ${errorDetails}` : ' (network or server error)'}.`;
    default:
      return errorDetails ? `Offline estimate — ${errorDetails}` : 'Offline estimate — the AI request failed unexpectedly.';
  }
}

// Common dish lookup table for offline nutrition estimates (used when there's no API key or no signal)
export function evaluateVagueFoodLocally(input: string, reason: string = 'offline_dictionary'): EvaluatedFoodResponse {
  const match = estimateFoodOffline(input);
  return {
    ...match,
    fallback: true,
    source: match.confidence === 'rough_estimate' ? 'local_generic' : 'local_dictionary',
    fallbackReason: reason,
  };
}

export async function evaluateFoodServing(foodPrompt: string, mealType: string = 'meal'): Promise<EvaluatedFoodResponse> {
  const providerId = storage.getAIProvider();
  if (providerId === 'offline') {
    return evaluateVagueFoodLocally(foodPrompt, 'user_selected_offline');
  }

  const model = storage.getSelectedModel(providerId);
  try {
    const prompt = `Estimate nutrition for this ${mealType} food description: "${foodPrompt}". Respond ONLY with a raw JSON object (no markdown fences) with keys: food_name (string), serving_description (string), quantity (number), unit (string), estimated_grams (number), calories (number), protein (number), carbs (number), fat (number), fiber (number), confidence ("high"|"medium"|"approximate"), ingredients_breakdown (array of short strings), nutritional_notes (string).`;
    const { text } = await callAIProviderWithFallback({ userText: prompt });
    const data = extractJSON(text);
    if (data && data.food_name) {
      return { ...data, source: 'ai_api', modelUsed: model, fallback: false };
    }
    throw new Error('Malformed AI response');
  } catch (err: any) {
    const reason = err?.code === 'no_api_key' ? 'no_api_key' : err?.status === 429 ? 'rate_limit_429' : 'network_error';
    const fallbackResult = evaluateVagueFoodLocally(foodPrompt, reason);
    fallbackResult.errorDetails = err?.message;
    return fallbackResult;
  }
}

export async function evaluateFoodPhoto(
  base64Image: string,
  mimeType: string,
  mealType: string = 'meal',
  note: string = ''
): Promise<EvaluatedFoodResponse> {
  const providerId = storage.getAIProvider();
  if (providerId === 'offline') {
    return evaluateVagueFoodLocally(note || 'photo of food', 'user_selected_offline');
  }

  const model = storage.getSelectedModel(providerId);

  // Providers/models without vision support can't see the photo — if the user added
  // a text note, fall back to a text-only estimate from that note; otherwise there's
  // nothing usable to send, so go straight to the offline dictionary.
  if (!modelSupportsVision(providerId, model)) {
    if (!note.trim()) {
      return evaluateVagueFoodLocally('photo of food', 'provider_no_vision_support');
    }
    return evaluateFoodServing(note.trim(), mealType);
  }

  try {
    const instruction = `Look at this photo of food being logged as a ${mealType}.${note ? ` The user added this note: "${note}".` : ''} Identify what's in the photo and estimate its nutrition as eaten (account for visible portion size). Respond ONLY with a raw JSON object (no markdown fences) with keys: food_name (string), serving_description (string), quantity (number), unit (string), estimated_grams (number), calories (number), protein (number), carbs (number), fat (number), fiber (number), confidence ("high"|"medium"|"approximate"), ingredients_breakdown (array of short strings), nutritional_notes (string). If the photo contains a packaged food label, read the label's per-serving values instead of guessing.`;
    const { text } = await callAIProviderWithFallback({ userText: instruction, imageBase64: base64Image, imageMimeType: mimeType });
    const data = extractJSON(text);
    if (data && data.food_name) {
      return { ...data, source: 'ai_api', modelUsed: model, fallback: false };
    }
    throw new Error('Malformed AI response');
  } catch (err: any) {
    const reason = err?.code === 'no_api_key' ? 'no_api_key' : err?.status === 429 ? 'rate_limit_429' : 'network_error';
    const fallbackResult = evaluateVagueFoodLocally(note || 'photo of food', reason);
    fallbackResult.errorDetails = err?.message;
    return fallbackResult;
  }
}

export interface SmartSuggestionsResponse {
  analysisSummary: string;
  suggestions: SmartAlternativeOption[];
  source: 'ai_api' | 'local_fallback';
  modelUsed?: string;
  isAiGenerated: boolean;
}

export async function fetchSmartSuggestions(
  profile: UserProfile,
  meals: Meal[],
  currentDeficit: number,
  avgProteinG: number,
  avgSteps: number
): Promise<SmartSuggestionsResponse> {
  const currentWeight = profile.current_weight_kg;
  const targetWeight = profile.goal_weight_kg;
  const remainingWeightKg = Math.max(0, currentWeight - targetWeight);
  const providerId = storage.getAIProvider();
  const model = storage.getSelectedModel(providerId);

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
    if (providerId === 'offline') throw { code: 'no_api_key' };
    const prompt = `Given this user profile: ${JSON.stringify(profile.units)}, calorie target ${profile.calorie_target}, avg protein ${avgProteinG}g, avg steps ${avgSteps}, current deficit ${currentDeficit} kcal/day, and recent foods ${JSON.stringify(recentFoods)}, suggest 3-4 practical dietary swaps/tweaks to accelerate progress toward losing ${remainingWeightKg.toFixed(1)}kg. Respond ONLY with raw JSON (no markdown fences): { "analysis_summary": string, "suggestions": [{ "title": string, "category": string, "description": string, "calorieDelta": number, "proteinDeltaG": number, "difficulty": "Easy"|"Moderate", "targetedHabit": string }] }`;
    const { text } = await callAIProviderWithFallback({ userText: prompt });
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
          source: 'ai_api',
        };
      });
      return {
        analysisSummary: data.analysis_summary || 'Personalized dietary recommendations dynamically generated for your current intake and goal trajectory.',
        suggestions: formattedSuggestions,
        source: 'ai_api',
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
