/**
 * Notes visitors leave in the room. They're kept in the site's database (the visitor_notes
 * table) so every visitor sees them. Where the database can't be reached (the hosted preview,
 * or a local build without its keys) notes are kept in this browser instead, and `shared`
 * says so.
 */

export interface VisitorNote {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

export const NOTE_LIMIT = 280;
export const NAME_LIMIT = 40;
/** notes are kept forever; this is how many of the newest the desk shows */
const SHOWN = 200;

const LOCAL_KEY = "portfolio-room-plain:notes";
const hasDatabase = () => {
  const url = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
  return !!url && !url.includes("invalid");
};
const readLocal = (): VisitorNote[] => {
  try {
    const v = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export async function listNotes(): Promise<{ notes: VisitorNote[]; shared: boolean }> {
  if (hasDatabase()) {
    // loaded only when there's a database to talk to; the client throws without one
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.from("visitor_notes").select("id, name, message, created_at").order("created_at", { ascending: false }).limit(SHOWN);
    if (!error && data) return { notes: data, shared: true };
    console.warn("Visitor notes: couldn't read the database, showing this browser's notes.", error?.message);
  }
  return { notes: readLocal(), shared: false };
}

export async function addNote(name: string, message: string): Promise<{ note: VisitorNote; shared: boolean }> {
  const clean = {
    name: name.trim().slice(0, NAME_LIMIT) || "A visitor",
    message: message.trim().slice(0, NOTE_LIMIT),
  };
  if (!clean.message) throw new Error("Write something first.");
  if (hasDatabase()) {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.from("visitor_notes").insert(clean).select("id, name, message, created_at").single();
    if (!error && data) return { note: data, shared: true };
    console.warn("Visitor notes: couldn't save to the database, keeping the note in this browser.", error?.message);
  }
  const note: VisitorNote = { id: `local-${Date.now()}`, ...clean, created_at: new Date().toISOString() };
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify([note, ...readLocal()].slice(0, 30)));
  } catch {
    // not kept
  }
  return { note, shared: false };
}
