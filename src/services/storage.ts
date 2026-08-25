import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DailyLog,
  FoodEntry,
  Meal,
  UserProfile,
  WeightEntry,
  ActivityEntry,
  FastingEntry,
  SavedFood,
  SavedMeal,
  AIMessage,
  NotificationSettings,
} from '../types';

const STORAGE_KEYS = {
  PROFILE: 'calorie_app_profile',
  DAILY_LOGS: 'calorie_app_daily_logs',
  MEALS: 'calorie_app_meals',
  WEIGHTS: 'calorie_app_weights',
  ACTIVITIES: 'calorie_app_activities',
  FASTING: 'calorie_app_fasting',
  SAVED_FOODS: 'calorie_app_saved_foods',
  SAVED_MEALS: 'calorie_app_saved_meals',
  AI_CHAT: 'calorie_app_ai_chat',
  NOTIFICATIONS: 'calorie_app_notifications',
  THEME: 'calorie_app_theme',
  GEMINI_KEY: 'calorie_app_gemini_key',
  GEMINI_MODEL: 'calorie_app_gemini_model',
};

// ----------------- In-memory synchronous cache, hydrated from AsyncStorage at boot ----------------- //
// Native storage (AsyncStorage) is async-only, but the rest of the app (ported from the web
// version) expects synchronous get/save calls. We keep a memory cache as the source of truth
// for reads, and persist every write to AsyncStorage in the background.

const cache: Record<string, any> = {};
let hydrated = false;

type StorageListener = () => void;
const listeners: Set<StorageListener> = new Set();

export function subscribeToStorage(listener: StorageListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach((l) => {
    try {
      l();
    } catch (e) {
      console.error('Storage listener error:', e);
    }
  });
}

export async function hydrateStorage(): Promise<void> {
  if (hydrated) return;
  try {
    const keys = Object.values(STORAGE_KEYS);
    const pairs = await AsyncStorage.multiGet(keys);
    pairs.forEach(([key, value]) => {
      if (value != null) {
        try {
          cache[key] = JSON.parse(value);
        } catch {
          cache[key] = value;
        }
      }
    });
  } catch (e) {
    console.warn('Storage hydration failed:', e);
  }
  hydrated = true;
}

function readCache<T>(key: string, fallback: T): T {
  return key in cache ? cache[key] : fallback;
}

function writeCache(key: string, value: any) {
  cache[key] = value;
  AsyncStorage.setItem(key, JSON.stringify(value)).catch((e) =>
    console.warn(`Failed to persist ${key}:`, e)
  );
  notifyListeners();
}

const genId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ----------------- Core Storage Methods ----------------- //

