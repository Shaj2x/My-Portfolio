import { useEffect, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight, DoorOpen, Gamepad2, Github } from "lucide-react";
import { caseStudies } from "@/data/caseStudies";
import { demoLinks, demoVideos, GITHUB_USERNAME } from "@/data/portfolio";
import { DemoSources } from "@/components/DemoVideo";
import NotFound from "./NotFound";

/*
 * A case study: why a project exists, what it does, how it works and the decisions behind it.
 * Same materials as the quick view (near-black, warm amber, frosted glass) so it reads as part of it.
 */

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const Reveal = ({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(16px)" }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
};

const Glass = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ${className}`}>{children}</div>
);

const Heading = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <div className="mb-6">
    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200/75">{eyebrow}</p>
    <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">{title}</h2>
  </div>
);

const CaseStudy = () => {
  const { slug } = useParams();
  const reduce = useReducedMotion();
  const index = caseStudies.findIndex((c) => c.slug === slug);
  const study = caseStudies[index];

  useEffect(() => {
    if (!study) return;
    const prev = document.title;
    document.title = `${study.title} · Case study · Shajith Sasikumar`;
    window.scrollTo(0, 0);
    return () => {
      document.title = prev;
    };
  }, [study]);

  if (!study) return <NotFound />;
  const video = demoVideos[study.repo];
  const live = demoLinks[study.repo];
  const code = `https://github.com/${GITHUB_USERNAME}/${study.repo}`;
  const next = caseStudies[(index + 1) % caseStudies.length];

  return (
    <div className="min-h-screen bg-[#0d0e11] text-white selection:bg-amber-200/30">
      {/* the room's light, as on the quick view */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(255,190,110,0.16),transparent)]" />
        <div className="absolute -left-48 top-24 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(90,120,220,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px] opacity-40" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0d0e11]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link to="/quick#projects" className="inline-flex items-center gap-2 text-sm text-white/65 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All projects
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-amber-200 px-4 py-2 text-sm font-semibold text-[#1a1206] transition-[background-color,transform] duration-150 hover:bg-amber-100 active:scale-[0.97]">
            <DoorOpen className="h-4 w-4" /> <span className="hidden sm:inline">Step into the room</span>
            <span className="sm:hidden">The room</span>
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-5 sm:px-8">
        {/* title */}
        <section className="pb-10 pt-14 sm:pt-20">
          <motion.p
            className="text-[11px] font-semibold uppercase tracking-[0.36em] text-amber-200/80"
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          >
            Case study
          </motion.p>
          <h1 className="mt-4 overflow-hidden pb-[0.08em] text-5xl font-bold leading-[0.95] tracking-[-0.045em] sm:text-7xl">
            <motion.span
              className="inline-block"
              initial={reduce ? { opacity: 0 } : { transform: "translateY(105%)" }}
              animate={reduce ? { opacity: 1 } : { transform: "translateY(0%)" }}
              transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.08 }}
            >
              {study.title}
            </motion.span>
          </h1>
          <Reveal delay={0.2}>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">{study.tagline}</p>
            <dl className="mt-8 grid gap-3 sm:grid-cols-3">
              {study.facts.map((f) => (
                <Glass key={f.label} className="p-4">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">{f.label}</dt>
                  <dd className="mt-1.5 text-sm leading-snug text-white/85">{f.value}</dd>
                </Glass>
              ))}
            </dl>
          </Reveal>
        </section>

        {/* the demo */}
        {video && (
          <Reveal>
            <figure className="overflow-hidden rounded-[22px] border border-white/10 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
              <video poster={video.poster} controls muted loop playsInline autoPlay={!reduce} className="aspect-video w-full bg-black">
                <DemoSources video={video} />
              </video>
            </figure>
            {video.note && <figcaption className="mt-2.5 text-xs text-white/50">{video.note}</figcaption>}
          </Reveal>
        )}

        {/* why */}
        <section className="py-14">
          <Heading eyebrow="Why I built it" title="The problem" />
          <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
            <Reveal className="space-y-4 text-base leading-relaxed text-white/70">
              {study.story.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </Reveal>
            <Reveal delay={0.1}>
              <blockquote className="border-l-2 border-amber-200/60 pl-5 text-2xl font-semibold leading-snug tracking-[-0.02em] text-amber-100 sm:text-3xl">{study.question}</blockquote>
            </Reveal>
          </div>
        </section>

        {/* what */}
        <section className="py-10">
          <Heading eyebrow="What it does" title="For the people using it" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {study.features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.05} className="h-full">
                <Glass className="h-full p-5">
                  <h3 className="font-semibold text-white">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/65">{f.text}</p>
                </Glass>
              </Reveal>
            ))}
          </div>
        </section>

        {/* how */}
        <section className="py-10">
          <Heading eyebrow="How it works" title="From input to result" />
          <Reveal>
            <ol className="grid gap-2 lg:grid-cols-5 lg:gap-0">
              {study.flow.map((s, i) => (
                <li key={s.step} className="relative flex lg:block">
                  <Glass className="w-full p-4 lg:mx-1.5 lg:h-full">
                    <p className="font-mono text-[11px] text-amber-200/70">{String(i + 1).padStart(2, "0")}</p>
                    <p className="mt-1 font-semibold text-white">{s.step}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/60">{s.detail}</p>
                  </Glass>
                  {i < study.flow.length - 1 && (
                    <ArrowRight className="absolute -right-2.5 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-amber-200/70 lg:block" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        {/* decisions */}
        <section className="py-10">
          <Heading eyebrow="Decisions" title="What shaped it" />
          <div className="grid gap-3 md:grid-cols-2">
            {study.decisions.map((d, i) => (
              <Reveal key={d.title} delay={(i % 2) * 0.05} className="h-full">
                <Glass className="h-full p-5 sm:p-6">
                  <h3 className="text-lg font-semibold text-white">{d.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">{d.text}</p>
                </Glass>
              </Reveal>
            ))}
          </div>
        </section>

        {/* status */}
        <section className="py-10">
          <Heading eyebrow="Where it stands" title="Done, and next" />
          <Reveal>
            <Glass className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1.4fr_1fr]">
              <p className="leading-relaxed text-white/75">{study.status}</p>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">Next</p>
                <ul className="mt-3 space-y-2">
                  {study.next.map((n) => (
                    <li key={n} className="flex gap-2.5 text-sm text-white/75">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-200" aria-hidden="true" />
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            </Glass>
          </Reveal>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {live && (
              <a href={live} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-amber-200 px-4 py-2 text-sm font-semibold text-[#1a1206] transition-[background-color,transform] duration-150 hover:bg-amber-100 active:scale-[0.97]">
                <Gamepad2 className="h-4 w-4" /> Try it live
              </a>
            )}
            <a href={code} target="_blank" rel="noopener noreferrer" className="liquid-glass on-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white/90 transition-[transform] duration-150 hover:text-white active:scale-[0.97]">
              <Github className="h-4 w-4" /> Read the code
            </a>
          </div>
        </section>

        {/* next study */}
        <section className="pb-16 pt-6">
          <Link to={`/work/${next.slug}`} className="group block">
            <Glass className="flex items-center justify-between gap-4 p-6 transition-[border-color,background-color] duration-200 group-hover:border-white/20 group-hover:bg-white/[0.06] sm:p-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200/75">Next case study</p>
                <p className="mt-2 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">{next.title}</p>
                <p className="mt-1 text-sm text-white/55">{next.tagline}</p>
              </div>
              <ArrowUpRight className="h-6 w-6 shrink-0 text-white/50 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
            </Glass>
          </Link>
        </section>
      </main>
    </div>
  );
};

export default CaseStudy;
