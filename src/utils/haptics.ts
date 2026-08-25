import * as Haptics from 'expo-haptics';

// Every call is fire-and-forget and swallow-on-error — haptics are a nice-to-have,
// never something that should crash or block an interaction if the platform/device
// doesn't support it.

export const haptics = {
  light(): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  medium(): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  success(): void {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning(): void {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  error(): void {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
  selection(): void {
    Haptics.selectionAsync().catch(() => {});
  },
};
