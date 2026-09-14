/**
 * Canvas cannot read Tailwind classes, so the games pull their palette from
 * the same custom properties the rest of the site uses. The board is an
 * obsidian surface with paper and grey marks — the monochrome discipline
 * holds inside the game too.
 */
const token = (name: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

export const canvasTheme = () => ({
  ground: token("--color-obsidian", "#000000"),
  line: token("--color-inkstone", "#181818"),
  dim: token("--color-felt-gray", "#6d6d6d"),
  mark: token("--color-paper", "#ffffff"),
});

export const GAME_FONT = "'Inter', ui-sans-serif, system-ui, sans-serif";
