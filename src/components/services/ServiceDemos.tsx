import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Bot, CalendarCheck, Check, Mail, Pause, Phone, Play, Send, UserPlus } from "lucide-react";

/*
 * Small live pieces of the real work for the services page: what each service actually does on
 * screen, not a picture of a mood. Every loop has a pause button or stops after one pass, and under
 * reduced motion each one rests on its finished state.
 */

/** steps through `count` stages every `ms`, holding the last one for `hold` before starting again */
const useStage = (count: number, ms: number, hold: number, playing: boolean) => {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(reduce ? count : 0);
  useEffect(() => {
    if (reduce) {
      setStage(count);
      return;
    }
    if (!playing) return;
    const t = window.setTimeout(() => setStage((s) => (s >= count ? 0 : s + 1)), stage >= count ? hold : ms);
    return () => window.clearTimeout(t);
  }, [stage, playing, reduce, count, ms, hold]);
  return { stage, reduce: !!reduce };
};

const CALL = [
  { from: "caller", text: "Hi, do you have anything open Thursday afternoon?" },
  { from: "ai", text: "Yes, 3:30 or 4:15. Which works better for you?" },
  { from: "caller", text: "3:30, please." },
  { from: "ai", text: "You're booked for Thursday at 3:30. I've texted you a confirmation." },
] as const;

