import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "dark" | "light" | "system";
type ThemeContextValue = { mode: ThemeMode; setMode: (mode: ThemeMode) => void };
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// CODEX_DECISION: Persist only the user's explicit theme preference and defer
// system-mode resolution to the browser's preferred-color-scheme media query.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => (localStorage.getItem("omnigraph-theme") as ThemeMode) || "dark");
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = mode === "system" ? (query.matches ? "dark" : "light") : mode; };
    apply(); query.addEventListener("change", apply); localStorage.setItem("omnigraph-theme", mode);
    return () => query.removeEventListener("change", apply);
  }, [mode]);
  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { const context = useContext(ThemeContext); if (!context) throw new Error("useTheme must be inside ThemeProvider"); return context; }
