import { useEffect, useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Github, Linkedin, Mail, Phone } from "lucide-react";
import { profile, services, servicesIntro, training } from "@/data/portfolio";
import { StartProject } from "@/components/ServicesShowcase";

/*
 * Everything I provide, on one page: the six services I build for businesses, and 1-on-1 tutoring
 * and mentorship through ABA Tutoring. Same materials as the rest of the site (near-black, warm
 * amber, frosted glass). Services read as an editorial list rather than a grid of identical cards;
 * the one authored motion is the headline rising in.
 */

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const Reveal = ({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(14px)" }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
};

const primary =
  "inline-flex items-center gap-2 rounded-full bg-amber-200 px-5 py-2.5 text-sm font-semibold text-[#1a1206] transition-[background-color,transform] duration-150 hover:bg-amber-100 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200";
const secondary =
  "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-medium text-white transition-[background-color,border-color,transform] duration-150 hover:border-white/30 hover:bg-white/[0.1] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200";

/** a section heading with its anchor, spaced more above than below */
const SectionHead = ({ id, title, lede }: { id: string; title: string; lede?: string }) => (
  <div className="mb-10 max-w-2xl scroll-mt-24" id={id}>
    <h2 className="text-3xl font-bold tracking-[-0.035em] text-white sm:text-4xl">{title}</h2>
    {lede && <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">{lede}</p>}
  </div>
);

const bookHref = `mailto:${profile.email}?subject=${encodeURIComponent(`${training.name}: free first session`)}&body=${encodeURIComponent(
  "Hi Shajith,\n\nI'd like to book a free first session.\n\nStudent's grade:\nSubject:\nWhat's been hard:\nIn person or online:\n\nThanks!",
)}`;

const ServicesPage = () => {
  const reduce = useReducedMotion();
  const formId = useId();

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

  return (
    <div className="min-h-screen bg-[#0d0e11] text-white selection:bg-amber-200/30">
      {/* the room's light, as on the quick view */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(255,190,110,0.16),transparent)]" />
        <div className="absolute -left-48 top-[38rem] h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(90,120,220,0.1),transparent)]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0d0e11]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Shajith Sasikumar
          </Link>
          <nav aria-label="On this page" className="hidden items-center gap-6 text-sm text-white/70 sm:flex">
            <a href="#build" className="transition-colors hover:text-white">
              What I build
            </a>
            <a href="#training" className="transition-colors hover:text-white">
              1-on-1 tutoring
            </a>
            <a href="#contact" className="transition-colors hover:text-white">
              Contact
            </a>
          </nav>
          <a href="#contact" className="inline-flex items-center gap-1.5 rounded-full bg-amber-200 px-4 py-2 text-sm font-semibold text-[#1a1206] transition-colors duration-150 hover:bg-amber-100">
            Start a project
          </a>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-5 sm:px-8">
        {/* the offer, in one line */}
        <section className="pb-16 pt-16 sm:pb-24 sm:pt-24">
          <h1 className="max-w-4xl text-[2.6rem] font-bold leading-[1] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            <span className="block overflow-hidden pb-[0.06em]">
              <motion.span
                className="block"
                initial={reduce ? { opacity: 0 } : { transform: "translateY(105%)" }}
                animate={reduce ? { opacity: 1 } : { transform: "translateY(0%)" }}
                transition={{ duration: 0.85, ease: EASE_OUT }}
              >
                AI systems and websites
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-[0.06em]">
              <motion.span
                className="block text-amber-200"
                initial={reduce ? { opacity: 0 } : { transform: "translateY(105%)" }}
                animate={reduce ? { opacity: 1 } : { transform: "translateY(0%)" }}
                transition={{ duration: 0.85, ease: EASE_OUT, delay: 0.08 }}
              >
                that run themselves.
              </motion.span>
            </span>
          </h1>
          <Reveal delay={0.25}>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/75">{servicesIntro}</p>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/65">
              I also run {training.name}, for 1-on-1 tutoring and mentorship in school subjects and coding.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#contact" className={primary}>
                Start a project <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href="#training" className={secondary}>
                Book a free tutoring session
              </a>
            </div>
          </Reveal>
        </section>

        {/* the six services, as an editorial list */}
        <section className="border-t border-white/10 pt-16 sm:pt-20">
          <SectionHead id="build" title="What I build" lede="Turnkey systems for businesses: built, set up and handed over working." />
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {services.map((s) => (
              <li key={s.title}>
                <Reveal className="grid gap-4 py-8 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:gap-10">
                  <div className="flex items-start gap-3">
                    <s.icon className="mt-1 h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
                    <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">{s.title}</h3>
                  </div>
                  <div>
                    <p className="text-base leading-relaxed text-white/75">{s.description}</p>
                    <p className="mt-3 text-sm text-white/55">{s.tags.join(" · ")}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        {/* 1-on-1 tutoring and mentorship */}
        <section className="pt-24 sm:pt-28">
          <SectionHead id="training" title="1-on-1 tutoring and mentorship" lede={training.intro} />
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
            <Reveal>
              <p className="text-base leading-relaxed text-white/75">{training.story}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={bookHref} className={primary}>
                  <Mail className="h-4 w-4" aria-hidden="true" /> Book a free session
                </a>
                <a href={`tel:${training.tel}`} className={secondary}>
                  <Phone className="h-4 w-4" aria-hidden="true" /> {training.phone}
                </a>
              </div>
              <a href={training.site} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-sm text-amber-200 underline-offset-4 hover:underline">
                Visit the {training.name} site <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </Reveal>
            {/* the order matters here, so the steps are numbered */}
            <Reveal delay={0.08}>
              <h3 className="text-sm font-semibold text-white">How it works</h3>
              <ol className="mt-5 space-y-6">
                {training.steps.map((step, i) => (
                  <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-amber-200/40 text-sm font-semibold tabular-nums text-amber-200" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-white">{step.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-white/70">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>

          <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
            <Reveal>
              <h3 className="text-sm font-semibold text-white">Subjects</h3>
              <dl className="mt-5 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-1">
                {training.subjects.map((sub) => (
                  <div key={sub.name} className="flex items-baseline justify-between gap-4 border-b border-white/10 py-3">
                    <dt className="font-medium text-white">{sub.name}</dt>
                    <dd className="text-right text-sm text-white/65">{sub.desc}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
            <Reveal delay={0.08}>
              <h3 className="text-sm font-semibold text-white">Why it works</h3>
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
            </Reveal>
          </div>
        </section>

        {/* get in touch */}
        <section className="pb-24 pt-24 sm:pt-28">
          <SectionHead id="contact" title="Let's work together" lede="Whether you need an AI system, a website, or just want to connect, I'd love to hear from you." />
          <Reveal>
            <StartProject id={formId} />
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <a href={`mailto:${profile.email}`} className="inline-flex items-center gap-2 text-white/75 transition-colors hover:text-white">
                <Mail className="h-4 w-4 text-amber-200" aria-hidden="true" /> {profile.email}
              </a>
              <a href="https://www.linkedin.com/in/shajith-sasikumar-5080a5344/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-white/75 transition-colors hover:text-white">
                <Linkedin className="h-4 w-4 text-amber-200" aria-hidden="true" /> LinkedIn
              </a>
              <a href="https://github.com/Shaj2x" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-white/75 transition-colors hover:text-white">
                <Github className="h-4 w-4 text-amber-200" aria-hidden="true" /> GitHub
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative border-t border-white/5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-white/55 sm:px-8">
          <p>Built by Shajith Sasikumar © {new Date().getFullYear()}</p>
          <Link to="/" className="transition-colors hover:text-white">
            Step into the room →
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default ServicesPage;
