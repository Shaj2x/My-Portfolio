import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Github, Linkedin, Mail, Phone } from "lucide-react";
import { profile, services, servicesIntro, training } from "@/data/portfolio";
import { StartProject } from "@/components/ServicesShowcase";
import { AutomationLanes, BrandKit, CustomAI, ReceptionistCall, VoiceAgent, WebsiteBuild } from "@/components/services/ServiceDemos";

/*
 * Everything I provide, on one page, in the site's own materials (near-black, warm amber, glass).
 * Built to the Impeccable and Taste skills: the hero shows the work itself (an AI receptionist
 * taking a call and booking it), the headline names the category and the buyer with a hard fact
 * beside it, one statement lights word by word as you scroll through it (the page's dealt moment),
 * and each service is shown as a small live piece of what it does. Nothing else fades in on scroll;
 * the hero enters once. Under reduced motion every piece rests on its finished state.
 */

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const press = "transition-[background-color,border-color,transform] duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200";
const primary = `inline-flex items-center gap-2 rounded-full bg-amber-200 px-5 py-3 text-sm font-semibold text-[#1a1206] hover:bg-amber-100 ${press}`;
const secondary = `inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white hover:border-white/30 hover:bg-white/[0.1] ${press}`;

/** the one demo for each service, in the order of `services` */
const DEMOS: ReactNode[] = [<ReceptionistCall key="r" compact />, <AutomationLanes key="a" />, <WebsiteBuild key="w" />, <BrandKit key="b" />, <VoiceAgent key="v" />, <CustomAI key="c" />];

const bookHref = `mailto:${profile.email}?subject=${encodeURIComponent(`${training.name}: free first session`)}&body=${encodeURIComponent(
  "Hi Shajith,\n\nI'd like to book a free first session.\n\nStudent's grade:\nSubject:\nWhat's been hard:\nIn person or online:\n\nThanks!",
)}`;

