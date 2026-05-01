import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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

export const THEME_DARK_HUES = [
  "plum",
  "midnight",
  "graphite",
  "forest-night",
  "ember",
] as const;
export type ThemeDarkHue = (typeof THEME_DARK_HUES)[number];

export const THEME_UI_SCALES = ["compact", "standard", "large"] as const;
export type ThemeUiScale = (typeof THEME_UI_SCALES)[number];

export const THEME_ICON_SCALES = ["small", "medium", "large"] as const;
export type ThemeIconScale = (typeof THEME_ICON_SCALES)[number];

export const THEME_LAYOUT_DENSITIES = [
  "compact",
  "balanced",
  "spacious",
] as const;
export type ThemeLayoutDensity = (typeof THEME_LAYOUT_DENSITIES)[number];

export const THEME_SURFACE_STYLES = ["soft", "glass", "solid"] as const;
export type ThemeSurfaceStyle = (typeof THEME_SURFACE_STYLES)[number];

const PRESET_STORAGE_KEY = "murekefu_theme_preset";
const MODE_STORAGE_KEY = "murekefu_theme_mode";
const DARK_HUE_STORAGE_KEY = "murekefu_theme_dark_hue";
const UI_SCALE_STORAGE_KEY = "murekefu_theme_ui_scale";
const ICON_SCALE_STORAGE_KEY = "murekefu_theme_icon_scale";
const LAYOUT_DENSITY_STORAGE_KEY = "murekefu_theme_layout_density";
const SURFACE_STYLE_STORAGE_KEY = "murekefu_theme_surface_style";
const DEFAULT_THEME: ThemePreset = "ocean";
const DEFAULT_MODE: ThemeMode = "light";
const DEFAULT_DARK_HUE: ThemeDarkHue = "plum";
const DEFAULT_UI_SCALE: ThemeUiScale = "standard";
const DEFAULT_ICON_SCALE: ThemeIconScale = "medium";
const DEFAULT_LAYOUT_DENSITY: ThemeLayoutDensity = "balanced";
const DEFAULT_SURFACE_STYLE: ThemeSurfaceStyle = "soft";

interface ThemeContextType {
  theme: ThemePreset;
  mode: ThemeMode;
  darkHue: ThemeDarkHue;
  uiScale: ThemeUiScale;
  iconScale: ThemeIconScale;
  layoutDensity: ThemeLayoutDensity;
  surfaceStyle: ThemeSurfaceStyle;
  setTheme: (theme: ThemePreset) => void;
  setMode: (mode: ThemeMode) => void;
  setDarkHue: (darkHue: ThemeDarkHue) => void;
  setUiScale: (uiScale: ThemeUiScale) => void;
  setIconScale: (iconScale: ThemeIconScale) => void;
  setLayoutDensity: (layoutDensity: ThemeLayoutDensity) => void;
  setSurfaceStyle: (surfaceStyle: ThemeSurfaceStyle) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function isThemePreset(value: unknown): value is ThemePreset {
  return typeof value === "string" && THEME_PRESETS.includes(value as ThemePreset);
}

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && THEME_MODES.includes(value as ThemeMode);
}

function isThemeDarkHue(value: unknown): value is ThemeDarkHue {
  return typeof value === "string" && THEME_DARK_HUES.includes(value as ThemeDarkHue);
}

function isThemeUiScale(value: unknown): value is ThemeUiScale {
  return typeof value === "string" && THEME_UI_SCALES.includes(value as ThemeUiScale);
}

function isThemeIconScale(value: unknown): value is ThemeIconScale {
  return (
    typeof value === "string" &&
    THEME_ICON_SCALES.includes(value as ThemeIconScale)
  );
}

function isThemeLayoutDensity(value: unknown): value is ThemeLayoutDensity {
  return (
    typeof value === "string" &&
    THEME_LAYOUT_DENSITIES.includes(value as ThemeLayoutDensity)
  );
}

function isThemeSurfaceStyle(value: unknown): value is ThemeSurfaceStyle {
  return (
    typeof value === "string" &&
    THEME_SURFACE_STYLES.includes(value as ThemeSurfaceStyle)
  );
}

