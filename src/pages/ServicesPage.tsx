import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Github, Linkedin, Mail, Phone } from "lucide-react";
import { profile, services, servicesIntro, training } from "@/data/portfolio";
import { StartProject } from "@/components/ServicesShowcase";
import { AutomationLanes, BrandKit, CustomAI, ReceptionistCall, VoiceAgent, WebsiteBuild } from "@/components/services/ServiceDemos";
import AlleyBackdrop from "@/components/services/alley/AlleyBackdrop";

/*
 * Everything I provide, on one page, set in a 3D alley at night (see AlleyBackdrop).
 * The alley is the world: a sodium lamp, fire-escape shadows, rain, a cold far end. Scrolling
 * walks the camera down it. The words sit over it in tall condensed capitals, the content on
 * smoked glass so the scene keeps showing through. Built to the Impeccable and Taste skills:
 * the h1 names the category and the buyer with one hard fact, one statement lights word by word
 * as you scroll (the page's dealt moment), and each service is shown working. Nothing else fades
 * in on scroll; the hero enters once. Under reduced motion the alley holds still.
 */

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const press = "transition-[background-color,border-color,transform,box-shadow] duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffb35c]";
/** sodium amber: the lamp's colour, used for the one action and the accents */
const primary = `inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#ffb35c] px-6 py-3 text-sm font-semibold text-[#1a0f04] shadow-[0_0_32px_-10px_rgba(255,179,92,0.6)] hover:bg-[#ffc67f] ${press}`;
const secondary = `inline-flex min-h-[48px] items-center gap-2 rounded-full border border-white/20 bg-black/30 px-6 py-3 text-sm font-medium text-white backdrop-blur-md hover:border-white/40 hover:bg-black/45 ${press}`;
/** smoked glass over the alley */
const glass = "rounded-[28px] border border-white/10 bg-[#07080a]/[0.86] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl";
const display = "font-semibold tracking-[-0.035em]";

/** the one demo for each service, in the order of `services` */
const DEMOS: ReactNode[] = [<ReceptionistCall key="r" compact />, <AutomationLanes key="a" />, <WebsiteBuild key="w" />, <BrandKit key="b" />, <VoiceAgent key="v" />, <CustomAI key="c" />];

const bookHref = `mailto:${profile.email}?subject=${encodeURIComponent(`${training.name}: free first session`)}&body=${encodeURIComponent(
  "Hi Shajith,\n\nI'd like to book a free first session.\n\nStudent's grade:\nSubject:\nWhat's been hard:\nIn person or online:\n\nThanks!",
)}`;

/** one word of the statement: dim until the scroll reaches it, then in full ink */
const LitWord = ({ word, progress, from, to }: { word: string; progress: MotionValue<number>; from: number; to: number }) => {
  const opacity = useTransform(progress, [from, to], [0.28, 1]);
  return (
    <motion.span style={{ opacity }} className="inline-block">
      {word}&nbsp;
    </motion.span>
  );
};

