import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "reesha";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}>({ theme: "light", setTheme: () => {}, toggleTheme: () => {} });

const THEME_ORDER: Theme[] = ["light", "reesha", "dark"];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("app-theme");
    if (stored === "dark" || stored === "reesha") return stored;
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "reesha");
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "reesha") {
      root.classList.add("reesha");
    }
    localStorage.setItem("app-theme", theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () =>
    setThemeState((t) => {
      const idx = THEME_ORDER.indexOf(t);
      return THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    });

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
