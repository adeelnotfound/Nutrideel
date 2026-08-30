export type Palette = {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  borderLight: string;
  text: string;
  textMuted: string;
  textFaint: string;
  emerald: string;
  emeraldDark: string;
  emeraldBg: string;
  amber: string;
  amberBg: string;
  sky: string;
  skyBg: string;
  rose: string;
  roseBg: string;
  violet: string;
  violetBg: string;
  white: string;
  isDark: boolean;
};

export type ThemeId = 'midnight' | 'blackRed' | 'ocean' | 'forest' | 'sunset' | 'daylight';

export const themeMeta: Record<ThemeId, { label: string; swatch: string[] }> = {
  midnight: { label: 'Midnight', swatch: ['#020617', '#10b981', '#38bdf8'] },
  blackRed: { label: 'Black & Red', swatch: ['#000000', '#e11d2e', '#d4d4d4'] },
  ocean: { label: 'Deep Ocean', swatch: ['#031420', '#22d3ee', '#0ea5e9'] },
  forest: { label: 'Forest', swatch: ['#0b1410', '#34d399', '#84cc16'] },
  sunset: { label: 'Sunset', swatch: ['#1a0f14', '#fb923c', '#f43f5e'] },
  daylight: { label: 'Daylight', swatch: ['#ffffff', '#059669', '#0284c7'] },
};

export const themes: Record<ThemeId, Palette> = {
  midnight: {
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
    isDark: true,
  },
  blackRed: {
    bg: '#000000',
    card: '#0a0a0a',
    cardAlt: '#161616',
    border: '#262626',
    borderLight: '#3a3a3a',
    text: '#f5f5f5',
    textMuted: '#a3a3a3',
    textFaint: '#6b6b6b',
    emerald: '#e11d2e',
    emeraldDark: '#a3141f',
    emeraldBg: 'rgba(225,29,46,0.14)',
    amber: '#f5a623',
    amberBg: 'rgba(245,166,35,0.12)',
    sky: '#d4d4d4',
    skyBg: 'rgba(212,212,212,0.10)',
    rose: '#ff3b3b',
    roseBg: 'rgba(255,59,59,0.16)',
    violet: '#8b8b8b',
    violetBg: 'rgba(139,139,139,0.12)',
    white: '#ffffff',
    isDark: true,
  },
  ocean: {
    bg: '#031420',
    card: '#0a2436',
    cardAlt: '#0f3145',
    border: '#123a50',
    borderLight: '#1c4d69',
    text: '#e7f6fb',
    textMuted: '#8fb8c9',
    textFaint: '#5f8a9b',
    emerald: '#22d3ee',
    emeraldDark: '#0891b2',
    emeraldBg: 'rgba(34,211,238,0.12)',
    amber: '#fbbf24',
    amberBg: 'rgba(251,191,36,0.12)',
    sky: '#0ea5e9',
    skyBg: 'rgba(14,165,233,0.14)',
    rose: '#fb7185',
    roseBg: 'rgba(251,113,133,0.12)',
    violet: '#818cf8',
    violetBg: 'rgba(129,140,248,0.12)',
    white: '#ffffff',
    isDark: true,
  },
  forest: {
    bg: '#0b1410',
    card: '#122019',
    cardAlt: '#182a20',
    border: '#1e3327',
    borderLight: '#2c4635',
    text: '#eaf6ee',
    textMuted: '#93b9a2',
    textFaint: '#638874',
    emerald: '#34d399',
    emeraldDark: '#059669',
    emeraldBg: 'rgba(52,211,153,0.13)',
    amber: '#facc15',
    amberBg: 'rgba(250,204,21,0.12)',
    sky: '#38bdf8',
    skyBg: 'rgba(56,189,248,0.12)',
    rose: '#fb7185',
    roseBg: 'rgba(251,113,133,0.12)',
    violet: '#84cc16',
    violetBg: 'rgba(132,204,22,0.12)',
    white: '#ffffff',
    isDark: true,
  },
  sunset: {
    bg: '#1a0f14',
    card: '#271620',
    cardAlt: '#33202a',
    border: '#3d2530',
    borderLight: '#553342',
    text: '#fbeef0',
    textMuted: '#c79aa4',
    textFaint: '#916b76',
    emerald: '#fb923c',
    emeraldDark: '#ea580c',
    emeraldBg: 'rgba(251,146,60,0.14)',
    amber: '#fbbf24',
    amberBg: 'rgba(251,191,36,0.12)',
    sky: '#f472b6',
    skyBg: 'rgba(244,114,182,0.12)',
    rose: '#f43f5e',
    roseBg: 'rgba(244,63,94,0.14)',
    violet: '#c084fc',
    violetBg: 'rgba(192,132,252,0.12)',
    white: '#ffffff',
    isDark: true,
  },
  daylight: {
    bg: '#f8fafc',
    card: '#ffffff',
    cardAlt: '#f1f5f9',
    border: '#e2e8f0',
    borderLight: '#cbd5e1',
    text: '#0f172a',
    textMuted: '#475569',
    textFaint: '#64748b',
    emerald: '#059669',
    emeraldDark: '#047857',
    emeraldBg: 'rgba(5,150,105,0.10)',
    amber: '#d97706',
    amberBg: 'rgba(217,119,6,0.10)',
    sky: '#0284c7',
    skyBg: 'rgba(2,132,199,0.10)',
    rose: '#e11d48',
    roseBg: 'rgba(225,29,72,0.10)',
    violet: '#7c3aed',
    violetBg: 'rgba(124,58,237,0.10)',
    white: '#ffffff',
    isDark: false,
  },
};

export const defaultThemeId: ThemeId = 'midnight';

// Backwards-compatible default palette used by anything importing statically.
export const colors = themes[defaultThemeId];

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

export function getMealTypeMeta(
  palette: Palette
): Record<string, { label: string; icon: string; color: string; bg: string }> {
  return {
    breakfast: { label: 'Breakfast', icon: 'sunny-outline', color: palette.amber, bg: palette.amberBg },
    lunch: { label: 'Lunch', icon: 'restaurant-outline', color: palette.emerald, bg: palette.emeraldBg },
    dinner: { label: 'Dinner', icon: 'moon-outline', color: palette.sky, bg: palette.skyBg },
    snack: { label: 'Snack', icon: 'nutrition-outline', color: palette.violet, bg: palette.violetBg },
    drink: { label: 'Hydration & Drinks', icon: 'water-outline', color: palette.sky, bg: palette.skyBg },
    custom: { label: 'Custom', icon: 'create-outline', color: palette.textMuted, bg: palette.cardAlt },
  };
}

// Deprecated: kept so any stray import doesn't crash; prefer getMealTypeMeta(colors) via useTheme().
export const mealTypeMeta = getMealTypeMeta(themes[defaultThemeId]);
