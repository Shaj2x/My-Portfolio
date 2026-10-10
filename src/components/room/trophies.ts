/**
 * PS5-style trophies for exploring the room. Earned ones are remembered in the visitor's browser.
 * The platinum unlocks when every other trophy is earned.
 */
export type TrophyTier = "bronze" | "silver" | "gold" | "platinum";
export type TrophyId = "to-be-continued" | "first-find" | "all-found" | "player-one" | "game-night" | "guestbook" | "rooftops" | "make-a-wish" | "change-of-scene" | "platinum";

export const TROPHIES: { id: TrophyId; title: string; detail: string; tier: TrophyTier }[] = [
  { id: "first-find", title: "Housewarming", detail: "Find your first hidden section", tier: "bronze" },
  { id: "player-one", title: "Player One", detail: "Play a game on the PS5", tier: "bronze" },
  { id: "guestbook", title: "Guestbook", detail: "Read the visitor notes on the keyboard", tier: "bronze" },
  { id: "rooftops", title: "Over the Rooftops", detail: "Look at Western through the binoculars", tier: "bronze" },
  { id: "make-a-wish", title: "Make a Wish", detail: "Blow out the candle", tier: "bronze" },
  { id: "change-of-scene", title: "Change of Scene", detail: "Change the sky outside", tier: "bronze" },
  { id: "game-night", title: "Game Night", detail: "Try every game on the PS5", tier: "silver" },
  { id: "to-be-continued", title: "To Be Continued", detail: "Beat Super S", tier: "gold" },
  { id: "all-found", title: "Every Corner", detail: "Find the whole portfolio", tier: "gold" },
  { id: "platinum", title: "Roommate", detail: "Earn every other trophy", tier: "platinum" },
];

export const TIER_COLORS: Record<TrophyTier, string> = {
  bronze: "#d08a52",
  silver: "#c9d1db",
  gold: "#f2c14e",
  platinum: "#a9c8ff",
};

const KEY = "portfolio-room-plain:trophies";
const GAMES_KEY = "portfolio-room-plain:games-played";
/** every game on the PS5 home screen */
export const ALL_GAMES = ["super", "garden", "pong", "snake", "slots", "blackjack", "statstack", "mercatus"];

const read = (key: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const write = (key: string, v: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // not remembered
  }
};

export const loadTrophies = (): TrophyId[] => read(KEY).filter((x): x is TrophyId => TROPHIES.some((t) => t.id === x));
export const saveTrophies = (ids: TrophyId[]) => write(KEY, ids);

/** remembers a game as played; returns how many different games have been played */
export const markGamePlayed = (game: string) => {
  const played = read(GAMES_KEY);
  if (!played.includes(game)) write(GAMES_KEY, [...played, game]);
  return new Set([...played, game]).size;
};
