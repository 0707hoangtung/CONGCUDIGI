import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

export type Theme = "dark" | "light";

export interface ThemeColors {
  bg: string;
  bgSecondary: string;
  panel: string;
  panelSolid: string;
  panelHeader: string;
  panelSub: string;
  border: string;
  borderLight: string;
  borderHover: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  canvasBg: string;
  grid: string;
  gridStrong: string;
  axis: string;
  axisText: string;
  emerald: string;
  amber: string;
  cyan: string;
  indigo: string;
  rose: string;
  purple: string;
}

const DARK_COLORS: ThemeColors = {
  bg: "#020617", // slate-950
  bgSecondary: "#0f172a", // slate-900
  panel: "rgba(15, 23, 42, 0.75)",
  panelSolid: "#0f172a",
  panelHeader: "rgba(15, 23, 42, 0.92)",
  panelSub: "#020617",
  border: "#1e293b", // slate-800
  borderLight: "#334155", // slate-700
  borderHover: "#475569",
  text: "#f8fafc", // slate-50
  textSecondary: "#cbd5e1", // slate-300
  textMuted: "#94a3b8", // slate-400
  textFaint: "#64748b", // slate-500
  canvasBg: "#020617",
  grid: "rgba(51, 65, 85, 0.45)",
  gridStrong: "rgba(71, 85, 105, 0.8)",
  axis: "#94a3b8",
  axisText: "#cbd5e1",
  emerald: "#10b981",
  amber: "#f59e0b",
  cyan: "#06b6d4",
  indigo: "#6366f1",
  rose: "#f43f5e",
  purple: "#a855f7",
};

const LIGHT_COLORS: ThemeColors = {
  bg: "#f1f5f9", // slate-100
  bgSecondary: "#ffffff",
  panel: "rgba(255, 255, 255, 0.95)",
  panelSolid: "#ffffff",
  panelHeader: "rgba(248, 250, 252, 0.98)",
  panelSub: "#f8fafc",
  border: "#cbd5e1", // slate-300
  borderLight: "#e2e8f0", // slate-200
  borderHover: "#94a3b8",
  text: "#0f172a", // slate-900
  textSecondary: "#334155", // slate-700
  textMuted: "#64748b", // slate-500
  textFaint: "#94a3b8", // slate-400
  canvasBg: "#ffffff",
  grid: "rgba(203, 213, 225, 0.75)",
  gridStrong: "rgba(148, 163, 184, 0.9)",
  axis: "#334155",
  axisText: "#0f172a",
  emerald: "#059669",
  amber: "#d97706",
  cyan: "#0284c7",
  indigo: "#4f46e5",
  rose: "#e11d48",
  purple: "#9333ea",
};

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  isDark: true,
  colors: DARK_COLORS,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("math_sys_theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return "dark";
  });

  const isDark = theme === "dark";
  const colors = useMemo(() => (isDark ? DARK_COLORS : LIGHT_COLORS), [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem("math_sys_theme", theme);
    } catch {}

    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
      root.style.colorScheme = "dark";
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
    root.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