function applyThemeToDom(
  theme: ThemePreset,
  mode: ThemeMode,
  darkHue: ThemeDarkHue,
  uiScale: ThemeUiScale,
  iconScale: ThemeIconScale,
  layoutDensity: ThemeLayoutDensity,
  surfaceStyle: ThemeSurfaceStyle,
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-dark-hue", darkHue);
  root.setAttribute("data-ui-scale", uiScale);
  root.setAttribute("data-icon-scale", iconScale);
  root.setAttribute("data-layout-density", layoutDensity);
  root.setAttribute("data-surface-style", surfaceStyle);
  root.classList.toggle("dark", mode === "dark");

  const fontSize =
    uiScale === "compact" ? "15px" : uiScale === "large" ? "17px" : "16px";
  const iconScaleValue =
    iconScale === "small" ? "0.9" : iconScale === "large" ? "1.14" : "1";

  root.style.setProperty("--font-size", fontSize);
  root.style.setProperty("--app-icon-scale", iconScaleValue);
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

function getStoredDarkHue(): ThemeDarkHue {
  if (typeof window === "undefined") return DEFAULT_DARK_HUE;
  try {
    const value = window.localStorage.getItem(DARK_HUE_STORAGE_KEY);
    return isThemeDarkHue(value) ? value : DEFAULT_DARK_HUE;
  } catch {
    return DEFAULT_DARK_HUE;
  }
}

function getStoredUiScale(): ThemeUiScale {
  if (typeof window === "undefined") return DEFAULT_UI_SCALE;
  try {
    const value = window.localStorage.getItem(UI_SCALE_STORAGE_KEY);
    return isThemeUiScale(value) ? value : DEFAULT_UI_SCALE;
  } catch {
    return DEFAULT_UI_SCALE;
  }
}

function getStoredIconScale(): ThemeIconScale {
  if (typeof window === "undefined") return DEFAULT_ICON_SCALE;
  try {
    const value = window.localStorage.getItem(ICON_SCALE_STORAGE_KEY);
    return isThemeIconScale(value) ? value : DEFAULT_ICON_SCALE;
  } catch {
    return DEFAULT_ICON_SCALE;
  }
}

function getStoredLayoutDensity(): ThemeLayoutDensity {
  if (typeof window === "undefined") return DEFAULT_LAYOUT_DENSITY;
  try {
    const value = window.localStorage.getItem(LAYOUT_DENSITY_STORAGE_KEY);
    return isThemeLayoutDensity(value) ? value : DEFAULT_LAYOUT_DENSITY;
  } catch {
    return DEFAULT_LAYOUT_DENSITY;
  }
}

function getStoredSurfaceStyle(): ThemeSurfaceStyle {
  if (typeof window === "undefined") return DEFAULT_SURFACE_STYLE;
  try {
    const value = window.localStorage.getItem(SURFACE_STYLE_STORAGE_KEY);
    return isThemeSurfaceStyle(value) ? value : DEFAULT_SURFACE_STYLE;
  } catch {
    return DEFAULT_SURFACE_STYLE;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreset>(getStoredTheme);
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode);
  const [darkHue, setDarkHueState] = useState<ThemeDarkHue>(getStoredDarkHue);
  const [uiScale, setUiScaleState] = useState<ThemeUiScale>(getStoredUiScale);
  const [iconScale, setIconScaleState] =
    useState<ThemeIconScale>(getStoredIconScale);
  const [layoutDensity, setLayoutDensityState] =
    useState<ThemeLayoutDensity>(getStoredLayoutDensity);
  const [surfaceStyle, setSurfaceStyleState] =
    useState<ThemeSurfaceStyle>(getStoredSurfaceStyle);

  const setTheme = useCallback((nextTheme: ThemePreset) => {
    setThemeState(isThemePreset(nextTheme) ? nextTheme : DEFAULT_THEME);
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(isThemeMode(nextMode) ? nextMode : DEFAULT_MODE);
  }, []);

  const setDarkHue = useCallback((nextDarkHue: ThemeDarkHue) => {
    setDarkHueState(isThemeDarkHue(nextDarkHue) ? nextDarkHue : DEFAULT_DARK_HUE);
  }, []);

  const setUiScale = useCallback((nextUiScale: ThemeUiScale) => {
    setUiScaleState(
      isThemeUiScale(nextUiScale) ? nextUiScale : DEFAULT_UI_SCALE,
    );
  }, []);

  const setIconScale = useCallback((nextIconScale: ThemeIconScale) => {
    setIconScaleState(
      isThemeIconScale(nextIconScale) ? nextIconScale : DEFAULT_ICON_SCALE,
    );
  }, []);

  const setLayoutDensity = useCallback(
    (nextLayoutDensity: ThemeLayoutDensity) => {
      setLayoutDensityState(
        isThemeLayoutDensity(nextLayoutDensity)
          ? nextLayoutDensity
          : DEFAULT_LAYOUT_DENSITY,
      );
    },
    [],
  );

  const setSurfaceStyle = useCallback((nextSurfaceStyle: ThemeSurfaceStyle) => {
    setSurfaceStyleState(
      isThemeSurfaceStyle(nextSurfaceStyle)
        ? nextSurfaceStyle
        : DEFAULT_SURFACE_STYLE,
    );
  }, []);

  useEffect(() => {
    applyThemeToDom(
      theme,
      mode,
      darkHue,
      uiScale,
      iconScale,
      layoutDensity,
      surfaceStyle,
    );
    try {
      window.localStorage.setItem(PRESET_STORAGE_KEY, theme);
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
      window.localStorage.setItem(DARK_HUE_STORAGE_KEY, darkHue);
      window.localStorage.setItem(UI_SCALE_STORAGE_KEY, uiScale);
      window.localStorage.setItem(ICON_SCALE_STORAGE_KEY, iconScale);
      window.localStorage.setItem(LAYOUT_DENSITY_STORAGE_KEY, layoutDensity);
      window.localStorage.setItem(SURFACE_STYLE_STORAGE_KEY, surfaceStyle);
    } catch {
      // ignore storage failures
    }
  }, [theme, mode, darkHue, uiScale, iconScale, layoutDensity, surfaceStyle]);

  const value = useMemo(
    () => ({
      theme,
      mode,
      darkHue,
      uiScale,
      iconScale,
      layoutDensity,
      surfaceStyle,
      setTheme,
      setMode,
      setDarkHue,
      setUiScale,
      setIconScale,
      setLayoutDensity,
      setSurfaceStyle,
    }),
    [
      theme,
      mode,
      darkHue,
      uiScale,
      iconScale,
      layoutDensity,
      surfaceStyle,
      setTheme,
      setMode,
      setDarkHue,
      setUiScale,
      setIconScale,
      setLayoutDensity,
      setSurfaceStyle,
    ],
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
