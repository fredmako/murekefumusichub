import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export const THEME_PRESETS = [
  "emerald",
  "aurora",
  "ocean",
  "sunset",
  "forest",
] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

export const THEME_MODES = ["light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

const PRESET_STORAGE_KEY = "murekefu_theme_preset";
const MODE_STORAGE_KEY = "murekefu_theme_mode";
const DEFAULT_THEME: ThemePreset = "emerald";
const DEFAULT_MODE: ThemeMode = "light";

interface ThemeContextType {
  theme: ThemePreset;
  mode: ThemeMode;
  setTheme: (theme: ThemePreset) => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function isThemePreset(value: unknown): value is ThemePreset {
  return typeof value === "string" && THEME_PRESETS.includes(value as ThemePreset);
}

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && THEME_MODES.includes(value as ThemeMode);
}

function applyThemeToDom(theme: ThemePreset, mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", mode === "dark");
}

function getStoredTheme(): ThemePreset {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const value = window.localStorage.getItem(PRESET_STORAGE_KEY);
    return isThemePreset(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function getStoredMode(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const value = window.localStorage.getItem(MODE_STORAGE_KEY);
    return isThemeMode(value) ? value : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreset>(getStoredTheme);
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode);

  useEffect(() => {
    applyThemeToDom(theme, mode);
    try {
      window.localStorage.setItem(PRESET_STORAGE_KEY, theme);
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      // ignore storage failures
    }
  }, [theme, mode]);

  const value = useMemo(
    () => ({
      theme,
      mode,
      setTheme: (nextTheme: ThemePreset) => {
        setThemeState(nextTheme);
      },
      setMode: (nextMode: ThemeMode) => {
        setModeState(nextMode);
      },
    }),
    [theme, mode],
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