/** the hero's piece: an AI receptionist taking a call and booking it, on a loop with a pause button */
export const ReceptionistCall = ({ compact = false }: { compact?: boolean }) => {
  const [playing, setPlaying] = useState(true);
  const { stage, reduce } = useStage(CALL.length + 1, 1700, 3200, playing);
  const shown = CALL.slice(0, Math.min(stage, CALL.length));
  const booked = stage > CALL.length;
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#121317]/90 shadow-[0_30px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
      <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
        <span className="relative grid h-9 w-9 place-items-center rounded-full bg-amber-200 text-[#1a1206]">
          <Phone className="h-4 w-4" aria-hidden="true" />
          {!reduce && !booked && <span className="absolute inset-0 animate-ping rounded-full bg-amber-200/40" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{booked ? "Call ended" : "Incoming call"}</p>
          <p className="text-xs text-white/55">Answered by your AI receptionist</p>
        </div>
        {!reduce && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause the call demo" : "Play the call demo"}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/75 transition-colors hover:border-white/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
          >
            {playing ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        )}
      </div>
      <div className={`flex flex-col gap-2.5 px-4 py-4 ${compact ? "min-h-[232px]" : "min-h-[272px]"}`} aria-live="polite">
        {shown.map((line, i) => (
          <p
            key={i}
            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-snug motion-safe:animate-[bubble-in_320ms_cubic-bezier(0.23,1,0.32,1)] ${
              line.from === "ai" ? "self-start rounded-bl-md bg-white/[0.07] text-white/85" : "self-end rounded-br-md bg-amber-200/90 text-[#1a1206]"
            }`}
          >
            <span className="sr-only">{line.from === "ai" ? "AI receptionist: " : "Caller: "}</span>
            {line.text}
          </p>
        ))}
      </div>
      <div
        className={`flex items-center gap-3 border-t border-white/[0.08] px-4 py-3 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${booked ? "opacity-100" : "translate-y-1 opacity-0"}`}
        aria-hidden={!booked}
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">
          <CalendarCheck className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Booked: Thursday, 3:30 PM</p>
          <p className="text-xs text-white/55">Added to your calendar · confirmation texted</p>
        </div>
      </div>
    </div>
  );
};

/** automation: a new lead goes in, and three jobs run from it in parallel, pulses along the lines */
export const AutomationLanes = () => {
  const reduce = useReducedMotion();
  const lanes = [
    { y: 46, icon: Mail, label: "Reply email sent" },
    { y: 120, icon: UserPlus, label: "Added to your CRM" },
    { y: 194, icon: CalendarCheck, label: "Follow-up booked" },
  ];
  return (
    <>
    {/* phones: the same flow, top to bottom */}
    <div className="sm:hidden">
      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#17181d] px-3 py-2.5 text-sm text-white/85">
        <UserPlus className="h-4 w-4 text-amber-200" aria-hidden="true" /> New lead
      </div>
      <div className="ml-5 h-5 w-px bg-amber-200/40" aria-hidden="true" />
      <div className="flex items-center gap-2 text-sm text-white/85">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-200 text-[#1a1206] shadow-[0_0_24px_rgba(253,230,138,0.35)]">
          <Bot className="h-5 w-5" aria-hidden="true" />
        </span>
        AI reads it and acts
      </div>
      <ul className="ml-5 border-l border-amber-200/40 pl-4 pt-2">
        {lanes.map((l) => (
          <li key={l.label} className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-[#17181d] px-3 py-2.5 text-sm text-white/85">
            <l.icon className="h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" /> {l.label}
          </li>
        ))}
      </ul>
    </div>
    <div className="relative hidden sm:block">
      <svg viewBox="0 0 520 240" className="h-auto w-full" role="img" aria-label="A new lead goes to an AI step, which sends a reply email, adds the lead to your CRM and books a follow-up">
        {lanes.map((l, i) => {
          const d = `M 168 120 C 230 120 230 ${l.y} 292 ${l.y}`;
          return (
            <g key={l.label}>
              <path d="M 92 120 L 168 120" stroke="rgba(253,230,138,0.35)" strokeWidth="1.5" fill="none" />
              <path d={d} stroke="rgba(253,230,138,0.35)" strokeWidth="1.5" fill="none" />
              {!reduce && (
                <circle r="3.5" fill="#fde68a">
                  <animateMotion dur="2.8s" begin={`${i * 0.35}s`} repeatCount="indefinite" path={`M 92 120 L 168 120 ${d.replace("M 168 120 ", "")}`} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                </circle>
              )}
            </g>
          );
        })}
      </svg>
      {/* the nodes, as HTML so the type stays crisp */}
      <div className="pointer-events-none absolute inset-0 text-[11px] sm:text-xs">
        <div className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-xl border border-white/15 bg-[#17181d] px-2.5 py-2 text-white/85">
          <UserPlus className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" /> New lead
        </div>
        <div className="absolute left-[32%] top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-amber-200 text-[#1a1206] shadow-[0_0_30px_rgba(253,230,138,0.35)]">
          <Bot className="h-5 w-5" aria-hidden="true" />
        </div>
        {lanes.map((l) => (
          <div key={l.label} className="absolute right-0 flex -translate-y-1/2 items-center gap-2 rounded-xl border border-white/15 bg-[#17181d] px-2.5 py-2 text-white/85" style={{ top: `${(l.y / 240) * 100}%`, left: "56%" }}>
            <l.icon className="h-3.5 w-3.5 shrink-0 text-amber-200" aria-hidden="true" />
            <span className="truncate">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
    </>
  );
};

/** a website being put together: blocks settle into a page */
export const WebsiteBuild = () => (
  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#f5f1ea] text-[#1a1714] shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
    <div className="flex items-center gap-1.5 border-b border-black/10 bg-[#ebe5db] px-3 py-2">
      {["#ef6b5b", "#f2b544", "#5cc46b"].map((c) => (
        <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
      ))}
      <span className="ml-3 truncate rounded-md bg-white/70 px-2 py-0.5 text-[10px] text-black/55">yourbusiness.com</span>
    </div>
    <div className="grid gap-3 p-4 sm:grid-cols-[1.2fr_1fr]">
      <div className="motion-safe:animate-[block-in_600ms_cubic-bezier(0.23,1,0.32,1)_both]">
        <div className="h-2.5 w-16 rounded-full bg-[#c2410c]/70" />
        <div className="mt-3 h-5 w-[90%] rounded-md bg-[#1a1714]" />
        <div className="mt-2 h-5 w-[70%] rounded-md bg-[#1a1714]" />
        <div className="mt-3 space-y-1.5">
          <div className="h-2 w-full rounded-full bg-black/15" />
          <div className="h-2 w-[85%] rounded-full bg-black/15" />
        </div>
        <div className="mt-4 inline-flex rounded-full bg-[#c2410c] px-3 py-1.5 text-[10px] font-semibold text-white">Book now</div>
      </div>
      <div className="aspect-[4/3] rounded-xl bg-[linear-gradient(135deg,#fdba74,#c2410c)] motion-safe:animate-[block-in_600ms_cubic-bezier(0.23,1,0.32,1)_120ms_both]" />
      <div className="grid grid-cols-3 gap-2 sm:col-span-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg bg-white p-2 shadow-sm motion-safe:animate-[block-in_600ms_cubic-bezier(0.23,1,0.32,1)_both]" style={{ animationDelay: `${220 + i * 80}ms` }}>
            <div className="h-8 rounded-md bg-black/[0.07]" />
            <div className="mt-2 h-1.5 w-[80%] rounded-full bg-black/15" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

/** brand identity: a mark, its colours and its type */
export const BrandKit = () => (
  <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
    <div className="grid aspect-square place-items-center rounded-2xl bg-[#1d3b2a] motion-safe:animate-[block-in_600ms_cubic-bezier(0.23,1,0.32,1)_both]">
      <svg viewBox="0 0 80 80" className="h-24 w-24" aria-hidden="true">
        <circle cx="40" cy="40" r="30" fill="none" stroke="#f3d9a4" strokeWidth="6" />
        <path d="M 26 48 L 40 26 L 54 48 Z" fill="#f3d9a4" />
      </svg>
    </div>
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-2">
        {["#1d3b2a", "#f3d9a4", "#c96f3b", "#f7f3ec"].map((c, i) => (
          <div key={c} className="motion-safe:animate-[block-in_500ms_cubic-bezier(0.23,1,0.32,1)_both]" style={{ animationDelay: `${120 + i * 70}ms` }}>
            <div className="aspect-square rounded-xl border border-white/10" style={{ background: c }} />
            <p className="mt-1 text-center font-mono text-[9px] uppercase text-white/50">{c.slice(1)}</p>
          </div>
        ))}
      </div>
      <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] p-4 motion-safe:animate-[block-in_600ms_cubic-bezier(0.23,1,0.32,1)_400ms_both]">
        <p className="text-4xl font-bold leading-none tracking-[-0.04em] text-[#f3d9a4]">Aa</p>
        <p className="mt-2 text-xs text-white/60">Headings, body text, colours and spacing, written down in one guide.</p>
      </div>
    </div>
  </div>
);

/** a voice agent on an outbound call: a live waveform and what it's doing */
export const VoiceAgent = () => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
    <div className="flex items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        <span className="h-2 w-2 rounded-full bg-emerald-400 motion-safe:animate-pulse" aria-hidden="true" /> Outbound call
      </p>
      <p className="text-xs text-white/55">Qualifying a new lead</p>
    </div>
    <div className="mt-5 flex h-20 items-center justify-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          className="w-[5px] origin-center rounded-full bg-amber-200/80 motion-safe:animate-[voice-bar_1.1s_ease-in-out_infinite]"
          style={{ height: `${18 + Math.abs(Math.sin(i * 0.9)) * 62}%`, animationDelay: `${(i % 9) * -0.12}s` }}
        />
      ))}
    </div>
    <ul className="mt-5 space-y-2 text-sm">
      {["Asks what the caller needs", "Checks it against your services", "Books the meeting on your calendar"].map((t) => (
        <li key={t} className="flex items-center gap-2 text-white/75">
          <Check className="h-4 w-4 text-amber-200" aria-hidden="true" /> {t}
        </li>
      ))}
    </ul>
  </div>
);

/** a custom AI tool: a question about your own data and its answer */
export const CustomAI = () => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-amber-200/90 px-3.5 py-2 text-sm text-[#1a1206] motion-safe:animate-[bubble-in_320ms_cubic-bezier(0.23,1,0.32,1)_both]">
      Which services did customers book most last month?
    </p>
    <div className="mt-3 max-w-[92%] rounded-2xl rounded-bl-md bg-white/[0.07] p-3.5 motion-safe:animate-[bubble-in_320ms_cubic-bezier(0.23,1,0.32,1)_350ms_both]">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
        <Bot className="h-3.5 w-3.5" aria-hidden="true" /> From your booking data
      </p>
      <div className="mt-3 space-y-2">
        {[
          ["Haircut", 88],
          ["Colour", 61],
          ["Beard trim", 42],
        ].map(([label, w], i) => (
          <div key={label as string} className="grid grid-cols-[72px_1fr] items-center gap-2 text-xs text-white/70">
            <span>{label}</span>
            <span className="h-2.5 rounded-full bg-white/[0.06]">
              <span className="block h-full origin-left rounded-full bg-amber-200 motion-safe:animate-[bar-grow_700ms_cubic-bezier(0.23,1,0.32,1)_both]" style={{ width: `${w}%`, animationDelay: `${500 + i * 120}ms` }} />
            </span>
          </div>
        ))}
      </div>
    </div>
    <div className="mt-3 flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-white/40">
      Ask about your business… <Send className="ml-auto h-3.5 w-3.5" aria-hidden="true" />
    </div>
  </div>
);
