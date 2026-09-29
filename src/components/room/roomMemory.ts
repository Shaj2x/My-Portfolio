import type { LightingSettings, TimeMode, Weather } from "./createRoomScene";

/*
 * Remembers a visitor's room between visits, in their own browser only: lighting, weather,
 * time of day, sound, and when they were last here. Storage can be unavailable (private
 * windows, blocked site data), so every access is guarded and the room works without it.
 */

const KEY = "portfolio-room:v1";

export interface RoomMemory {
  lighting?: LightingSettings;
  weather?: Weather;
  timeMode?: TimeMode;
  muted?: boolean;
  visits?: number;
  lastVisit?: number;
}

export function loadMemory(): RoomMemory {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RoomMemory) : {};
  } catch {
    return {};
  }
}

export function saveMemory(patch: RoomMemory) {
  try {
    const next = { ...loadMemory(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: nothing is remembered, and that's fine */
  }
}

const ago = (ms: number) => {
  const min = Math.round(ms / 60000);
  if (min < 2) return "a moment";
  if (min < 60) return `${min} minutes`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? "an hour" : `${h} hours`;
  const d = Math.round(h / 24);
  if (d < 14) return d === 1 ? "a day" : `${d} days`;
  const w = Math.round(d / 7);
  return w < 9 ? `${w} weeks` : "a while";
};

/**
 * Records this visit and returns a welcome-back note for returning visitors (null the first time).
 */
export function recordVisit(now = Date.now()): string | null {
  const mem = loadMemory();
  const visits = (mem.visits ?? 0) + 1;
  saveMemory({ visits, lastVisit: now });
  if (!mem.lastVisit) return null;
  const since = ago(now - mem.lastVisit);
  const lights = mem.lighting ? " I left the lights the way you had them." : "";
  if (visits >= 5) return `Welcome back, again. Visit number ${visits}. You must like it here.${lights}`;
  return `Welcome back. It's been ${since}.${lights}`;
}
