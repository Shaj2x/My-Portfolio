import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";
export type AccentColor = "red" | "blue" | "green" | "purple" | "orange";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  accent: AccentColor;
  setAccent: (c: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  accent: "red",
  setAccent: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const accentVars: Record<AccentColor, { primary: string; gradient: string }> = {
  red:    { primary: "0 72% 51%",   gradient: "0 72% 70%" },
  blue:   { primary: "217 91% 60%", gradient: "217 91% 75%" },
  green:  { primary: "142 71% 45%", gradient: "142 71% 65%" },
  purple: { primary: "270 70% 55%", gradient: "270 70% 72%" },
  orange: { primary: "25 95% 53%",  gradient: "25 95% 70%" },
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme") as Theme;
    return saved || "dark";
  });

  const [accent, setAccentState] = useState<AccentColor>(() => {
    return (localStorage.getItem("accent") as AccentColor) || "red";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const vars = accentVars[accent];
    root.style.setProperty("--primary", vars.primary);
    root.style.setProperty("--accent", vars.primary);
    root.style.setProperty("--ring", vars.primary);
    root.style.setProperty("--sidebar-primary", vars.primary);
    root.style.setProperty("--sidebar-ring", vars.primary);
    root.dataset.accent = accent;
    localStorage.setItem("accent", accent);
  }, [accent]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const setAccent = (c: AccentColor) => setAccentState(c);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
};
