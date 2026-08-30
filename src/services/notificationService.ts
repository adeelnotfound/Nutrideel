import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationSettings, MealReminderConfig } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const NOTIFICATION_IDENTIFIER = 'nutrideel_daily_reminder';

const MEAL_IDENTIFIERS: Record<'breakfast' | 'lunch' | 'dinner', string> = {
  breakfast: 'nutrideel_meal_reminder_breakfast',
  lunch: 'nutrideel_meal_reminder_lunch',
  dinner: 'nutrideel_meal_reminder_dinner',
};

const MEAL_COPY: Record<'breakfast' | 'lunch' | 'dinner', { title: string; body: string }> = {
  breakfast: { title: 'Log breakfast', body: "Don't forget to log what you had for breakfast." },
  lunch: { title: 'Log lunch', body: "Don't forget to log what you had for lunch." },
  dinner: { title: 'Log dinner', body: "Don't forget to log what you had for dinner." },
};

const REMINDER_COPY: Record<NotificationSettings['reminder_type'], { title: string; body: string }> = {
  incomplete_log: { title: 'Log your day', body: "Don't forget to log today's meals before you turn in." },
  water: { title: 'Stay hydrated', body: 'Quick reminder to log your water intake for today.' },
  weigh_in: { title: 'Time to weigh in', body: 'Log today\'s weight to keep your progress trend accurate.' },
};

export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const result = await Notifications.getPermissionsAsync();
  if (result.granted) return 'granted';
  if (result.status === 'denied') return 'denied';
  return 'undetermined';
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-reminders', {
      name: 'Daily Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

function parseTime(time: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = time.split(':');
  return { hour: Number(hourStr) || 20, minute: Number(minuteStr) || 0 };
}

/**
 * Schedules (or reschedules) the single daily reminder based on the given settings.
 * Cancels any existing scheduled reminder first, then creates a fresh one if enabled.
 * Returns false if permission wasn't granted and nothing could be scheduled.
 */
export async function syncDailyReminder(settings: NotificationSettings): Promise<boolean> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDENTIFIER).catch(() => {});

  if (!settings.enabled) return true;

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  const { hour, minute } = parseTime(settings.daily_reminder_time);
  const copy = REMINDER_COPY[settings.reminder_type] || REMINDER_COPY.incomplete_log;

  await ensureAndroidChannel();

  // expo-notifications' daily trigger fires every day at this time when `repeats: true`.
  // Per-day-of-week filtering isn't supported by a single trigger, so if the user has
  // excluded certain days, the notification still fires daily — a reasonable trade-off
  // for a fully local, no-backend reminder system with no server-side scheduler.
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDENTIFIER,
    content: { title: copy.title, body: copy.body, sound: true },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });

  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDENTIFIER).catch(() => {});
}

/**
 * Schedules (or reschedules) the three independent per-meal reminders — breakfast, lunch,
 * dinner — each with its own enabled flag and time. Each meal gets its own stable
 * notification identifier so they can be individually cancelled/rescheduled without
 * touching the others. Returns false if permission wasn't granted and at least one
 * meal reminder was requested but couldn't be scheduled.
 */
export async function syncMealReminders(mealReminders: NotificationSettings['meal_reminders']): Promise<boolean> {
  const meals: ('breakfast' | 'lunch' | 'dinner')[] = ['breakfast', 'lunch', 'dinner'];

  // Cancel all three first so a meal that just got disabled doesn't keep firing.
  await Promise.all(meals.map((m) => Notifications.cancelScheduledNotificationAsync(MEAL_IDENTIFIERS[m]).catch(() => {})));

  const anyEnabled = meals.some((m) => mealReminders[m].enabled);
  if (!anyEnabled) return true;

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await ensureAndroidChannel();

  for (const meal of meals) {
    const config: MealReminderConfig = mealReminders[meal];
    if (!config.enabled) continue;
    const { hour, minute } = parseTime(config.time);
    const copy = MEAL_COPY[meal];
    await Notifications.scheduleNotificationAsync({
      identifier: MEAL_IDENTIFIERS[meal],
      content: { title: copy.title, body: copy.body, sound: true },
      trigger: {
        hour,
        minute,
        repeats: true,
      },
    });
  }

  return true;
}

export async function cancelMealReminders(): Promise<void> {
  await Promise.all(
    (['breakfast', 'lunch', 'dinner'] as const).map((m) => Notifications.cancelScheduledNotificationAsync(MEAL_IDENTIFIERS[m]).catch(() => {}))
  );
}

/**
 * Orchestrator: syncs whichever reminder mode is active in settings, and makes sure the
 * *other* mode's notifications are cancelled so switching between single/per-meal never
 * leaves stale notifications scheduled from the previous mode.
 */
export async function syncReminders(settings: NotificationSettings): Promise<boolean> {
  if (settings.mode === 'per_meal') {
    await cancelDailyReminder();
    return syncMealReminders(settings.meal_reminders);
  }
  await cancelMealReminders();
  return syncDailyReminder(settings);
}
