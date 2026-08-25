export type Gender = 'male' | 'female' | 'other' | 'unspecified';

export type ActivityBaseline = 'sedentary' | 'light' | 'moderate' | 'very' | 'very_active' | 'extra_active';
export type ActivityLevel = ActivityBaseline;

export type GoalType = 'lose' | 'maintain' | 'gain' | 'custom';

export type WeightUnit = 'kg' | 'lb' | 'st_lb' | 'st';
export type HeightUnit = 'cm' | 'ft_in';
export type FoodUnit =
  | 'plate'
  | 'half plate'
  | 'quarter plate'
  | 'bowl'
  | 'small bowl'
  | 'big bowl'
  | 'cup'
  | 'slice'
  | 'piece'
  | 'fist'
  | 'palm'
  | 'serving'
  | 'portion'
  | 'tbsp'
  | 'tsp'
  | 'g'
  | 'oz'
  | 'kg'
  | 'lb'
  | 'ml'
  | 'can'
  | 'bottle'
  | string;
export type LiquidUnit = 'ml' | 'L' | 'fl_oz' | 'cups';
export type EnergyUnit = 'kcal' | 'kJ';

export interface UserUnits {
  weight: WeightUnit;
  height: HeightUnit;
  food: FoodUnit;
  liquid: LiquidUnit;
  energy: EnergyUnit;
}

export interface UserProfile {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  height_cm: number; // Stored in cm
  current_weight_kg: number; // Stored in kg
  goal_weight_kg: number; // Stored in kg
  target_weight_kg?: number; // Alias
  bmi?: number; // Calculated Body Mass Index
  bmi_category?: string; // e.g. Normal weight, Overweight
  activity_baseline: ActivityBaseline;
  activity_level?: ActivityBaseline; // Alias
  units: UserUnits;
  current_goal: GoalType;
  goal_type?: GoalType; // Alias
  target_rate_kg_week: number; // e.g. -0.5 kg/week
  target_date?: string; // YYYY-MM-DD
  calorie_target: number; // kcal
  target_calories_override?: number; // Alias
  protein_target_g: number;
  carb_target_g: number;
  fat_target_g: number;
  macro_targets?: {
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  is_custom_target: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink' | 'custom';

export type EntrySource = 'logged' | 'pdf_import' | 'quick_add' | 'baseline_estimate';

export interface FoodEntry {
  id: string;
  meal_id?: string;
  food_name: string;
  quantity: number;
  serving_size: number;
  unit: FoodUnit;
  calories: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  fiber?: number; // g
  sugar?: number; // g
  sodium?: number; // mg
  notes?: string;
  source: EntrySource;
  created_at: string;
}

export interface Meal {
  id: string;
  date: string; // YYYY-MM-DD
  meal_type: MealType;
  name?: string;
  timestamp: string; // ISO
  foods: FoodEntry[];
}

export interface WeightEntry {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO
  weight_kg: number;
  bmi?: number;
  body_fat_pct?: number;
  notes?: string;
  source: EntrySource;
}

export type ActivityType = 'walking' | 'running' | 'cycling' | 'gym' | 'swimming' | 'sports' | 'custom';

export interface ActivityEntry {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO
  type: ActivityType;
  name: string;
  duration_minutes?: number;
  steps: number;
  calories_burned: number;
  notes?: string;
  source: EntrySource;
}

export type FastingReason = 'intermittent' | 'religious' | 'medical' | 'personal' | 'other';

export interface FastingEntry {
  id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // ISO
  end_time: string; // ISO
  duration_hours: number;
  reason?: FastingReason;
  fast_type?: string;
  notes?: string;
  source: EntrySource;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  notes?: string;
  water_ml: number;
  ai_summary?: string;
  created_at: string;
  updated_at: string;
}

export interface SavedFood {
  id: string;
  name: string;
  serving_size: number;
  unit: FoodUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  favorite: boolean;
  frequency: number;
  last_used_at: string;
  sort_order: number;
}

export interface SavedMeal {
  id: string;
  name: string;
  meal_type: MealType;
  items: Omit<FoodEntry, 'id' | 'meal_id'>[];
  favorite: boolean;
  frequency: number;
  last_used_at: string;
  sort_order: number;
}

export interface HypotheticalMeal {
  id: string;
  name: string;
  meal_type: MealType;
  items: FoodEntry[];
  created_at: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  evidence?: string;
  suggestion?: string;
  timestamp: string;
  source?: 'gemini_api' | 'local_fallback' | 'local_heuristic';
  model_used?: string;
  fallback_reason?: string;
  error_details?: string;
  context_snapshot?: any;
  tool_invocations?: {
    tool_name: string;
    input: any;
    output: any;
  }[];
}

export interface NotificationSettings {
  enabled: boolean;
  daily_reminder_time: string; // "20:00"
  days_of_week: number[]; // 0 = Sun, 1 = Mon ... 6 = Sat
  reminder_type: 'incomplete_log' | 'water' | 'weigh_in';
  last_notified_date?: string;
}

export interface ParsedFoodItem {
  id?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity?: number;
  unit?: string;
  serving_size?: number;
}

export interface ParsedMealGroup {
  meal_type: MealType; // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  name: string;
  foods: ParsedFoodItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ImportParsedRecord {
  id: string;
  detected_date: string; // YYYY-MM-DD
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  weight_kg?: number;
  steps?: number;
  activity_notes?: string;
  activity_calories?: number;
  activity_type?: ActivityType;
  activity_duration?: number;
  fasting_notes?: string;
  fasting_hours?: number;
  meals_breakdown?: ParsedMealGroup[];
  meal_names?: string[];
  confidence: 'high' | 'needs_review' | 'uncertain';
  status: 'valid' | 'duplicate_detected' | 'ignored';
  raw_text: string;
}

export interface ImportPreviewJob {
  id: string;
  filename: string;
  created_at: string;
  records: ImportParsedRecord[];
  total_records: number;
  duplicates_count: number;
}

export interface DiagnosticAlert {
  id?: string;
  type: string;
  severity: 'info' | 'warning' | 'caution';
  title: string;
  message: string;
  recommendation?: string;
}

export type TabType = 'today' | 'history' | 'progress' | 'ai' | 'profile';

export type TimeRangeFilter = '1W' | '2W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
