import type { Ghost } from "./createPlainRoom";
import { describeActivity, visitorName } from "./activity";

/**
 * Who else is in the room right now, through the site's database (Supabase Realtime). Each visitor
 * joins one shared channel: presence keeps the head count, and every few hundred milliseconds a
 * visitor who has moved sends where they're standing and looking, and what they're doing (as a code
 * from activity.ts), so the others can draw them as a ghost with a name tag. Nothing is stored. Where
 * the database can't be reached, the room is simply empty.
 */

/** everyone here, for the list under the head count */
export interface Visitor {
  id: string;
  name: string;
  hue: number;
  /** what they're doing, as a code (see activity.ts) */
  activity: string;
  me: boolean;
}

export interface RoomPresence {
  /** share where this visitor is (sent at most every few hundred ms, and when idle every few seconds) */
  sendPose: (pose: { pos: [number, number, number]; look: [number, number, number] }) => void;
  /** share what this visitor is doing; sent straight away when it changes */
  setActivity: (code: string) => void;
  leave: () => void;
}

const hasDatabase = () => {
  const url = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
  return !!url && !url.includes("invalid");
};

/** a hue for a visitor, from their id, so everyone sees them in the same colour */
const hueOf = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h / 360;
};

export async function joinRoom(onChange: (people: { count: number; ghosts: Ghost[]; visitors: Visitor[] }) => void): Promise<RoomPresence | null> {
  if (!hasDatabase()) return null;
  const { supabase } = await import("@/integrations/supabase/client");
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const channel = supabase.channel("room-presence", { config: { presence: { key: id }, broadcast: { self: false } } });
  const poses = new Map<string, { pos: [number, number, number]; look: [number, number, number] }>();
  const doing = new Map<string, string>();
  let mine = "look";
  let here = new Set<string>([id]);

  const emit = () => {
    const ghosts: Ghost[] = [];
    for (const [who, p] of poses) if (who !== id && here.has(who)) ghosts.push({ id: who, ...p, hue: hueOf(who), name: visitorName(who), activity: doing.get(who) ?? "look" });
    const visitors: Visitor[] = [...here].map((who) => ({ id: who, name: visitorName(who), hue: hueOf(who), activity: who === id ? mine : doing.get(who) ?? "look", me: who === id }));
    // you first, then everyone else in a steady order
    visitors.sort((a, b) => Number(b.me) - Number(a.me) || a.name.localeCompare(b.name));
    onChange({ count: here.size, ghosts, visitors });
  };
  channel.on("presence", { event: "sync" }, () => {
    here = new Set(Object.keys(channel.presenceState()));
    here.add(id);
    for (const who of poses.keys()) if (!here.has(who)) poses.delete(who);
    for (const who of doing.keys()) if (!here.has(who)) doing.delete(who);
    emit();
  });
  channel.on("broadcast", { event: "pose" }, ({ payload }) => {
    const p = payload as { id?: string; pos?: number[]; look?: number[]; act?: unknown };
    if (typeof p?.id !== "string" || p.id === id || p.id.length > 64) return;
    // only codes on the known list are kept (activity.ts); anything else reads as "looking around"
    if (p.act !== undefined) doing.set(p.id, describeActivity(p.act) ? (p.act as string) : "look");
    const finite = (v?: number[]) => v?.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 50);
    if (finite(p.pos) && finite(p.look)) poses.set(p.id, { pos: p.pos as [number, number, number], look: p.look as [number, number, number] });
    emit();
  });
  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    void channel.track({ at: Date.now() });
    // connected: say so straight away, before the first head count arrives
    emit();
  });

  let last = "";
  let sentAt = 0;
  let lastPose: { pos: [number, number, number]; look: [number, number, number] } | null = null;
  return {
    sendPose: (pose) => {
      const key = JSON.stringify(pose);
      const now = Date.now();
      // send when moved (at most ~4 times a second), and every few seconds anyway so newcomers see everyone
      if ((key === last && now - sentAt < 4000) || now - sentAt < 250) return;
      last = key;
      sentAt = now;
      lastPose = pose;
      void channel.send({ type: "broadcast", event: "pose", payload: { id, ...pose, act: mine } });
    },
    setActivity: (code) => {
      if (code === mine) return;
      mine = code;
      emit();
      void channel.send({ type: "broadcast", event: "pose", payload: { id, ...(lastPose ?? {}), act: mine } });
    },
    leave: () => {
      void supabase.removeChannel(channel);
    },
  };
}
