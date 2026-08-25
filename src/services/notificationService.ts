import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NotificationSettings } from '../types';

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

/**
 * Schedules (or reschedules) the daily reminder based on the given settings.
 * Cancels any existing scheduled reminder first, then creates a fresh one if enabled.
 * Returns false if permission wasn't granted and nothing could be scheduled.
 */
export async function syncDailyReminder(settings: NotificationSettings): Promise<boolean> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDENTIFIER).catch(() => {});

  if (!settings.enabled) return true;

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  const [hourStr, minuteStr] = settings.daily_reminder_time.split(':');
  const hour = Number(hourStr) || 20;
  const minute = Number(minuteStr) || 0;
  const copy = REMINDER_COPY[settings.reminder_type] || REMINDER_COPY.incomplete_log;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-reminders', {
      name: 'Daily Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

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
