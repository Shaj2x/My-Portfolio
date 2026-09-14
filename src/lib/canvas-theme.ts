/**
 * Canvas can't read Tailwind classes, so the games pull their palette from the
 * same CSS custom properties the rest of the site uses. Both games render on
 * the ink surface, which stays dark in either theme.
 */
const token = (name: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value ? `hsl(${value})` : fallback;
};

export const canvasTheme = () => ({
  ground: token("--ink", "hsl(216, 24%, 6%)"),
  line: token("--ink-border", "hsl(214, 15%, 19%)"),
  dim: token("--ink-muted", "hsl(214, 12%, 64%)"),
  accent: token("--ink-accent", "hsl(219, 79%, 65%)"),
});

export const GAME_FONT = "'Archivo', 'Helvetica Neue', Arial, sans-serif";
