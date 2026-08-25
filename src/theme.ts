export const colors = {
  bg: '#020617',
  card: '#0f172a',
  cardAlt: '#1e293b',
  border: '#1e293b',
  borderLight: '#334155',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldBg: 'rgba(16,185,129,0.12)',
  amber: '#f59e0b',
  amberBg: 'rgba(245,158,11,0.12)',
  sky: '#38bdf8',
  skyBg: 'rgba(56,189,248,0.12)',
  rose: '#f43f5e',
  roseBg: 'rgba(244,63,94,0.12)',
  violet: '#a78bfa',
  violetBg: 'rgba(167,139,250,0.12)',
  white: '#ffffff',
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  full: 999,
};

export const cardShadow = {
  shadowColor: '#000000',
  shadowOpacity: 0.25,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

export const spacing = (n: number) => n * 4;

export const mealTypeMeta: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  breakfast: { label: 'Breakfast', emoji: '🍳', color: colors.amber, bg: colors.amberBg },
  lunch: { label: 'Lunch', emoji: '🍛', color: colors.emerald, bg: colors.emeraldBg },
  dinner: { label: 'Dinner', emoji: '🍽️', color: colors.sky, bg: colors.skyBg },
  snack: { label: 'Snack', emoji: '🍪', color: colors.violet, bg: colors.violetBg },
  drink: { label: 'Hydration & Drinks', emoji: '💧', color: colors.sky, bg: colors.skyBg },
  custom: { label: 'Custom', emoji: '📝', color: colors.textMuted, bg: colors.cardAlt },
};