export const storage = {
  getProfile(): UserProfile | null {
    const parsed = readCache<UserProfile | null>(STORAGE_KEYS.PROFILE, null);
    if (parsed && (parsed.id === 'user_default' || !parsed.onboarding_completed)) {
      return null;
    }
    return parsed;
  },

  saveProfile(profile: UserProfile): void {
    profile.updated_at = new Date().toISOString();
    writeCache(STORAGE_KEYS.PROFILE, profile);
  },

  getDailyLogs(): Record<string, DailyLog> {
    return readCache(STORAGE_KEYS.DAILY_LOGS, {});
  },

  saveDailyLogs(logs: Record<string, DailyLog>): void {
    writeCache(STORAGE_KEYS.DAILY_LOGS, logs);
  },

  getMeals(): Meal[] {
    return readCache<Meal[]>(STORAGE_KEYS.MEALS, []);
  },

  saveMeals(meals: Meal[]): void {
    writeCache(STORAGE_KEYS.MEALS, meals);
  },

  addMeal(meal: Omit<Meal, 'id'> & { id?: string }): Meal {
    const meals = this.getMeals();
    const newMeal: Meal = { ...meal, id: meal.id || genId('m') };
    meals.push(newMeal);
    this.saveMeals(meals);
    newMeal.foods.forEach((f) => this.recordFoodUsage(f));
    return newMeal;
  },

  updateMeal(updatedMeal: Meal): void {
    const meals = this.getMeals();
    const index = meals.findIndex((m) => m.id === updatedMeal.id);
    if (index >= 0) {
      meals[index] = updatedMeal;
      this.saveMeals(meals);
    }
  },

  deleteMeal(mealId: string): void {
    this.saveMeals(this.getMeals().filter((m) => m.id !== mealId));
  },

  getWeights(): WeightEntry[] {
    return readCache<WeightEntry[]>(STORAGE_KEYS.WEIGHTS, []);
  },

  saveWeights(weights: WeightEntry[]): void {
    writeCache(STORAGE_KEYS.WEIGHTS, weights);
  },

  addWeight(entry: Omit<WeightEntry, 'id'>): WeightEntry {
    const weights = this.getWeights();
    const newEntry: WeightEntry = { ...entry, id: genId('w') };
    weights.push(newEntry);
    this.saveWeights(weights);
    const profile = this.getProfile();
    if (profile) {
      profile.current_weight_kg = entry.weight_kg;
      this.saveProfile(profile);
    }
    return newEntry;
  },

  updateWeight(updated: WeightEntry): void {
    const weights = this.getWeights();
    const idx = weights.findIndex((w) => w.id === updated.id);
    if (idx >= 0) weights[idx] = updated;
    else weights.push(updated);
    this.saveWeights(weights);
    const profile = this.getProfile();
    if (profile) {
      profile.current_weight_kg = updated.weight_kg;
      this.saveProfile(profile);
    }
  },

  saveOrUpdateWeightForDate(entry: Omit<WeightEntry, 'id'>, existingId?: string): WeightEntry {
    const weights = this.getWeights();
    let targetIdx = existingId ? weights.findIndex((w) => w.id === existingId) : -1;
    if (targetIdx === -1) targetIdx = weights.findIndex((w) => w.date === entry.date);

    if (targetIdx >= 0) {
      const updated: WeightEntry = { ...entry, id: weights[targetIdx].id };
      weights[targetIdx] = updated;
      this.saveWeights(weights);
      const profile = this.getProfile();
      if (profile) {
        profile.current_weight_kg = updated.weight_kg;
        this.saveProfile(profile);
      }
      return updated;
    }
    return this.addWeight(entry);
  },

  deleteWeight(weightId: string): void {
    this.saveWeights(this.getWeights().filter((w) => w.id !== weightId));
  },

  getActivities(): ActivityEntry[] {
    return readCache<ActivityEntry[]>(STORAGE_KEYS.ACTIVITIES, []);
  },

  saveActivities(acts: ActivityEntry[]): void {
    writeCache(STORAGE_KEYS.ACTIVITIES, acts);
  },

  addActivity(act: Omit<ActivityEntry, 'id'>): ActivityEntry {
    const acts = this.getActivities();
    const newAct: ActivityEntry = { ...act, id: genId('act') };
    acts.push(newAct);
    this.saveActivities(acts);
    return newAct;
  },

  updateActivity(updated: ActivityEntry): void {
    const acts = this.getActivities();
    const idx = acts.findIndex((a) => a.id === updated.id);
    if (idx >= 0) acts[idx] = updated;
    else acts.push(updated);
    this.saveActivities(acts);
  },

  saveOrUpdateActivityForDate(entry: Omit<ActivityEntry, 'id'>, existingId?: string): ActivityEntry {
    let acts = this.getActivities();
    let targetIdx = existingId ? acts.findIndex((a) => a.id === existingId) : -1;
    if (targetIdx === -1) targetIdx = acts.findIndex((a) => a.date === entry.date);

    if (targetIdx >= 0) {
      const targetId = acts[targetIdx].id;
      acts = acts.filter((a) => a.date !== entry.date || a.id === targetId);
      const updated: ActivityEntry = { ...entry, id: targetId };
      const foundIdx = acts.findIndex((a) => a.id === targetId);
      if (foundIdx >= 0) acts[foundIdx] = updated;
      else acts.push(updated);
      this.saveActivities(acts);
      return updated;
    }
    return this.addActivity(entry);
  },

  deleteActivity(activityId: string): void {
    this.saveActivities(this.getActivities().filter((a) => a.id !== activityId));
  },

  deleteActivitiesForDate(date: string): void {
    this.saveActivities(this.getActivities().filter((a) => a.date !== date));
  },

  getFasting(): FastingEntry[] {
    return readCache<FastingEntry[]>(STORAGE_KEYS.FASTING, []);
  },

  saveFasting(fasting: FastingEntry[]): void {
    writeCache(STORAGE_KEYS.FASTING, fasting);
  },

  addFasting(entry: Omit<FastingEntry, 'id'>): FastingEntry {
    const fasting = this.getFasting();
    const newEntry: FastingEntry = { ...entry, id: genId('fast') };
    fasting.push(newEntry);
    this.saveFasting(fasting);
    return newEntry;
  },

  updateFasting(updated: FastingEntry): void {
    const fasts = this.getFasting();
    const idx = fasts.findIndex((f) => f.id === updated.id);
    if (idx >= 0) fasts[idx] = updated;
    else fasts.push(updated);
    this.saveFasting(fasts);
  },

  saveOrUpdateFastingForDate(entry: Omit<FastingEntry, 'id'>, existingId?: string): FastingEntry {
    const fasts = this.getFasting();
    let targetIdx = existingId ? fasts.findIndex((f) => f.id === existingId) : -1;
    if (targetIdx === -1) targetIdx = fasts.findIndex((f) => f.date === entry.date);

    if (targetIdx >= 0) {
      const updated: FastingEntry = { ...entry, id: fasts[targetIdx].id };
      fasts[targetIdx] = updated;
      this.saveFasting(fasts);
      return updated;
    }
    return this.addFasting(entry);
  },

  deleteFasting(fastingId: string): void {
    this.saveFasting(this.getFasting().filter((f) => f.id !== fastingId));
  },

  deleteFastingForDate(date: string): void {
    this.saveFasting(this.getFasting().filter((f) => f.date !== date));
  },

  getSavedFoods(): SavedFood[] {
    return readCache<SavedFood[]>(STORAGE_KEYS.SAVED_FOODS, []);
  },

  saveSavedFoods(foods: SavedFood[]): void {
    writeCache(STORAGE_KEYS.SAVED_FOODS, foods);
  },

  addOrUpdateSavedFood(food: SavedFood): void {
    const foods = this.getSavedFoods();
    const idx = foods.findIndex((f) => f.id === food.id || f.name.toLowerCase() === food.name.toLowerCase());
    if (idx >= 0) foods[idx] = { ...foods[idx], ...food };
    else foods.push(food);
    this.saveSavedFoods(foods);
  },

  toggleSavedFoodFavorite(foodId: string): void {
    const foods = this.getSavedFoods();
    const idx = foods.findIndex((f) => f.id === foodId);
    if (idx >= 0) {
      foods[idx] = { ...foods[idx], favorite: !foods[idx].favorite };
      this.saveSavedFoods(foods);
    }
  },

  recordFoodUsage(entry: FoodEntry): void {
    const foods = this.getSavedFoods();
    const found = foods.find((f) => f.name.toLowerCase() === entry.food_name.toLowerCase());
    if (found) {
      found.frequency += 1;
      found.last_used_at = new Date().toISOString();
      this.saveSavedFoods(foods);
    } else {
      const newFood: SavedFood = {
        id: genId('sf'),
        name: entry.food_name,
        serving_size: entry.serving_size || entry.quantity,
        unit: entry.unit,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        fiber: entry.fiber,
        sugar: entry.sugar,
        sodium: entry.sodium,
        favorite: false,
        frequency: 1,
        last_used_at: new Date().toISOString(),
        sort_order: foods.length + 1,
      };
      foods.push(newFood);
      this.saveSavedFoods(foods);
    }
  },

  getSavedMeals(): SavedMeal[] {
    return readCache<SavedMeal[]>(STORAGE_KEYS.SAVED_MEALS, []);
  },

  saveSavedMeals(meals: SavedMeal[]): void {
    writeCache(STORAGE_KEYS.SAVED_MEALS, meals);
  },

  addSavedMeal(meal: Omit<SavedMeal, 'id' | 'frequency' | 'last_used_at' | 'sort_order'>): SavedMeal {
    const meals = this.getSavedMeals();
    const newMeal: SavedMeal = {
      ...meal,
      id: genId('sm'),
      frequency: 1,
      last_used_at: new Date().toISOString(),
      sort_order: meals.length + 1,
    };
    meals.push(newMeal);
    this.saveSavedMeals(meals);
    return newMeal;
  },

  deleteSavedMeal(mealId: string): void {
    this.saveSavedMeals(this.getSavedMeals().filter((m) => m.id !== mealId));
  },

  getAIChat(): AIMessage[] {
    const cached = readCache<AIMessage[] | null>(STORAGE_KEYS.AI_CHAT, null);
    if (cached) return cached;
    return [
      {
        id: 'msg_welcome',
        role: 'assistant',
        content:
          'Hello! I am your AI Nutrition & Metabolic Coach. Ask me anything about your calories, macro targets, meal suggestions, or progress:\n\n• "I have 500 kcal left and need 35g protein, what should I eat?"\n• "Evaluate my deficit and expected timeline to my target weight"\n• "Why is my morning weight fluctuating?"\n• "Suggest a high-protein dinner or quick snack"',
        timestamp: new Date().toISOString(),
      },
    ];
  },

  saveAIChat(messages: AIMessage[]): void {
    writeCache(STORAGE_KEYS.AI_CHAT, messages);
  },

  clearAIChat(): void {
    writeCache(STORAGE_KEYS.AI_CHAT, []);
  },

  getNotifications(): NotificationSettings {
    return readCache<NotificationSettings>(STORAGE_KEYS.NOTIFICATIONS, {
      enabled: true,
      daily_reminder_time: '20:00',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      reminder_type: 'incomplete_log',
    });
  },

  saveNotifications(notifs: NotificationSettings): void {
    writeCache(STORAGE_KEYS.NOTIFICATIONS, notifs);
  },

  getGeminiApiKey(): string {
    return readCache<string>(STORAGE_KEYS.GEMINI_KEY, '');
  },

  saveGeminiApiKey(key: string): void {
    writeCache(STORAGE_KEYS.GEMINI_KEY, key);
  },

  getAIModel(): string {
    return readCache<string>(STORAGE_KEYS.GEMINI_MODEL, 'gemini-3.7-flash');
  },

  saveAIModel(model: string): void {
    writeCache(STORAGE_KEYS.GEMINI_MODEL, model);
  },

  async clearAllData(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      keys.forEach((k) => delete cache[k]);
      await AsyncStorage.multiRemove(keys);
    } catch (e) {
      console.warn('Clear all data error:', e);
    }
    notifyListeners();
  },

  // Compatibility aliases (used throughout the ported UI code)
  getUserProfile(): UserProfile | null {
    return this.getProfile();
  },
  saveUserProfile(profile: UserProfile): void {
    this.saveProfile(profile);
  },
  getFasts(): FastingEntry[] {
    return this.getFasting();
  },
  saveFasts(fasts: FastingEntry[]): void {
    this.saveFasting(fasts);
  },
  addFast(entry: Omit<FastingEntry, 'id'>): FastingEntry {
    return this.addFasting(entry);
  },
  deleteFast(fastId: string): void {
    this.deleteFasting(fastId);
  },
  getAIMessages(): AIMessage[] {
    return this.getAIChat();
  },
  saveAIMessages(messages: AIMessage[]): void {
    this.saveAIChat(messages);
  },
  subscribeToStorage(listener: () => void): () => void {
    return subscribeToStorage(listener);
  },
};
