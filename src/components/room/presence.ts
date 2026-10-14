import type { Ghost } from "./createPlainRoom";

/**
 * Who else is in the room right now, through the site's database (Supabase Realtime). Each visitor
 * joins one shared channel: presence keeps the head count, and every few hundred milliseconds a
 * visitor who has moved sends where they're standing and looking, so the others can draw them as
 * a ghost. Nothing is stored. Where the database can't be reached, the room is simply empty.
 */

export interface RoomPresence {
  /** share where this visitor is (sent at most every few hundred ms, and when idle every few seconds) */
  sendPose: (pose: { pos: [number, number, number]; look: [number, number, number] }) => void;
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

export async function joinRoom(onChange: (people: { count: number; ghosts: Ghost[] }) => void): Promise<RoomPresence | null> {
  if (!hasDatabase()) return null;
  const { supabase } = await import("@/integrations/supabase/client");
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const channel = supabase.channel("room-presence", { config: { presence: { key: id }, broadcast: { self: false } } });
  const poses = new Map<string, { pos: [number, number, number]; look: [number, number, number] }>();
  let here = new Set<string>([id]);

  const emit = () => {
    const ghosts: Ghost[] = [];
    for (const [who, p] of poses) if (who !== id && here.has(who)) ghosts.push({ id: who, ...p, hue: hueOf(who) });
    onChange({ count: here.size, ghosts });
  };
  channel.on("presence", { event: "sync" }, () => {
    here = new Set(Object.keys(channel.presenceState()));
    here.add(id);
    for (const who of poses.keys()) if (!here.has(who)) poses.delete(who);
    emit();
  });
  channel.on("broadcast", { event: "pose" }, ({ payload }) => {
    const p = payload as { id?: string; pos?: number[]; look?: number[] };
    if (!p?.id || p.id === id || p.pos?.length !== 3 || p.look?.length !== 3) return;
    poses.set(p.id, { pos: p.pos as [number, number, number], look: p.look as [number, number, number] });
    emit();
  });
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") void channel.track({ at: Date.now() });
  });

  let last = "";
  let sentAt = 0;
  return {
    sendPose: (pose) => {
      const key = JSON.stringify(pose);
      const now = Date.now();
      // send when moved (at most ~4 times a second), and every few seconds anyway so newcomers see everyone
      if ((key === last && now - sentAt < 4000) || now - sentAt < 250) return;
      last = key;
      sentAt = now;
      void channel.send({ type: "broadcast", event: "pose", payload: { id, ...pose } });
    },
    leave: () => {
      void supabase.removeChannel(channel);
    },
  };
}
