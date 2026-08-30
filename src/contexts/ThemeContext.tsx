import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { Palette, ThemeId, themes, themeMeta, defaultThemeId } from '../theme';
import { storage } from '../services/storage';

interface ThemeContextValue {
  themeId: ThemeId;
  colors: Palette;
  setThemeId: (id: ThemeId) => void;
  availableThemes: { id: ThemeId; label: string; swatch: string[] }[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => storage.getTheme());

  useEffect(() => {
    const unsubscribe = storage.subscribeToStorage(() => {
      const stored = storage.getTheme();
      setThemeIdState((prev) => (prev !== stored ? stored : prev));
    });
    return unsubscribe;
  }, []);

  const setThemeId = (id: ThemeId) => {
    setThemeIdState(id);
    storage.saveTheme(id);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      colors: themes[themeId] ?? themes[defaultThemeId],
      setThemeId,
      availableThemes: (Object.keys(themeMeta) as ThemeId[]).map((id) => ({
        id,
        label: themeMeta[id].label,
        swatch: themeMeta[id].swatch,
      })),
    }),
    [themeId]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
