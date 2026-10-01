import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { addNote, listNotes, NAME_LIMIT, NOTE_LIMIT, type VisitorNote } from "./visitorNotes";

/*
 * The desk keyboard, up close: an off-white 65% board with cream keys and dusty-blue modifiers,
 * like his. Every key goes down with a soft spring and a creamy "thock", whether it's clicked or
 * pressed on a real keyboard, and what's typed becomes a note to leave for him.
 */

type Key = { label: string; code: string; w?: number; mod?: boolean; char?: string };

const k = (label: string, code: string, w = 1, mod = false, char?: string): Key => ({ label, code, w, mod, char });
const letters = (s: string) => s.split("").map((c) => k(c.toUpperCase(), `Key${c.toUpperCase()}`, 1, false, c));

const ROWS: Key[][] = [
  [k("`", "Backquote", 1, false, "`"), ...["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((n) => k(n, `Digit${n}`, 1, false, n)), k("-", "Minus", 1, false, "-"), k("=", "Equal", 1, false, "="), k("⌫", "Backspace", 2, true)],
  [k("Tab", "Tab", 1.5, true), ...letters("qwertyuiop"), k("[", "BracketLeft", 1, false, "["), k("]", "BracketRight", 1, false, "]"), k("\\", "Backslash", 1.5, true, "\\")],
  [k("Caps", "CapsLock", 1.75, true), ...letters("asdfghjkl"), k(";", "Semicolon", 1, false, ";"), k("'", "Quote", 1, false, "'"), k("Enter", "Enter", 2.25, true)],
  [k("Shift", "ShiftLeft", 2.25, true), ...letters("zxcvbnm"), k(",", "Comma", 1, false, ","), k(".", "Period", 1, false, "."), k("/", "Slash", 1, false, "/"), k("Shift", "ShiftRight", 2.75, true)],
  [k("Ctrl", "ControlLeft", 1.5, true), k("Alt", "AltLeft", 1.5, true), k("", "Space", 9, false, " "), k("Alt", "AltRight", 1.5, true), k("Ctrl", "ControlRight", 1.5, true)],
];

/** a creamy thock: a damped low body under a short, soft, low-passed click; heavier for big keys */
const useThock = (muted: boolean) => {
  const ctx = useRef<AudioContext | null>(null);
  return useCallback(
    (weight: number) => {
      if (muted) return;
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const c = (ctx.current ??= new AC());
      if (c.state === "suspended") void c.resume();
      const t = c.currentTime;
      const vary = 0.92 + Math.random() * 0.16;
      // the body: a short sine drop, deeper for the spacebar and the long modifiers
      const body = c.createOscillator();
      body.type = "sine";
      body.frequency.setValueAtTime((210 - weight * 18) * vary, t);
      body.frequency.exponentialRampToValueAtTime((95 - weight * 6) * vary, t + 0.06);
      const bodyGain = c.createGain();
      bodyGain.gain.setValueAtTime(0.0001, t);
      bodyGain.gain.exponentialRampToValueAtTime(0.32, t + 0.004);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      body.connect(bodyGain).connect(c.destination);
      body.start(t);
      body.stop(t + 0.1);
      // the creamy top: a burst of noise, low-passed so it's muted rather than clacky
      const len = Math.floor(c.sampleRate * 0.04);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
      const noise = c.createBufferSource();
      noise.buffer = buf;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = (1700 - weight * 120) * vary;
      lp.Q.value = 1.2;
      const ng = c.createGain();
      ng.gain.value = 0.38;
      noise.connect(lp).connect(ng).connect(c.destination);
      noise.start(t);
      // and a quiet bottom-out tick a moment later, the key landing
      const tick = c.createOscillator();
      tick.type = "triangle";
      tick.frequency.value = 520 * vary;
      const tg = c.createGain();
      tg.gain.setValueAtTime(0.0001, t + 0.012);
      tg.gain.exponentialRampToValueAtTime(0.05, t + 0.014);
      tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      tick.connect(tg).connect(c.destination);
      tick.start(t + 0.012);
      tick.stop(t + 0.035);
    },
    [muted],
  );
};

const when = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

export interface FidgetKeyboardProps {
  onClose: () => void;
  muted?: boolean;
}

export const FidgetKeyboard = ({ onClose, muted = false }: FidgetKeyboardProps) => {
  const [down, setDown] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState<VisitorNote[]>([]);
  const [shared, setShared] = useState(true);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [caps, setCaps] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const thock = useThock(muted);

  useEffect(() => {
    listNotes().then((r) => {
      setNotes(r.notes);
      setShared(r.shared);
    });
    area.current?.focus();
  }, []);

  const keyWeight = (code: string) => (code === "Space" ? 3 : ROWS.flat().find((x) => x.code === code)?.w ?? 1);
  const press = useCallback(
    (code: string) => {
      thock(keyWeight(code));
      setDown((s) => new Set(s).add(code));
    },
    [thock],
  );
  const release = useCallback((code: string) => {
    setDown((s) => {
      const n = new Set(s);
      n.delete(code);
      return n;
    });
  }, []);

  // the real keyboard moves the keys and makes the sound; typing itself lands in whichever field has focus
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (!e.repeat) press(e.code);
    };
    const onUp = (e: KeyboardEvent) => release(e.code);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [press, release, onClose]);

  // clicking the keys types into the note
  const tap = (key: Key) => {
    press(key.code);
    window.setTimeout(() => release(key.code), 110);
    if (status === "sent") setStatus("idle");
    setMessage((m) => {
      if (key.code === "Backspace") return m.slice(0, -1);
      if (key.code === "Enter") return (m + "\n").slice(0, NOTE_LIMIT);
      if (key.code === "Tab") return (m + "  ").slice(0, NOTE_LIMIT);
      if (key.code === "CapsLock") {
        setCaps((c) => !c);
        return m;
      }
      if (!key.char) return m;
      return (m + (caps ? key.char.toUpperCase() : key.char)).slice(0, NOTE_LIMIT);
    });
  };

  const send = async () => {
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    try {
      const r = await addNote(name, message);
      setNotes((n) => [r.note, ...n]);
      setShared(r.shared);
      setMessage("");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-label="Leave a note">
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-4 overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">The keyboard</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Leave me a note</h2>
            <p className="mt-1 text-sm text-white/60">Type on it, or just click the keys. It's a good fidget.</p>
          </div>
          <button type="button" aria-label="Close (Esc)" className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* the note, like a sticky note on the desk */}
        <div className="grid gap-3 rounded-2xl bg-[#fff6c9] p-4 text-[#2a2620] shadow-[0_10px_30px_rgba(0,0,0,0.35)] sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <textarea
              id="note-message"
              ref={area}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value.slice(0, NOTE_LIMIT));
                if (status === "sent") setStatus("idle");
              }}
              rows={3}
              placeholder="Say hi, leave a song rec, tell me what you'd build…"
              className="w-full resize-none bg-transparent font-mono text-base leading-relaxed placeholder:text-[#2a2620]/40 focus:outline-none"
              aria-label="Your note"
            />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label htmlFor="note-name" className="text-[#2a2620]/60">
                From
              </label>
              <input id="note-name" value={name} onChange={(e) => setName(e.target.value.slice(0, NAME_LIMIT))} placeholder="your name (optional)" className="min-w-0 flex-1 border-b border-[#2a2620]/20 bg-transparent py-0.5 focus:border-[#2a2620]/60 focus:outline-none" />
              <span className="font-mono text-xs text-[#2a2620]/50 tabular-nums">
                {message.length}/{NOTE_LIMIT}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={send}
            disabled={!message.trim() || status === "sending"}
            className="rounded-full bg-[#2a2620] px-6 py-2.5 text-sm font-semibold text-[#fff6c9] transition hover:bg-black disabled:opacity-40"
          >
            {status === "sending" ? "Pinning…" : status === "sent" ? "Pinned ✓" : "Pin it"}
          </button>
          {status === "error" && <p className="text-sm text-red-700 sm:col-span-2">That didn't go through. Check your connection and try again.</p>}
        </div>

        {/* the board */}
        <div className="rounded-[22px] bg-gradient-to-b from-[#eeebe4] to-[#d9d5cc] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-4">
          <div className="grid gap-1.5 sm:gap-2">
            {ROWS.map((row, r) => (
              <div key={r} className="flex gap-1.5 sm:gap-2">
                {row.map((key) => {
                  const pressed = down.has(key.code) || (key.code === "CapsLock" && caps);
                  return (
                    <button
                      key={key.code}
                      type="button"
                      tabIndex={-1}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        tap(key);
                      }}
                      style={{ flexGrow: key.w, flexBasis: 0 }}
                      aria-label={key.label || "Space"}
                      className={`relative h-9 min-w-0 select-none rounded-[9px] text-[11px] font-medium transition-[transform,box-shadow] duration-75 ease-out sm:h-12 sm:text-sm ${
                        key.mod ? "bg-[#8c9cb8] text-white/90" : "bg-[#f6f4ee] text-[#4a4a50]"
                      } ${
                        pressed
                          ? "translate-y-[3px] shadow-[0_0_0_rgba(0,0,0,0.25),inset_0_2px_3px_rgba(0,0,0,0.12)]"
                          : "shadow-[0_3px_0_rgba(0,0,0,0.22),0_4px_6px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.7)]"
                      }`}
                    >
                      <span className="pointer-events-none truncate px-1">{key.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* the notes left so far */}
        <section className="space-y-3 pb-2">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">Notes left on the desk</h3>
            {!shared && <p className="text-xs text-white/45">Preview: notes stay in this browser.</p>}
          </div>
          {notes.length === 0 ? (
            <p className="text-sm text-white/55">No notes yet. Be the first.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {notes.map((n, i) => (
                <article key={n.id} className="rounded-xl bg-[#fff6c9] p-3 text-[#2a2620] shadow-md" style={{ transform: `rotate(${((i * 37) % 5) - 2}deg)` }}>
                  <p className="whitespace-pre-wrap break-words font-mono text-sm">{n.message}</p>
                  <p className="mt-2 text-xs text-[#2a2620]/60">
                    {n.name} · {when(n.created_at)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default FidgetKeyboard;
