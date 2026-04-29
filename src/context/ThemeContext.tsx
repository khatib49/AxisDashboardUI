"use client";

import type React from "react";
import { createContext, useState, useContext, useEffect, useCallback } from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  followSystem: boolean;
  setFollowSystem: (v: boolean) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "theme";
const FOLLOW_KEY = "theme:follow-system";

function readInitial(): { theme: Theme; followSystem: boolean } {
  if (typeof window === "undefined") return { theme: "light", followSystem: true };
  const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
  const explicitFollow = localStorage.getItem(FOLLOW_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved && explicitFollow === "false") {
    return { theme: saved, followSystem: false };
  }
  return { theme: prefersDark ? "dark" : "light", followSystem: true };
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [{ theme, followSystem }, setState] = useState(() => readInitial());

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  useEffect(() => {
    if (!followSystem) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) =>
      setState((s) => ({ ...s, theme: e.matches ? "dark" : "light" }));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [followSystem]);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    localStorage.setItem(FOLLOW_KEY, "false");
    setState({ theme: t, followSystem: false });
  }, []);

  const toggleTheme = useCallback(() => {
    setState((s) => {
      const next: Theme = s.theme === "light" ? "dark" : "light";
      localStorage.setItem(STORAGE_KEY, next);
      localStorage.setItem(FOLLOW_KEY, "false");
      return { theme: next, followSystem: false };
    });
  }, []);

  const setFollowSystem = useCallback((v: boolean) => {
    if (v) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(FOLLOW_KEY, "true");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setState({ theme: prefersDark ? "dark" : "light", followSystem: true });
    } else {
      localStorage.setItem(FOLLOW_KEY, "false");
      setState((s) => {
        localStorage.setItem(STORAGE_KEY, s.theme);
        return { ...s, followSystem: false };
      });
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, followSystem, setFollowSystem }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
