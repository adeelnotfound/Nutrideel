// Haptics are disabled app-wide — vibration on every tap was more annoying than
// helpful. This module is kept as a no-op shim so existing call sites
// (haptics.light(), haptics.success(), etc.) don't need to change.

export const haptics = {
  light(): void {},
  medium(): void {},
  success(): void {},
  warning(): void {},
  error(): void {},
  selection(): void {},
};
