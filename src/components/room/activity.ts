import type { PortfolioId } from "./portfolioSpots";

/*
 * What a visitor is doing right now, shared with everyone else in the room ("Playing Snake",
 * "Chatting with R.V Bot"). It travels as a short code from a fixed list, never as text: the
 * channel is public, so a code nobody recognises is simply ignored, and nobody can put their own
 * words on someone else's screen.
 */

const GAMES: Record<string, string> = {
  super: "Super S",
  garden: "Ma's Garden",
  timer: "Stop the Clock",
  pong: "Pong",
  snake: "Snake",
  slots: "the slot machine",
  blackjack: "blackjack",
  statstack: "StatStack",
  mercatus: "Mercatus",
};

const SECTIONS: Record<PortfolioId, string> = {
  about: "Reading About Me",
  projects: "Browsing the projects",
  resume: "Reading the resume",
  leadership: "Reading about leadership",
  skills: "Looking at the skills",
  services: "Checking out what I build",
  contact: "Looking at how to reach me",
};

/** the albums on the walls, by poster */
const ALBUMS = ["Take Care", "Rodeo", "Nothing Was the Same", "PARTYNEXTDOOR 3", "Habibti", "Trilogy", "$ome $exy $ongs 4 U"];

const FIXED: Record<string, string> = {
  look: "Looking around",
  ps5: "On the PS5",
  binoculars: "Looking out the binoculars",
  bot: "Chatting with R.V Bot",
  guestbook: "Signing the guestbook",
  whiteboard: "Drawing on the whiteboard",
  music: "Listening to the playlist",
  away: "Stepped away",
};

/** each kind of activity gets an emoji, so it reads at a glance */
const ICONS: Record<string, string> = {
  look: "👀", ps5: "🎮", game: "🎮", binoculars: "🔭", bot: "💬", guestbook: "✍️", whiteboard: "🖍️", music: "🎧", poster: "🎵", section: "📂", away: "💤",
};

export interface ActivityState {
  away: boolean;
  view: string;
  game: string | null;
  asking: boolean;
  guestbook: boolean;
  drawing: boolean;
  poster: string | null;
  section: PortfolioId | null;
  music: boolean;
}

/** this visitor's activity, as a code, most specific first */
export const activityCode = (s: ActivityState): string => {
  if (s.away) return "away";
  if (s.view === "console") return s.game && GAMES[s.game] ? `game:${s.game}` : "ps5";
  if (s.view === "binoculars") return "binoculars";
  if (s.asking) return "bot";
  if (s.guestbook) return "guestbook";
  if (s.drawing) return "whiteboard";
  if (s.poster && ALBUMS.includes(s.poster)) return `poster:${ALBUMS.indexOf(s.poster)}`;
  if (s.section) return `section:${s.section}`;
  if (s.music) return "music";
  return "look";
};

/** a code someone sent, as words with an emoji; null for anything not on the list */
export const describeActivity = (code: unknown): { icon: string; text: string } | null => {
  if (typeof code !== "string" || code.length > 40) return null;
  const [kind, arg] = code.split(":");
  if (arg === undefined && Object.prototype.hasOwnProperty.call(FIXED, kind)) return { icon: ICONS[kind], text: FIXED[kind] };
  if (kind === "game" && arg && Object.prototype.hasOwnProperty.call(GAMES, arg)) return { icon: ICONS.game, text: `Playing ${GAMES[arg]}` };
  if (kind === "section" && arg && Object.prototype.hasOwnProperty.call(SECTIONS, arg)) return { icon: ICONS.section, text: SECTIONS[arg as PortfolioId] };
  if (kind === "poster" && /^\d$/.test(arg ?? "") && ALBUMS[Number(arg)]) return { icon: ICONS.poster, text: `Checking out ${ALBUMS[Number(arg)]}` };
  return null;
};

const ADJECTIVES = ["Amber", "Neon", "Velvet", "Cosmic", "Lucky", "Sunny", "Midnight", "Electric", "Golden", "Misty", "Turbo", "Pixel", "Lunar", "Cozy", "Swift", "Mellow"];
const ANIMALS = ["Fox", "Otter", "Panda", "Koala", "Falcon", "Tiger", "Raccoon", "Owl", "Dolphin", "Lynx", "Penguin", "Gecko", "Moose", "Hedgehog", "Raven", "Bunny"];

/** a friendly name for a visitor, from their id, so everyone sees the same name for them */
export const visitorName = (id: string) => {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return `${ADJECTIVES[h % ADJECTIVES.length]} ${ANIMALS[(h >>> 8) % ANIMALS.length]}`;
};
