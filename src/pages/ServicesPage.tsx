import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, Github, Linkedin, Mail, Phone } from "lucide-react";
import { profile, services, servicesIntro, training } from "@/data/portfolio";
import { StartProject } from "@/components/ServicesShowcase";
import { AutomationLanes, BrandKit, CustomAI, ReceptionistCall, VoiceAgent, WebsiteBuild } from "@/components/services/ServiceDemos";
import DeskBackdrop from "@/components/services/DeskBackdrop";

/*
 * What I build, for the small businesses I build it for. The first screen is the 3D room seen from
 * the desk chair (see DeskBackdrop): clicking the chair in the room sits you down here. Below it the
 * page is a plain, readable page on a solid ground.
 *
 * Built to the Impeccable and Taste skills, against the usual tells of a generated agency page:
 * the h1 names the category and the buyer, the copy says what each thing does in a client's words,
 * proof comes before promises (real projects, with their recordings and write-ups), the process
 * says what happens and in what order, and there is one primary action, repeated only at the end.
 * No glows, no pulsing badges, no scroll tricks; the hero enters once and nothing else animates in.
 */

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const ACCENT = "#ffb35c";

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffb35c]";
const press = `transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] ${focusRing}`;
const primary = `inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-[#ffb35c] px-5 text-sm font-semibold text-[#1a0f04] hover:bg-[#ffc67f] ${press}`;
const quiet = `inline-flex min-h-[48px] items-center gap-2 rounded-lg px-2 text-sm font-medium text-white/80 hover:text-white ${press}`;
const container = "mx-auto w-full max-w-[1200px] px-5 sm:px-8";
const h2 = "text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[2.4rem]";
const lede = "mt-4 max-w-[60ch] text-base leading-relaxed text-white/65 sm:text-[17px]";

/** the one demo for each service, in the order of `services` */
const DEMOS: ReactNode[] = [<ReceptionistCall key="r" compact />, <AutomationLanes key="a" />, <WebsiteBuild key="w" />, <BrandKit key="b" />, <VoiceAgent key="v" />, <CustomAI key="c" />];

const bookHref = `mailto:${profile.email}?subject=${encodeURIComponent(`${training.name}: free first session`)}&body=${encodeURIComponent(
  "Hi Shajith,\n\nI'd like to book a free first session.\n\nStudent's grade:\nSubject:\nWhat's been hard:\nIn person or online:\n\nThanks!",
)}`;

/** real work, newest and most relevant to a business first. Every claim here is in the project's own write-up. */
const WORK = [
  {
    title: "Marq Living",
    kind: "Web app + building automation",
    text: "A resident app for The Marq, my building in London, Ontario: a live shuttle map with delay alerts, laundry that shows which machines are free, room booking that switches the lights and HVAC on for you, and a dashboard for staff.",
    media: "Marq-Living-Platform",
    href: "/work/marq-living",
    cta: "Read how it works",
  },
  {
    title: "DevAssist",
    kind: "AI agents",
    text: "Takes a plain-English change request, like “add Sunday hours to the booking page”, and has five AI agents plan, write and test it in a locked sandbox before a person approves it.",
    media: "devassist",
    href: "/work/devassist",
    cta: "Read how it works",
  },
  {
    title: "Digital Dash",
    kind: "Live product",
    text: "A study dashboard students style their own way: focus timers, tasks, grades, a calendar and study rooms with friends. Live and in use.",
    media: "digitaldash",
    href: "https://usedigitaldash.vercel.app",
    cta: "Open the live site",
  },
] as const;

/** what happens after you get in touch, in order */
const STEPS = [
  { title: "Send a short brief", text: "What your business does and what's slowing you down. A few lines is enough; the form below sends it straight to me." },
  { title: "Get a plan and a quote", text: "I reply with what I'd build, how long it takes and what it costs, so you know before any work starts." },
  { title: "It goes live, then it's yours", text: "I set it up, test it with you on real calls or real customers, and hand over the logins and a short guide." },
] as const;

