/**
 * ThemeProvider — client context provider for site-wide dark mode.
 *
 * Owns the current mode ('system'|'light'|'dark'), resolves it against the OS
 * prefers-color-scheme, and applies the `dark` class to <html>. Exposes
 * { mode, setMode, resolvedDark } via useThemeContext. A FOUC-guard inline
 * script in the root layout applies the persisted preference before hydration.
 *
 * `accountPref` (optional): the signed-in user's user_profiles.theme_pref from
 * the server (SSR). When present it seeds the initial mode so a logged-in
 * account's saved preference wins over guest localStorage.
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyDarkClass,
  persistStoredMode,
  readStoredMode,
  type ThemeMode,
} from "@/lib/hooks/useTheme";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  accountPref,
}: {
  children: ReactNode;
  accountPref?: ThemeMode;
}) {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    accountPref ?? readStoredMode(),
  );
  const [prefersDark, setPrefersDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });

  // Track OS preference changes (subscription callbacks only — no sync setState).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Adopt a server-provided account pref when it arrives/changes — adjusted
  // during render (React's "adjust state when a prop changes" pattern), not
  // in an effect, to avoid cascading renders.
  const [prevAccountPref, setPrevAccountPref] = useState<ThemeMode | undefined>(
    accountPref,
  );
  if (prevAccountPref !== accountPref) {
    setPrevAccountPref(accountPref);
    if (accountPref) setModeState(accountPref);
  }

  const resolvedDark = mode === "dark" || (mode === "system" && prefersDark);

  // Apply to <html>; persist for guests (accounts persist via PATCH too).
  useEffect(() => {
    applyDarkClass(resolvedDark);
    persistStoredMode(mode);
  }, [resolvedDark, mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
  }, []);

  const value = useMemo(
    () => ({ mode, setMode, resolvedDark }),
    [mode, setMode, resolvedDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within <ThemeProvider>");
  }
  return ctx;
}