/** the page's moment: a statement whose words light up as it scrolls through the screen */
const LitStatement = ({ text }: { text: string }) => {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = text.split(" ");
  return (
    <p ref={ref} className={`${display} text-[1.75rem] leading-[1.2] text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.6)] sm:text-4xl lg:text-[2.75rem]`}>
      {reduce
        ? text
        : words.map((w, i) => <LitWord key={i} word={w} progress={scrollYProgress} from={i / words.length} to={(i + 1) / words.length} />)}
    </p>
  );
};

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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
      <div role="tablist" aria-label="Services" aria-orientation="vertical" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-col">
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
              className={`group flex min-h-[52px] items-center gap-3 rounded-2xl border px-3.5 py-3 text-left sm:px-4 transition-[background-color,border-color,transform] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffb35c] lg:shrink ${
                on ? "border-[#ffb35c]/60 bg-[#ffb35c]/[0.1]" : "border-white/10 bg-white/[0.03] hover:-translate-y-px hover:border-white/20 hover:bg-white/[0.06]"
              }`}
            >
              <sv.icon className={`h-5 w-5 shrink-0 transition-colors ${on ? "text-[#ffb35c]" : "text-white/55 group-hover:text-white/80"}`} aria-hidden="true" />
              <span className={`text-sm font-semibold sm:text-[15px] ${on ? "text-white" : "text-white/75"}`}>{sv.title}</span>
              <ArrowRight className={`ml-auto hidden h-4 w-4 shrink-0 transition-[opacity,transform] duration-200 lg:block ${on ? "translate-x-0 text-[#ffb35c] opacity-100" : "-translate-x-1 opacity-0"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${active}`} className="rounded-[22px] border border-white/10 bg-[radial-gradient(120%_80%_at_80%_0%,rgba(255,179,92,0.1),transparent_60%),rgba(255,255,255,0.03)] p-5 sm:p-7">
        {/* keyed so each piece plays from its start when chosen */}
        <div key={active} className="min-h-[290px]">
          {DEMOS[active]}
        </div>
        <h3 className={`${display} mt-6 text-2xl text-white`}>{s.title}</h3>
        <p className="mt-2 max-w-xl text-base leading-relaxed text-white/75">{s.description}</p>
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${s.title}: main offerings`}>
          {s.tags.map((t) => (
            <li key={t} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-white/80">
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const ServicesPage = () => {
  const reduce = useReducedMotion();
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
    document.title = "What I provide · Shajith Sasikumar";
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
    <div className="relative min-h-screen overflow-x-clip bg-[#06080b] text-white selection:bg-[#ffb35c]/30">
      <AlleyBackdrop />

      <header className={`fixed inset-x-0 top-0 z-30 transition-[background-color,border-color] duration-300 ${scrolled ? "border-b border-white/10 bg-[#050607]/80 backdrop-blur-xl" : "border-b border-transparent bg-gradient-to-b from-black/80 via-black/40 to-transparent"}`}>
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link to="/" className="inline-flex min-h-[44px] items-center gap-2 rounded-md text-sm text-white/80 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffb35c]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Shajith Sasikumar
          </Link>
          <nav aria-label="On this page" className="hidden items-center gap-8 text-sm text-white/70 md:flex">
            {[
              ["#build", "What I build"],
              ["#training", "1-on-1 tutoring"],
              ["#contact", "Contact"],
            ].map(([href, label]) => (
              <a key={href} href={href} onClick={jump(href.slice(1))} className="inline-flex min-h-[44px] items-center rounded-sm bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-[left_bottom_12px] bg-no-repeat transition-[background-size,color] duration-300 hover:bg-[length:100%_1px] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffb35c]">
                {label}
              </a>
            ))}
          </nav>
          <a href="#contact" onClick={jump("contact")} className={`inline-flex min-h-[44px] items-center rounded-full border border-[#ffb35c]/60 bg-black/30 px-4 text-sm font-semibold text-[#ffb35c] backdrop-blur-md hover:bg-[#ffb35c] hover:text-[#1a0f04] ${press}`}>
            Start a project
          </a>
        </div>
      </header>

      <main className="relative z-10">
        {/* the first screen: a title card over the alley. What's sold, to whom, one hard fact */}
        <section className="relative flex min-h-[100svh] items-end">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(3,4,5,0.88)_0%,rgba(3,4,5,0.55)_38%,transparent_70%),linear-gradient(0deg,rgba(3,4,5,0.9)_0%,transparent_45%)] [mask-image:linear-gradient(to_bottom,black_80%,transparent)]" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-[1680px] px-5 pb-14 pt-32 sm:px-8 sm:pb-20">
            <motion.p {...enter(0)} className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-black/40 px-3.5 py-1.5 text-xs text-white/85 backdrop-blur-md">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70 motion-reduce:hidden" />
                <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              London, Ontario · answering calls 24/7
            </motion.p>
            <motion.h1 {...enter(0.08)} className={`${display} mt-6 max-w-[16ch] text-[2.5rem] leading-[1.04] [text-shadow:0_4px_40px_rgba(0,0,0,0.7)] sm:text-[3.25rem] lg:text-[4rem]`}>
              AI receptionists and websites <span className="text-[#ffb35c]">for small businesses</span>
            </motion.h1>
            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <motion.p {...enter(0.18)} className="max-w-xl text-lg leading-relaxed text-white/80">
                I build AI that answers your calls, books appointments and follows up with leads, plus the website it lives on. Set up for you and handed over working.
              </motion.p>
              <motion.div {...enter(0.26)} className="flex flex-wrap gap-3">
                <a href="#contact" onClick={jump("contact")} className={primary}>
                  Start a project <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a href="#training" onClick={jump("training")} className={secondary}>
                  Book free tutoring
                </a>
              </motion.div>
            </div>
          </div>
        </section>

        {/* the page's moment: one statement, lit as you walk past it */}
        <section className="relative flex min-h-[80svh] items-center">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(3,4,5,0.75)_0%,rgba(3,4,5,0.35)_55%,transparent_85%)] [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)]" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-[1680px] px-5 sm:px-8 lg:px-14">
            <h2 className="sr-only">What the systems do</h2>
            <div className="max-w-[820px]">
              <LitStatement text="Your phone gets answered. Your leads get a reply. Your follow‑ups go out on time, even after you close." />
            </div>
          </div>
        </section>

        {/* the six services, each shown working, on smoked glass */}
        <section className="relative mx-auto max-w-[1680px] scroll-mt-20 px-3 py-16 sm:px-8 sm:py-24 lg:px-14" id="build">
          <div className={`${glass} p-5 sm:p-10`}>
            <div className="mb-10 grid gap-5 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:items-end lg:gap-12">
              <h2 className={`${display} text-3xl leading-[1.1] sm:text-[2.5rem]`}>
                Six services, <span className="text-[#ffb35c]">set up for you</span>
              </h2>
              <p className="max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">{servicesIntro}</p>
            </div>
            <ServiceExplorer />
          </div>
        </section>

        {/* 1-on-1 tutoring and mentorship: the warm window in the alley */}
        <section className="relative mx-auto max-w-[1680px] scroll-mt-20 px-3 py-16 sm:px-8 sm:py-24 lg:px-14" id="training">
          <div className={`${glass} overflow-hidden bg-[radial-gradient(90%_60%_at_100%_0%,rgba(255,170,90,0.14),transparent_60%),rgba(7,8,10,0.86)] p-5 sm:p-10`}>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
              <div>
                <h2 className={`${display} text-3xl leading-[1.1] sm:text-[2.5rem]`}>
                  1-on-1 tutoring <span className="text-[#ffb35c]">and mentorship</span>
                </h2>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">{training.intro}</p>
              </div>
              <div className="rounded-[22px] border border-[#ffb35c]/30 bg-[#ffb35c]/[0.08] p-6">
                <p className={`${display} text-5xl leading-none text-[#ffb35c]`}>Free</p>
                <p className="mt-2 text-sm text-white/75">first session, with zero commitment</p>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  <a href={bookHref} className={primary}>
                    <Mail className="h-4 w-4" aria-hidden="true" /> Book a free session
                  </a>
                  <a href={`tel:${training.tel}`} className={secondary}>
                    <Phone className="h-4 w-4" aria-hidden="true" /> {training.phone}
                  </a>
                </div>
              </div>
            </div>

            {/* how it goes: three steps along one path (the order is the point) */}
            <ol className="relative mt-16 grid gap-8 md:grid-cols-3 md:gap-6">
              <span className="absolute left-[18px] top-0 h-full w-px bg-gradient-to-b from-[#ffb35c]/70 via-[#ffb35c]/25 to-transparent md:left-0 md:top-[18px] md:h-px md:w-full md:bg-gradient-to-r" aria-hidden="true" />
              {training.steps.map((step, i) => (
                <li key={step.title} className="relative grid grid-cols-[36px_1fr] gap-4 md:block">
                  <span className="relative z-10 grid h-9 w-9 place-items-center rounded-full border border-[#ffb35c]/60 bg-[#0b0a09] text-sm font-semibold tabular-nums text-[#ffb35c]" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="md:mt-5">
                    <p className="text-lg font-semibold text-white">{step.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/70">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
              <div>
                <h3 className="text-xl font-semibold text-white">K-12 subjects</h3>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {training.subjects.map((sub) => (
                    <li
                      key={sub.name}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[#ffb35c]/45 hover:bg-[#ffb35c]/[0.07]"
                    >
                      <span className="block text-sm font-semibold text-white">{sub.name}</span>
                      <span className="block text-xs text-white/60">{sub.desc}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm leading-relaxed text-white/65">{training.story}</p>
                <a href={training.site} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-sm text-sm text-[#ffb35c] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffb35c]">
                  See the {training.name} site <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">What 1-on-1 tutoring includes</h3>
                <ul className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {training.why.map((w) => (
                    <li key={w.title} className="flex gap-3">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ffb35c]" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-white">{w.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-white/65">{w.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* the close: the loudest type on the page, then the brief */}
        <section className="relative scroll-mt-16" id="contact">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(3,4,5,0.92)_0%,rgba(3,4,5,0.55)_60%,transparent_100%)] [mask-image:linear-gradient(to_bottom,transparent,black_30%)]" aria-hidden="true" />
          <div className="relative mx-auto flex min-h-[100svh] max-w-[1680px] flex-col justify-center px-5 py-24 sm:px-8">
            <h2 className={`${display} max-w-[18ch] text-[2.25rem] leading-[1.08] [text-shadow:0_4px_40px_rgba(0,0,0,0.7)] sm:text-5xl lg:text-[3.5rem]`}>
              Project briefs go <span className="text-[#ffb35c]">straight to my inbox.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">Whether you need an AI system, a website, or just want to connect, I'd love to hear from you.</p>
            <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
              <div className="max-w-2xl self-start rounded-2xl bg-[#07080a]/85 backdrop-blur-xl [&>div]:mt-0">
                <StartProject id={formId} />
              </div>
              <ul className="space-y-3 text-sm">
                {[
                  { href: `mailto:${profile.email}`, icon: Mail, label: profile.email },
                  { href: "https://www.linkedin.com/in/shajith-sasikumar-5080a5344/", icon: Linkedin, label: "LinkedIn" },
                  { href: "https://github.com/Shaj2x", icon: Github, label: "GitHub" },
                ].map((c) => (
                  <li key={c.label}>
                    <a
                      href={c.href}
                      target={c.href.startsWith("mailto:") ? undefined : "_blank"}
                      rel="noopener noreferrer"
                      className="group flex min-h-[56px] items-center gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3.5 text-white/85 backdrop-blur-md transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[#ffb35c]/40 hover:bg-black/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffb35c]"
                    >
                      <c.icon className="h-4 w-4 text-[#ffb35c]" aria-hidden="true" /> {c.label}
                      <ArrowUpRight className="ml-auto h-4 w-4 text-white/40 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/80" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-black/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-white/60 sm:px-8">
          <p>Shajith Sasikumar · London, Ontario · © {new Date().getFullYear()}</p>
          <Link to="/" className="inline-flex min-h-[44px] items-center rounded-sm transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffb35c]">
            Step into the 3D room →
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default ServicesPage;