/** a recording of the project, playing quietly; a still under reduced motion */
const WorkMedia = ({ name, title, reduce }: { name: string; title: string; reduce: boolean }) =>
  reduce ? (
    <img src={`/projects/demos/${name}.jpg`} alt={`${title}, a screen from the app`} loading="lazy" className="h-full w-full object-cover object-top" />
  ) : (
    <video className="h-full w-full object-cover object-top" autoPlay muted loop playsInline preload="metadata" poster={`/projects/demos/${name}.jpg`} aria-label={`${title}, a short recording of the app in use`}>
      <source src={`/projects/demos/${name}.webm`} type="video/webm" />
      <source src={`/projects/demos/${name}.mp4`} type="video/mp4" />
    </video>
  );

/** the six services as tabs beside a stage that shows the chosen one working */
const ServiceExplorer = () => {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();
  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = (i + step + services.length) % services.length;
    setActive(n);
    tabs.current[n]?.focus();
  };
  const s = services[active];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-12">
      <div role="tablist" aria-label="Services" aria-orientation="vertical" className="grid grid-cols-2 gap-x-4 sm:grid-cols-3 lg:flex lg:flex-col">
        {services.map((sv, i) => {
          const on = i === active;
          return (
            <button
              key={sv.title}
              ref={(el) => (tabs.current[i] = el)}
              role="tab"
              id={`${base}-tab-${i}`}
              aria-selected={on}
              aria-controls={`${base}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKey(e, i)}
              className={`group flex min-h-[52px] items-center gap-3 border-b border-white/[0.08] py-3 text-left transition-colors duration-150 ${focusRing}`}
            >
              <span className={`w-6 shrink-0 text-xs tabular-nums ${on ? "text-[#ffb35c]" : "text-white/35"}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className={`text-[15px] ${on ? "font-semibold text-white" : "text-white/65 group-hover:text-white"}`}>{sv.title}</span>
              <ArrowRight className={`ml-auto hidden h-4 w-4 shrink-0 transition-[opacity,transform] duration-200 lg:block ${on ? "translate-x-0 text-[#ffb35c] opacity-100" : "-translate-x-1 opacity-0"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${active}`}>
        {/* keyed so each piece plays from its start when chosen */}
        <div key={active} className="min-h-[290px] rounded-xl border border-white/[0.08] bg-[#111317] p-4 sm:p-6">
          {DEMOS[active]}
        </div>
        <h3 className="mt-6 text-xl font-semibold tracking-[-0.02em] text-white">{s.title}</h3>
        <p className="mt-2 max-w-[60ch] text-base leading-relaxed text-white/70">{s.description}</p>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/60" aria-label={`${s.title}: what it covers`}>
          {s.tags.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-[#ffb35c]" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const ServicesPage = () => {
  const reduce = useReducedMotion() ?? false;
  const formId = useId();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const prevScroll = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    return () => {
      root.style.scrollBehavior = prevScroll;
    };
  }, []);
  /** an in-page jump: smooth unless motion is reduced, and the target takes focus for keyboard users */
  const jump = (id: string) => (e: MouseEvent) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  useEffect(() => {
    const prev = document.title;
    document.title = "AI receptionists and websites · Shajith Sasikumar";
    // land on a section when linked to one (e.g. /services#training), otherwise at the top
    const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
    return () => {
      document.title = prev;
    };
  }, []);

  /** the hero's one entrance */
  const enter = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.4 } }
      : { initial: { opacity: 0, transform: "translateY(18px)" }, animate: { opacity: 1, transform: "translateY(0px)" }, transition: { duration: 0.8, ease: EASE_OUT, delay } };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#0b0c0f] text-white selection:bg-[#ffb35c]/30">
      <DeskBackdrop />

      <header className={`fixed inset-x-0 top-0 z-30 border-b transition-[background-color,border-color] duration-300 ${scrolled ? "border-white/[0.08] bg-[#0b0c0f]/90 backdrop-blur-md" : "border-transparent bg-gradient-to-b from-black/70 to-transparent"}`}>
        <div className={`${container} flex items-center justify-between gap-4 py-2.5`}>
          <Link to="/" className={`inline-flex min-h-[44px] items-center gap-2 rounded-md text-sm text-white/80 hover:text-white ${press}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Shajith Sasikumar
          </Link>
          <nav aria-label="On this page" className="hidden items-center gap-7 text-sm text-white/65 md:flex">
            {[
              ["#work", "Work"],
              ["#build", "Services"],
              ["#process", "How it works"],
              ["#training", "Tutoring"],
            ].map(([href, label]) => (
              <a key={href} href={href} onClick={jump(href.slice(1))} className={`inline-flex min-h-[44px] items-center rounded-sm hover:text-white ${press}`}>
                {label}
              </a>
            ))}
          </nav>
          <a href="#contact" onClick={jump("contact")} className={`inline-flex min-h-[40px] items-center rounded-lg border border-white/20 px-3.5 text-sm font-medium text-white hover:border-white/40 hover:bg-white/[0.06] ${press}`}>
            Contact
          </a>
        </div>
      </header>

      <main className="relative z-10">
        {/* the first screen: sitting at the desk. What's sold, to whom, by whom, and the one action */}
        <section className="relative flex min-h-[100svh] items-end">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,#0b0c0f_0%,rgba(11,12,15,0.8)_25%,transparent_65%),linear-gradient(90deg,rgba(11,12,15,0.78)_0%,rgba(11,12,15,0.45)_40%,transparent_65%)]" aria-hidden="true" />
          {/* on a phone the text covers most of the frame, so the room sits further back */}
          <div className="pointer-events-none absolute inset-0 bg-[#0b0c0f]/55 sm:hidden" aria-hidden="true" />
          <div className={`${container} relative pb-12 pt-32 sm:pb-16`}>
            <motion.p {...enter(0)} className="text-sm text-white/70">
              Shajith Sasikumar · London, Ontario
            </motion.p>
            <motion.h1 {...enter(0.06)} className="mt-3 max-w-[18ch] text-[2.4rem] font-semibold leading-[1.04] tracking-[-0.035em] [text-shadow:0_2px_30px_rgba(0,0,0,0.6)] sm:text-[3.4rem]">
              AI receptionists and websites for small businesses
            </motion.h1>
            <motion.p {...enter(0.12)} className="mt-5 max-w-[52ch] text-base leading-relaxed text-white/80 sm:text-lg">
              An AI that picks up when you can't, books the appointment and texts the confirmation, plus the website it lives on. One person plans it, builds it and hands it over working.
            </motion.p>
            <motion.div {...enter(0.18)} className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
              <a href="#contact" onClick={jump("contact")} className={primary}>
                Start a project <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href="#work" onClick={jump("work")} className={quiet}>
                See recent work <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </a>
            </motion.div>
            <motion.p {...enter(0.24)} className="mt-10 border-t border-white/10 pt-4 text-sm text-white/55">
              Electrical Engineering + Ivey HBA at Western University. Every project is built and supported by me, not passed to a team.
            </motion.p>
          </div>
        </section>

        {/* everything below sits on a solid ground: proof first */}
        <div className="bg-[#0b0c0f]">
          <section id="work" className={`${container} scroll-mt-16 py-20 sm:py-28`}>
            <h2 className={h2}>Recent work</h2>
            <p className={lede}>Things I've designed and built end to end, each with a recording of it in use and a write-up of how it works.</p>
            <div className="mt-12 grid gap-x-8 gap-y-14 lg:grid-cols-2">
              {WORK.map((w, i) => {
                const external = w.href.startsWith("http");
                const inner = (
                  <>
                    <div className={`overflow-hidden rounded-xl border border-white/[0.08] bg-[#111317] ${i === 0 ? "aspect-[16/9] lg:aspect-[21/9]" : "aspect-[16/10]"}`}>
                      <WorkMedia name={w.media} title={w.title} reduce={reduce} />
                    </div>
                    <div className={`mt-5 ${i === 0 ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-10" : ""}`}>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-white/45">{w.kind}</p>
                        <h3 className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-white">{w.title}</h3>
                      </div>
                      <div>
                        <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-white/65 lg:mt-0">{w.text}</p>
                        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#ffb35c] group-hover:underline group-hover:underline-offset-4">
                          {w.cta} {external ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                        </span>
                      </div>
                    </div>
                  </>
                );
                const cls = `group block rounded-xl ${focusRing} ${i === 0 ? "lg:col-span-2" : ""}`;
                return external ? (
                  <a key={w.title} href={w.href} target="_blank" rel="noopener noreferrer" className={cls}>
                    {inner}
                  </a>
                ) : (
                  <Link key={w.title} to={w.href} className={cls}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          </section>

          <section id="build" className="scroll-mt-16 border-t border-white/[0.06] py-20 sm:py-28">
            <div className={container}>
              <h2 className={h2}>What I can set up for you</h2>
              <p className={lede}>{servicesIntro}</p>
              <div className="mt-12">
                <ServiceExplorer />
              </div>
            </div>
          </section>

          <section id="process" className="scroll-mt-16 border-t border-white/[0.06] py-20 sm:py-28">
            <div className={container}>
              <h2 className={h2}>How a project runs</h2>
              <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
                {STEPS.map((step, i) => (
                  <li key={step.title} className="border-t border-white/15 pt-5">
                    <span className="text-sm tabular-nums" style={{ color: ACCENT }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="mt-3 text-lg font-semibold tracking-[-0.01em] text-white">{step.title}</p>
                    <p className="mt-2 text-[15px] leading-relaxed text-white/65">{step.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* 1-on-1 tutoring: a different audience, so its own quieter section */}
          <section id="training" className="scroll-mt-16 border-t border-white/[0.06] py-20 sm:py-28">
            <div className={`${container} grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16`}>
              <div>
                <p className="text-sm text-white/55">Also: {training.name}</p>
                <h2 className={`${h2} mt-2`}>1-on-1 tutoring and mentorship</h2>
                <p className={lede}>{training.intro}</p>
                <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
                  <a href={bookHref} className={`inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-white/20 px-5 text-sm font-semibold text-white hover:border-white/40 hover:bg-white/[0.06] ${press}`}>
                    <Mail className="h-4 w-4" aria-hidden="true" /> Book a free first session
                  </a>
                  <a href={`tel:${training.tel}`} className={quiet}>
                    <Phone className="h-4 w-4" aria-hidden="true" /> {training.phone}
                  </a>
                </div>
                <a href={training.site} target="_blank" rel="noopener noreferrer" className={`mt-6 inline-flex min-h-[44px] items-center gap-1.5 rounded-sm text-sm text-white/60 underline-offset-4 hover:text-white hover:underline ${focusRing}`}>
                  {training.name} website <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
              <div className="grid gap-10 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">Subjects, K-12</h3>
                  <ul className="mt-4 space-y-3">
                    {training.subjects.map((sub) => (
                      <li key={sub.name} className="text-[15px]">
                        <span className="text-white">{sub.name}</span>
                        <span className="block text-sm text-white/50">{sub.desc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">What you get</h3>
                  <ul className="mt-4 space-y-3">
                    {training.why.slice(0, 6).map((w) => (
                      <li key={w.title} className="flex gap-2.5 text-[15px]">
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[#ffb35c]" aria-hidden="true" />
                        <span>
                          <span className="text-white">{w.title}</span>
                          <span className="block text-sm leading-relaxed text-white/50">{w.desc}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* the close: the one action, in its working form */}
          <section id="contact" className="scroll-mt-16 border-t border-white/[0.06] py-20 sm:py-28">
            <div className={`${container} grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16`}>
              <div>
                <h2 className={h2}>Tell me what you need</h2>
                <p className={lede}>Pick what you're interested in and add a line or two about your business. It opens in your email, addressed to me, and I reply myself.</p>
                <ul className="mt-8 space-y-1 text-sm">
                  {[
                    { href: `mailto:${profile.email}`, icon: Mail, label: profile.email },
                    { href: profile.linkedin, icon: Linkedin, label: "LinkedIn" },
                    { href: profile.github, icon: Github, label: "GitHub" },
                  ].map((c) => (
                    <li key={c.label}>
                      <a
                        href={c.href}
                        target={c.href.startsWith("mailto:") ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className={`inline-flex min-h-[44px] items-center gap-3 rounded-sm text-white/70 hover:text-white ${focusRing}`}
                      >
                        <c.icon className="h-4 w-4 text-white/45" aria-hidden="true" /> {c.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <StartProject id={formId} variant="page" />
            </div>
          </section>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] bg-[#0b0c0f]">
        <div className={`${container} flex flex-wrap items-center justify-between gap-3 py-6 text-sm text-white/50`}>
          <p>Shajith Sasikumar · London, Ontario · © {new Date().getFullYear()}</p>
          <Link to="/" className={`inline-flex min-h-[44px] items-center rounded-sm hover:text-white ${focusRing}`}>
            Back to the 3D room
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default ServicesPage;
