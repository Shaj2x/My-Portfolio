import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUp, X } from "lucide-react";
import { answer, starters, type Reply } from "@/assistant/engine";
import { demoVideos, displayNames } from "@/data/portfolio";
import { WatchDemo } from "@/components/DemoVideo";

/**
 * "Ask me anything": a chat about me that runs entirely in the page. Answers come from what I've
 * written down (src/assistant), never from an AI service, so nothing typed here is sent anywhere.
 */

interface Message {
  id: number;
  from: "me" | "them";
  text: string;
  reply?: Reply;
}

/** **bold** runs, kept as plain text otherwise */
const rich = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );

const Paragraphs = ({ text }: { text: string }) => (
  <>
    {text.split("\n\n").map((para, i) => (
      <p key={i} className={i ? "mt-2" : ""}>
        {para.split("\n").map((line, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {rich(line)}
          </Fragment>
        ))}
      </p>
    ))}
  </>
);

const chip = "rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs text-white/85 transition-colors duration-150 hover:border-amber-200/50 hover:bg-white/10 hover:text-white";

export const AskMe = ({ onClose, pagesInNewTab = false, className = "" }: { onClose: () => void; pagesInNewTab?: boolean; className?: string }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const next = useRef(1);
  const timer = useRef<number>();
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    return () => window.clearTimeout(timer.current);
  }, []);
  // keep the newest message in view
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, thinking, reduce]);

  const ask = (question: string) => {
    const q = question.trim().slice(0, 300);
    if (!q || thinking) return;
    setDraft("");
    setMessages((m) => [...m, { id: next.current++, from: "them", text: q }]);
    const reply = answer(q);
    // a short pause, as if typing; longer answers take a touch longer
    setThinking(true);
    timer.current = window.setTimeout(
      () => {
        setThinking(false);
        setMessages((m) => [...m, { id: next.current++, from: "me", text: reply.text, reply }]);
      },
      reduce ? 0 : Math.min(900, 350 + reply.text.length * 1.5),
    );
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(draft);
  };

  const last = messages[messages.length - 1];
  const suggestions = !messages.length ? starters : last?.from === "me" && !thinking ? last.reply?.follow ?? [] : [];

  const link = (href: string, label: string) => {
    const page = href.startsWith("/") && !href.endsWith(".pdf");
    const newTab = !href.startsWith("mailto:") && (!page || pagesInNewTab);
    return (
      <a key={href} href={href} target={newTab ? "_blank" : undefined} rel={newTab ? "noopener noreferrer" : undefined} className="rounded-full bg-amber-200 px-3 py-1.5 text-xs font-semibold text-[#1a1206] transition-colors duration-150 hover:bg-amber-100">
        {label}
      </a>
    );
  };

  const bubble = (m: Message): ReactNode =>
    m.from === "them" ? (
      <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-amber-200 px-3.5 py-2 text-sm text-[#1a1206]">
        {m.text}
      </div>
    ) : (
      <div key={m.id} className="max-w-[92%]">
        <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm leading-relaxed text-white/80">
          <Paragraphs text={m.text} />
        </div>
        {(m.reply?.links?.length || m.reply?.video) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.reply?.video && demoVideos[m.reply.video] && (
              <WatchDemo video={demoVideos[m.reply.video]} title={displayNames[m.reply.video] ?? m.reply.video} className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 [&_svg]:h-3.5 [&_svg]:w-3.5" />
            )}
            {m.reply?.links?.map((l) => link(l.href, l.label))}
          </div>
        )}
      </div>
    );

  return (
    <section className={`flex max-h-[min(640px,calc(100dvh-24px))] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] liquid-glass-panel text-white ${className}`} aria-label="Ask me anything">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-[#c87a3a] text-xs font-bold text-[#1a1206]" aria-hidden="true">
          SS
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Ask me anything</p>
          <p className="truncate text-xs text-white/50">Answers I wrote myself. Private to this page.</p>
        </div>
        <button type="button" aria-label="Close" className="rounded-full p-1.5 text-white/60 transition-colors duration-150 hover:bg-white/10 hover:text-white" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={log} role="log" aria-live="polite" className="flex min-h-[180px] flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4">
        {!messages.length && (
          <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm leading-relaxed text-white/80">
            Hey, I'm Shajith. Ask me about my projects, internships, skills or school. If I haven't written an answer to something, I'll say so.
          </div>
        )}
        {messages.map(bubble)}
        {thinking && (
          <div className="flex w-fit gap-1 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-3.5 py-3" aria-label="Typing">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/60 motion-safe:animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {suggestions.map((s) => (
            <button key={s} type="button" className={chip} onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/10 p-3">
        <label htmlFor="ask-me-input" className="sr-only">
          Your question
        </label>
        <input
          id="ask-me-input"
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={300}
          autoComplete="off"
          placeholder="Ask about my projects, skills, school…"
          className="h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-white/40 focus:border-amber-200/60 focus:outline-none"
        />
        <button type="submit" aria-label="Send" disabled={!draft.trim() || thinking} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-200 text-[#1a1206] transition-[background-color,opacity,transform] duration-150 hover:bg-amber-100 active:scale-95 disabled:opacity-40">
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
};