/** one word of the statement: dim until the scroll reaches it, then in full ink */
const LitWord = ({ word, progress, from, to }: { word: string; progress: MotionValue<number>; from: number; to: number }) => {
  const opacity = useTransform(progress, [from, to], [0.42, 1]);
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
    <p ref={ref} className="text-[2.3rem] font-bold leading-[1.06] tracking-[-0.04em] text-white sm:text-6xl lg:text-[5.4rem]">
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
              className={`group flex min-h-[52px] items-center gap-3 rounded-2xl border px-3.5 py-3 text-left sm:px-4 transition-[background-color,border-color,transform] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 lg:shrink ${
                on ? "border-amber-200/50 bg-amber-200/[0.08]" : "border-white/10 bg-white/[0.03] hover:-translate-y-px hover:border-white/20 hover:bg-white/[0.06]"
              }`}
            >
              <sv.icon className={`h-5 w-5 shrink-0 transition-colors ${on ? "text-amber-200" : "text-white/55 group-hover:text-white/80"}`} aria-hidden="true" />
              <span className={`text-sm font-semibold sm:text-[15px] ${on ? "text-white" : "text-white/75"}`}>{sv.title}</span>
              <ArrowRight className={`ml-auto hidden h-4 w-4 shrink-0 transition-[opacity,transform] duration-200 lg:block ${on ? "translate-x-0 text-amber-200 opacity-100" : "-translate-x-1 opacity-0"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${active}`} className="rounded-[24px] border border-white/10 bg-[radial-gradient(120%_80%_at_80%_0%,rgba(253,230,138,0.08),transparent_60%),rgba(255,255,255,0.025)] p-5 sm:p-7">
        {/* keyed so each piece plays from its start when chosen */}
        <div key={active} className="min-h-[290px]">
          {DEMOS[active]}
        </div>
        <h3 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-white">{s.title}</h3>
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
    <div className="min-h-screen overflow-x-clip bg-[#0d0e11] text-white selection:bg-amber-200/30">
      {/* the room's lamp light, and a faint dot grid under everything */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-48 -top-48 h-[680px] w-[680px] rounded-full bg-[radial-gradient(closest-side,rgba(255,180,90,0.2),transparent)]" />
        <div className="absolute -left-56 top-[55vh] h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(80,120,220,0.1),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0d0e11]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link to="/" className="inline-flex min-h-[44px] items-center gap-2 rounded-md text-sm text-white/75 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Shajith Sasikumar
          </Link>
          <nav aria-label="On this page" className="hidden items-center gap-7 text-sm text-white/70 md:flex">
            {[
              ["#build", "What I build"],
              ["#training", "1-on-1 tutoring"],
              ["#contact", "Contact"],
            ].map(([href, label]) => (
              <a key={href} href={href} onClick={jump(href.slice(1))} className="rounded-sm bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size,color] duration-300 hover:bg-[length:100%_1px] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200">
                {label}
              </a>
            ))}
          </nav>
          <a href="#contact" onClick={jump("contact")} className={`rounded-full bg-amber-200 px-4 py-2 text-sm font-semibold text-[#1a1206] hover:bg-amber-100 ${press}`}>
            Start a project
          </a>
        </div>
      </header>

      <main className="relative">
        {/* the first screen: what's sold, to whom, one hard fact, and the work itself */}
        <section className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 py-12 sm:px-8 lg:h-[calc(100svh-61px)] lg:min-h-[640px] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14 lg:py-8">
          <div>
            <motion.p {...enter(0)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" /> London, Ontario · answering calls 24/7
            </motion.p>
            <motion.h1 {...enter(0.06)} className="mt-6 text-[2.75rem] font-bold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-[4.3rem]">
              AI receptionists and websites <span className="text-amber-200">for small businesses</span>
            </motion.h1>
            <motion.p {...enter(0.14)} className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              I build AI that answers your calls, books appointments and follows up with leads, plus the website it lives on. Set up for you and handed over working.
            </motion.p>
            <motion.div {...enter(0.22)} className="mt-9 flex flex-wrap gap-3">
              <a href="#contact" onClick={jump("contact")} className={primary}>
                Start a project <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href="#training" onClick={jump("training")} className={secondary}>
                Book free tutoring
              </a>
            </motion.div>
          </div>
          <motion.div {...enter(0.18)} className="relative">
            <div className="absolute inset-0 -z-10 scale-110 rounded-full bg-[radial-gradient(closest-side,rgba(253,230,138,0.14),transparent)]" aria-hidden="true" />
            <ReceptionistCall />
          </motion.div>
        </section>

        {/* the page's moment: one statement, lit as you read it */}
        <section className="mx-auto flex max-w-[1280px] items-center px-5 py-20 sm:px-8 lg:min-h-[100svh]">
          <h2 className="sr-only">What the systems do</h2>
          <LitStatement text="Your phone gets answered, your leads get a reply and your follow-ups go out on time, even after you've closed for the day." />
        </section>

        {/* the six services, each shown working */}
        <section className="mx-auto flex max-w-[1280px] scroll-mt-16 flex-col justify-center px-5 py-20 sm:px-8 lg:min-h-[100svh]" id="build">
          <div className="mb-10 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-10">
            <h2 className="text-4xl font-bold tracking-[-0.04em] sm:text-5xl">Six services, set up for you</h2>
            <p className="max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">{servicesIntro}</p>
          </div>
          <ServiceExplorer />
        </section>

        {/* 1-on-1 tutoring and mentorship: warmer, and its own rhythm */}
        <section className="scroll-mt-20 border-y border-white/[0.06] bg-[#121116]" id="training">
          <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 sm:py-24">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
              <div>
                <h2 className="text-4xl font-bold tracking-[-0.04em] sm:text-5xl">1-on-1 tutoring and mentorship</h2>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/75">{training.intro}</p>
              </div>
              <div className="rounded-[24px] border border-amber-200/25 bg-amber-200/[0.07] p-6">
                <p className="text-5xl font-bold tracking-[-0.045em] text-amber-200">Free</p>
                <p className="mt-1 text-sm text-white/75">first session, with zero commitment</p>
                <div className="mt-5 flex flex-wrap gap-2.5">
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
              <span className="absolute left-[18px] top-0 h-full w-px bg-gradient-to-b from-amber-200/60 via-amber-200/25 to-transparent md:left-0 md:top-[18px] md:h-px md:w-full md:bg-gradient-to-r" aria-hidden="true" />
              {training.steps.map((step, i) => (
                <li key={step.title} className="relative grid grid-cols-[36px_1fr] gap-4 md:block">
                  <span className="relative z-10 grid h-9 w-9 place-items-center rounded-full border border-amber-200/50 bg-[#121116] text-sm font-semibold tabular-nums text-amber-200" aria-hidden="true">
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
                      className="group rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-amber-200/40 hover:bg-amber-200/[0.06]"
                    >
                      <span className="block text-sm font-semibold text-white">{sub.name}</span>
                      <span className="block text-xs text-white/60">{sub.desc}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm leading-relaxed text-white/65">{training.story}</p>
                <a href={training.site} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-sm text-sm text-amber-200 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
                  See the {training.name} site <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">What 1-on-1 tutoring includes</h3>
                <ul className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {training.why.map((w) => (
                    <li key={w.title} className="flex gap-3">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
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

        {/* the close: big type, then the brief */}
        <section className="mx-auto flex max-w-[1280px] scroll-mt-16 flex-col justify-center px-5 py-20 sm:px-8 lg:min-h-[100svh]" id="contact">
          <h2 className="max-w-4xl text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
            Project briefs go <span className="text-amber-200">straight to my inbox.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">Whether you need an AI system, a website, or just want to connect, I'd love to hear from you.</p>
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <StartProject id={formId} />
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
                    className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                  >
                    <c.icon className="h-4 w-4 text-amber-200" aria-hidden="true" /> {c.label}
                    <ArrowUpRight className="ml-auto h-4 w-4 text-white/40 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/80" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/5">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-white/60 sm:px-8">
          <p>Shajith Sasikumar · London, Ontario · © {new Date().getFullYear()}</p>
          <Link to="/" className="inline-flex min-h-[44px] items-center rounded-sm transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200">
            Step into the 3D room →
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default ServicesPage;
