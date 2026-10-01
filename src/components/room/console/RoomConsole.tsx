import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Briefcase,
  ExternalLink,
  FileText,
  Gamepad2,
  Github,
  Linkedin,
  Mail,
  Sparkles,
  Trophy,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import PongGame from "@/components/PongGame";
import SnakeGame from "@/components/SnakeGame";
import {
  aboutParagraphs,
  customDescriptions,
  demoLinks,
  education,
  experience,
  GITHUB_USERNAME,
  inProgressRepos,
  profile,
  roles,
  services,
  skillCategories,
} from "@/data/portfolio";

/*
 * The PS5 on the desk, as a console you can drive: a home screen with Games and Portfolio rows,
 * the selected tile's art filling the background, and each tile opening a game or a page of the
 * portfolio. It plays with the keyboard, the mouse, or a real controller (Gamepad API).
 */

type ItemId =
  | "pong"
  | "snake"
  | "slots"
  | "blackjack"
  | "mercatus"
  | "about"
  | "projects"
  | "experience"
  | "resume"
  | "leadership"
  | "skills"
  | "services"
  | "contact";

interface Item {
  id: ItemId;
  title: string;
  /** one line under the title on the home screen */
  blurb: string;
  icon: LucideIcon;
  /** two colours for the tile and the background art */
  art: [string, string];
  /** a game that lives on its own site */
  site?: string;
  action: string;
}

const GAMES: Item[] = [
  { id: "pong", title: "Pong", blurb: "First to 5 against the CPU. Move with W/S, the arrow keys, or the D-pad.", icon: Gamepad2, art: ["#d4202c", "#2a0507"], action: "Play" },
  { id: "snake", title: "Snake", blurb: "Eat the SS logo to grow. Steer with WASD, the arrow keys, or the D-pad.", icon: Gamepad2, art: ["#1f9d55", "#03200f"], action: "Play" },
  { id: "slots", title: "Raptors Slot Machine", blurb: "A Toronto Raptors slot machine, built for the browser.", icon: Trophy, art: ["#ce1141", "#1a0207"], site: demoLinks["Raptors-Slot-Machine"], action: "Play" },
  { id: "blackjack", title: "Raptors BlackJack", blurb: "Blackjack at a Raptors table.", icon: Trophy, art: ["#a1a1a4", "#1c0b0d"], site: demoLinks["Raptors-BlackJack"], action: "Play" },
  { id: "mercatus", title: "Mercatus", blurb: customDescriptions["Mercatus"], icon: Sparkles, art: ["#e2a33a", "#1d1204"], site: demoLinks["Mercatus"], action: "Play" },
];

const PORTFOLIO: Item[] = [
  { id: "about", title: "About Me", blurb: profile.tagline, icon: User, art: ["#7a4fdc", "#120a26"], action: "Open" },
  { id: "projects", title: "Projects", blurb: "What I've built, live from GitHub.", icon: Github, art: ["#2f6fd6", "#06122b"], action: "Open" },
  { id: "experience", title: "Experience", blurb: "Education and work, from Western back to the Brampton Library.", icon: Briefcase, art: ["#d6602f", "#220c03"], action: "Open" },
  { id: "resume", title: "Resume", blurb: "Everything on one page.", icon: FileText, art: ["#e8e8ea", "#1a1a1e"], action: "Open" },
  { id: "leadership", title: "Leadership", blurb: "Council president, association president, campaign lead.", icon: BadgeCheck, art: ["#c9a24a", "#1f1705"], action: "Open" },
  { id: "skills", title: "Skills", blurb: "Languages, tools, and the creative side.", icon: Wrench, art: ["#36a2e8", "#041a2a"], action: "Open" },
  { id: "services", title: "Services", blurb: "AI receptionists, automation, websites and brands.", icon: Sparkles, art: ["#4fe3b0", "#03201a"], action: "Open" },
  { id: "contact", title: "Contact", blurb: "Email, GitHub and LinkedIn.", icon: Mail, art: ["#ff6fa8", "#2a0716"], action: "Open" },
];

const TABS = [
  { id: "games", label: "Games", items: GAMES },
  { id: "portfolio", label: "Portfolio", items: PORTFOLIO },
] as const;

type Action = "left" | "right" | "up" | "down" | "confirm" | "back" | "prevTab" | "nextTab" | "home";

// ---------- small presentational pieces ----------

