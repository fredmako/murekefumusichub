import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export const THEME_PRESETS = [
  "emerald",
  "aurora",
  "ocean",
  "sunset",
  "forest",
] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

const STORAGE_KEY = "murekefu_theme_preset";
const DEFAULT_THEME: ThemePreset = "emerald";

interface ThemeContextType {
  theme: ThemePreset;
  setTheme: (theme: ThemePreset) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function isThemePreset(value: unknown): value is ThemePreset {
  return typeof value === "string" && THEME_PRESETS.includes(value as ThemePreset);
}

function applyThemeToDom(theme: ThemePreset) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

function getStoredTheme(): ThemePreset {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isThemePreset(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreset>(getStoredTheme);

  useEffect(() => {
    applyThemeToDom(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage failures
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (nextTheme: ThemePreset) => {
        setThemeState(nextTheme);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export default ThemeContext;
