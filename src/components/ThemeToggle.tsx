import { Moon, Sun } from "lucide-react";
import { useTheme, AccentColor } from "./ThemeProvider";

const accentColors: { name: AccentColor; color: string }[] = [
  { name: "red",    color: "hsl(0, 72%, 51%)" },
  { name: "blue",   color: "hsl(217, 91%, 60%)" },
  { name: "green",  color: "hsl(142, 71%, 45%)" },
  { name: "purple", color: "hsl(270, 70%, 55%)" },
  { name: "orange", color: "hsl(25, 95%, 53%)" },
];

const ThemeToggle = () => {
  const { theme, toggleTheme, accent, setAccent } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 border border-border rounded-full px-2 py-1">
        {accentColors.map((c) => (
          <button
            key={c.name}
            onClick={() => setAccent(c.name)}
            aria-label={`${c.name} theme`}
            className={`w-4 h-4 rounded-full transition-all ${
              accent === c.name ? "ring-2 ring-foreground ring-offset-1 ring-offset-background scale-110" : "opacity-60 hover:opacity-100"
            }`}
            style={{ backgroundColor: c.color }}
          />
        ))}
      </div>
      <button
        onClick={toggleTheme}
        className="p-2 rounded-full border border-border hover:border-primary hover:text-primary transition-all"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
};

export default ThemeToggle;