/** PlayStation face-button glyphs, drawn in the console's own monochrome style */
const Glyph = ({ kind }: { kind: "cross" | "circle" | "l1" | "r1" | "dpad" }) => {
  if (kind === "l1" || kind === "r1" || kind === "dpad")
    return <span className="rounded border border-white/40 px-1 font-mono text-[10px] leading-4 text-white/80">{kind === "dpad" ? "◀ ▶" : kind.toUpperCase()}</span>;
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeOpacity="0.5" />
      {kind === "cross" ? <path d="M6.5 6.5l7 7M13.5 6.5l-7 7" stroke="currentColor" strokeWidth="1.6" /> : <circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />}
    </svg>
  );
};

const Hint = ({ glyph, children }: { glyph: Parameters<typeof Glyph>[0]["kind"]; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5">
    <Glyph kind={glyph} />
    {children}
  </span>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">{title}</h3>
    {children}
  </section>
);

const Card = ({ children }: { children: ReactNode }) => <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">{children}</div>;

const LinkButton = ({ href, children }: { href: string; children: ReactNode }) => (
  <a
    href={href}
    target={href.startsWith("mailto:") ? undefined : "_blank"}
    rel="noopener noreferrer"
    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-white/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
  >
    {children}
  </a>
);

const Timeline = ({ items }: { items: { title: string; org: string; date?: string; description: string }[] }) => (
  <div className="space-y-3">
    {items.map((it) => (
      <Card key={it.title + it.org}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold text-white">{it.title}</p>
          {it.date && <p className="font-mono text-xs text-white/50">{it.date}</p>}
        </div>
        <p className="text-sm text-[#7fb2ff]">{it.org}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-white/70">{it.description}</p>
      </Card>
    ))}
  </div>
);

// ---------- the pages behind each tile ----------

interface Repo {
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
}

/** live from GitHub where the network allows it; otherwise the projects the portfolio links to */
const ProjectsPage = () => {
  const fallback = useMemo<Repo[]>(
    () =>
      [...Object.keys(demoLinks), ...inProgressRepos].map((name) => ({
        name,
        description: customDescriptions[name] ?? null,
        html_url: `https://github.com/${GITHUB_USERNAME}/${name}`,
        language: null,
      })),
    [],
  );
  const [repos, setRepos] = useState<Repo[]>(fallback);
  useEffect(() => {
    let live = true;
    fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=12`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Repo[]) => {
        if (live) setRepos(data.filter((r) => r.name !== GITHUB_USERNAME && r.name !== `${GITHUB_USERNAME}.github.io`));
      })
      .catch(() => {
        // offline or blocked: keep the built-in list
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {repos.map((r) => (
          <Card key={r.name}>
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 break-words font-semibold text-white">{r.name.replace(/-+/g, " ")}</p>
              {inProgressRepos.includes(r.name) && <span className="shrink-0 rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">In progress</span>}
            </div>
            {r.description && <p className="mt-1.5 text-sm text-white/70">{r.description}</p>}
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {demoLinks[r.name] && (
                <a className="inline-flex items-center gap-1 text-[#7fb2ff] hover:text-white" href={demoLinks[r.name]} target="_blank" rel="noopener noreferrer">
                  <Gamepad2 className="h-4 w-4" /> Live demo
                </a>
              )}
              <a className="inline-flex items-center gap-1 text-white/60 hover:text-white" href={r.html_url} target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4" /> Code
              </a>
            </div>
          </Card>
        ))}
      </div>
      <LinkButton href={profile.github}>
        <Github className="h-4 w-4" /> Everything on GitHub
      </LinkButton>
    </div>
  );
};

const ResumePage = () => (
  <div className="space-y-6">
    <header className="space-y-1 border-b border-white/10 pb-4">
      <p className="text-2xl font-bold text-white">{profile.name}</p>
      <p className="text-sm text-white/70">{profile.tagline}</p>
      <p className="select-all font-mono text-xs text-white/50">
        {profile.email} · github.com/{GITHUB_USERNAME}
      </p>
    </header>
    <Section title="Education">
      <Timeline items={education} />
    </Section>
    <Section title="Experience">
      <Timeline items={experience} />
    </Section>
    <Section title="Leadership">
      <Timeline items={roles} />
    </Section>
    <Section title="Skills">
      <div className="grid gap-3 sm:grid-cols-2">
        {skillCategories.map((c) => (
          <Card key={c.title}>
            <p className="mb-1 text-sm font-semibold text-white">{c.title}</p>
            <p className="text-sm text-white/70">{c.skills.join(" · ")}</p>
          </Card>
        ))}
      </div>
    </Section>
    {profile.resumePdf && (
      <LinkButton href={profile.resumePdf}>
        <FileText className="h-4 w-4" /> Download the PDF
      </LinkButton>
    )}
  </div>
);

const ContactPage = () => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(profile.email).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-white/60">Email</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <p className="select-all font-mono text-lg text-white">{profile.email}</p>
          <button type="button" onClick={copy} className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:border-white/50 hover:text-white">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </Card>
      <div className="flex flex-wrap gap-3">
        <LinkButton href={`mailto:${profile.email}`}>
          <Mail className="h-4 w-4" /> Write to me
        </LinkButton>
        <LinkButton href={profile.linkedin}>
          <Linkedin className="h-4 w-4" /> LinkedIn
        </LinkButton>
        <LinkButton href={profile.github}>
          <Github className="h-4 w-4" /> GitHub
        </LinkButton>
      </div>
    </div>
  );
};

const ItemPage = ({ item, embedSites }: { item: Item; embedSites: boolean }) => {
  switch (item.id) {
    case "pong":
      return <PongGame />;
    case "snake":
      return <SnakeGame />;
    case "about":
      return (
        <div className="space-y-4 text-base leading-relaxed text-white/75">
          {aboutParagraphs.map((runs, i) => (
            <p key={i}>
              {runs.map((r, j) =>
                r.strong ? (
                  <span key={j} className="font-semibold text-white">
                    {r.text}
                  </span>
                ) : (
                  r.text
                ),
              )}
            </p>
          ))}
        </div>
      );
    case "projects":
      return <ProjectsPage />;
    case "experience":
      return (
        <div className="space-y-6">
          <Section title="Education">
            <Timeline items={education} />
          </Section>
          <Section title="Work">
            <Timeline items={experience} />
          </Section>
        </div>
      );
    case "resume":
      return <ResumePage />;
    case "leadership":
      return <Timeline items={roles} />;
    case "skills":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {skillCategories.map((c) => (
            <Card key={c.title}>
              <p className="mb-3 text-sm font-semibold text-white">{c.title}</p>
              <div className="flex flex-wrap gap-2">
                {c.skills.map((s) => (
                  <span key={s} className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/85">
                    {s}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      );
    case "services":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <Card key={s.title}>
              <s.icon className="mb-2 h-5 w-5 text-[#7fb2ff]" />
              <p className="font-semibold text-white">{s.title}</p>
              <p className="mt-1 text-sm text-white/70">{s.description}</p>
            </Card>
          ))}
        </div>
      );
    case "contact":
      return <ContactPage />;
    default:
      // a game hosted on its own site: embedded where the page allows it, and always a link out
      return (
        <div className="flex h-full flex-col gap-3">
          {embedSites && item.site ? (
            <iframe title={item.title} src={item.site} className="min-h-[60vh] w-full flex-1 rounded-xl border border-white/10 bg-black" allow="autoplay; fullscreen" />
          ) : (
            <div className="grid flex-1 place-items-center rounded-xl border border-white/10 p-8 text-center" style={{ background: `radial-gradient(circle at 50% 30%, ${item.art[0]}55, transparent 70%)` }}>
              <div className="space-y-3">
                <item.icon className="mx-auto h-10 w-10 text-white/80" />
                <p className="max-w-md text-white/75">{item.blurb}</p>
              </div>
            </div>
          )}
          {item.site && (
            <div>
              <LinkButton href={item.site}>
                <ExternalLink className="h-4 w-4" /> {embedSites ? "Open in a new tab" : "Play in a new tab"}
              </LinkButton>
            </div>
          )}
        </div>
      );
  }
};

// ---------- the console ----------

export interface RoomConsoleProps {
  /** shown once the camera has reached the monitor */
  open: boolean;
  /** leave the console and go back to the room */
  onExit: () => void;
  /** embed games hosted on other sites in a frame (off where the host forbids frames) */
  embedSites?: boolean;
  /** play the console's sounds, e.g. a tick when moving between tiles */
  onSound?: (kind: "move" | "open" | "back") => void;
}

const useClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export const RoomConsole = ({ open, onExit, embedSites = true, onSound }: RoomConsoleProps) => {
  const [tab, setTab] = useState(0);
  const [index, setIndex] = useState<[number, number]>([0, 0]);
  const [opened, setOpened] = useState<Item | null>(null);
  const clock = useClock();
  const items = TABS[tab].items;
  const sel = items[index[tab]];
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // reopening the console lands on the home screen
  useEffect(() => {
    if (!open) setOpened(null);
  }, [open]);

  const act = useCallback(
    (a: Action) => {
      if (opened) {
        if (a === "back" || a === "home") {
          setOpened(null);
          onSound?.("back");
        }
        return;
      }
      const move = (d: number) => {
        setIndex((ix) => {
          const next: [number, number] = [...ix] as [number, number];
          next[tab] = Math.max(0, Math.min(items.length - 1, ix[tab] + d));
          return next;
        });
        onSound?.("move");
      };
      if (a === "left") move(-1);
      else if (a === "right") move(1);
      else if (a === "up" || a === "prevTab") {
        setTab((t) => (t + TABS.length - 1) % TABS.length);
        onSound?.("move");
      } else if (a === "down" || a === "nextTab") {
        setTab((t) => (t + 1) % TABS.length);
        onSound?.("move");
      } else if (a === "confirm") {
        setOpened(sel);
        onSound?.("open");
      } else if (a === "back") onExit();
    },
    [opened, tab, items.length, sel, onExit, onSound],
  );

  // keep the selected tile in view
  useEffect(() => {
    tileRefs.current[index[tab]]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [index, tab]);

  // keyboard: arrows to move, Enter or Space to open, Esc or Backspace to go back, Q/E like L1/R1.
  // While a game is open its own keys (arrows, WASD, Space) belong to it, so only Esc is taken.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (opened) {
        if (k === "Escape" || (k === "Backspace" && !(e.target instanceof HTMLInputElement))) {
          e.preventDefault();
          act("back");
        }
        return;
      }
      const map: Record<string, Action> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        Enter: "confirm",
        " ": "confirm",
        Escape: "back",
        Backspace: "back",
        q: "prevTab",
        e: "nextTab",
      };
      const a = map[k] ?? map[k.toLowerCase()];
      if (a) {
        e.preventDefault();
        act(a);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, opened, act]);

  // a real controller: D-pad and left stick move, ✕ opens, ○ goes back, L1/R1 switch rows, PS
  // goes home. Inside Pong and Snake the D-pad and stick drive the game as arrow keys.
  const actRef = useRef(act);
  actRef.current = act;
  const openedRef = useRef(opened);
  openedRef.current = opened;
  useEffect(() => {
    if (!open || !("getGamepads" in navigator)) return;
    let raf = 0;
    const prev: Record<string, boolean> = {};
    let repeatAt = 0;
    const held: Record<string, boolean> = {};
    const key = (k: string, down: boolean) => {
      if (held[k] === down) return;
      held[k] = down;
      window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { key: k, bubbles: true }));
    };
    const poll = (t: number) => {
      const pad = navigator.getGamepads?.().find((p) => p);
      if (pad) {
        const b = (i: number) => !!pad.buttons[i]?.pressed;
        const ax = pad.axes[0] ?? 0;
        const ay = pad.axes[1] ?? 0;
        const dir = {
          left: b(14) || ax < -0.5,
          right: b(15) || ax > 0.5,
          up: b(12) || ay < -0.5,
          down: b(13) || ay > 0.5,
        };
        const press = (name: string, now: boolean, a: Action) => {
          if (now && !prev[name]) actRef.current(a);
          prev[name] = now;
        };
        const playing = openedRef.current && (openedRef.current.id === "pong" || openedRef.current.id === "snake");
        if (playing) {
          key("ArrowLeft", dir.left);
          key("ArrowRight", dir.right);
          key("ArrowUp", dir.up);
          key("ArrowDown", dir.down);
          // ✕ starts or restarts the game from its overlay
          if (b(0) && !prev.cross) (document.querySelector("[data-console-page] button") as HTMLButtonElement | null)?.click();
          prev.cross = b(0);
        } else {
          for (const k of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) key(k, false);
          // directions repeat while held, like scrolling a real menu
          const anyDir = (Object.keys(dir) as (keyof typeof dir)[]).find((d) => dir[d]);
          if (anyDir) {
            if (!prev.dir || t > repeatAt) {
              actRef.current(anyDir);
              repeatAt = t + (prev.dir ? 140 : 420);
            }
          }
          prev.dir = !!anyDir;
          press("cross", b(0), "confirm");
        }
        press("circle", b(1), "back");
        press("l1", b(4), "prevTab");
        press("r1", b(5), "nextTab");
        press("ps", b(16), "home");
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 grid place-items-center p-3 sm:p-6" role="dialog" aria-label="PlayStation">
      {/* the monitor: a dark bezel around the screen */}
      <div className="relative flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-[18px] border-[10px] border-[#0b0b0d] bg-[#030a1e] text-white shadow-[0_30px_120px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-95 duration-500" style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        {/* the selected item's art, filling the background */}
        <div
          key={sel.id}
          className="absolute inset-0 transition-opacity duration-500 animate-in fade-in"
          style={{ background: `radial-gradient(120% 90% at 75% 85%, ${sel.art[0]}aa 0%, ${sel.art[1]} 55%, #030a1e 100%)` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:22px_22px] opacity-30" aria-hidden="true" />

        {/* top bar */}
        <header className="relative z-10 flex items-center justify-between gap-4 px-5 pt-4 sm:px-10 sm:pt-6">
          <nav className="flex items-center gap-5 sm:gap-8" aria-label="Rows">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setOpened(null);
                  setTab(i);
                }}
                className={`text-lg font-semibold transition sm:text-2xl ${i === tab && !opened ? "text-white" : "text-white/45 hover:text-white/80"}`}
                aria-pressed={i === tab}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm text-white/85">
            <span className="hidden sm:inline">{profile.name.split(" ")[0]}</span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#d4202c] to-[#5a0a0f] text-xs font-bold">SS</span>
            <span className="font-mono tabular-nums">{clock}</span>
          </div>
        </header>

        {opened ? (
          // an opened tile: its page fills the screen
          <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pb-4 pt-4 sm:px-10">
            <div className="mb-4 flex items-center gap-3">
              <button type="button" onClick={() => act("back")} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/85 hover:bg-white/20">
                <Glyph kind="circle" /> Back
              </button>
              <h2 className="min-w-0 truncate text-xl font-bold sm:text-3xl">{opened.title}</h2>
            </div>
            <div data-console-page className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
              {/* game boards shrink to fit the screen, keeping their shape */}
              <div className="mx-auto max-w-4xl pb-6 [&_canvas]:h-auto [&_canvas]:max-h-[52vh] [&_canvas]:w-auto [&_canvas]:max-w-full">
                <ItemPage item={opened} embedSites={embedSites} />
              </div>
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            {/* the tile row */}
            <div className="flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-4 pt-5 [scrollbar-width:none] sm:gap-4 sm:px-10 sm:pt-8" role="listbox" aria-label={TABS[tab].label}>
              {items.map((it, i) => {
                const active = i === index[tab];
                return (
                  <button
                    key={it.id}
                    ref={(el) => (tileRefs.current[i] = el)}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      if (active) act("confirm");
                      else {
                        setIndex((ix) => {
                          const next: [number, number] = [...ix] as [number, number];
                          next[tab] = i;
                          return next;
                        });
                        onSound?.("move");
                      }
                    }}
                    className={`relative grid shrink-0 snap-start place-items-center rounded-2xl transition-all duration-200 ${active ? "h-24 w-24 outline outline-[3px] outline-offset-4 outline-white sm:h-32 sm:w-32" : "mt-3 h-20 w-20 opacity-80 hover:opacity-100 sm:h-24 sm:w-24"}`}
                    style={{ background: `linear-gradient(145deg, ${it.art[0]}, ${it.art[1]})` }}
                  >
                    <it.icon className={active ? "h-10 w-10" : "h-8 w-8"} />
                    <span className="sr-only">{it.title}</span>
                  </button>
                );
              })}
            </div>

            {/* the selected tile, large */}
            <div className="mt-auto space-y-4 px-5 pb-6 sm:px-10 sm:pb-10">
              <h2 className="max-w-3xl text-3xl font-bold leading-tight sm:text-5xl" style={{ textWrap: "balance" }}>
                {sel.title}
              </h2>
              <p className="max-w-2xl text-base text-white/80 sm:text-lg">{sel.blurb}</p>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => act("confirm")} className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-2.5 text-base font-semibold text-black hover:bg-white/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  {sel.action}
                </button>
                {sel.site && (
                  <a href={sel.site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-sm text-white/85 hover:bg-white/20">
                    <ExternalLink className="h-4 w-4" /> New tab
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* controls, the way the console shows them */}
        <footer className="relative z-10 flex flex-wrap items-center justify-end gap-x-5 gap-y-1 border-t border-white/10 bg-black/30 px-5 py-2 text-xs text-white/70 sm:px-10">
          {opened ? (
            <Hint glyph="circle">Back (Esc)</Hint>
          ) : (
            <>
              <Hint glyph="dpad">Move</Hint>
              <Hint glyph="l1">Games / Portfolio (Q/E)</Hint>
              <Hint glyph="cross">Select (Enter)</Hint>
              <Hint glyph="circle">Back to the room (Esc)</Hint>
            </>
          )}
          <span className="inline-flex items-center gap-1.5 text-white/45">
            <Gamepad2 className="h-3.5 w-3.5" /> Works with a PS5 controller
          </span>
        </footer>
      </div>
    </div>
  );
};

export default RoomConsole;
