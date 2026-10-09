import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Bot, Building2, CircuitBoard, DoorOpen, FileText, FolderGit2, Gamepad2, Github, Linkedin, Mail, MapPin, Music2, type LucideIcon } from "lucide-react";
import {
  aboutParagraphs,
  customDescriptions,
  demoLinks,
  displayNames,
  education,
  experience,
  featuredProjects,
  GITHUB_USERNAME,
  inProgressRepos,
  profile,
  projectPreviews,
  roles,
  services,
  skillCategories,
} from "@/data/portfolio";

/*
 * The quick view: the whole portfolio on one calm page, for anyone short on time (or on a slow
 * phone). Same materials as the room: near-black, warm amber light, frosted glass, and the room
 * itself framed in the hero as the way back in. No three.js here, so it opens instantly.
 */

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** fades a block up into place the first time it scrolls into view */
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

/** when the accessibility statement below was last checked against the page */
const ACCESSIBILITY_REVIEWED = "October 2026";

const SectionTitle = ({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) => (
  <div id={id} className="mb-6 scroll-mt-24">
    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200/75">{eyebrow}</p>
    <h2 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">{title}</h2>
  </div>
);

const Glass = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`sheen rounded-2xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition-[border-color,background-color,transform] duration-200 hover:border-white/20 hover:bg-white/[0.06] motion-safe:hover:-translate-y-0.5 ${className}`}>
    {children}
  </div>
);

const Action = ({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) => (
  <a
    href={href}
    target={href.startsWith("mailto:") ? undefined : "_blank"}
    rel="noopener noreferrer"
    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] ${
      primary ? "bg-amber-200 text-[#1a1206] hover:bg-amber-100" : "liquid-glass on-glass text-white/90 hover:text-white"
    }`}
  >
    {children}
  </a>
);

/** cover art for projects without a screenshot: an icon that says what it is, in its own colour */
const COVERS: Record<string, { icon: LucideIcon; tint: string }> = {
  "schematica-circuits": { icon: CircuitBoard, tint: "56,189,148" },
  devassist: { icon: Bot, tint: "120,140,255" },
  "Marq-Living-Platform": { icon: Building2, tint: "252,190,110" },
  HarmonAI: { icon: Music2, tint: "236,110,170" },
};

/** a project tile: its screenshot when there is one, otherwise cover art */
const ProjectCard = ({ name, delay }: { name: string; delay: number }) => {
  const title = displayNames[name] ?? name.replace(/-+/g, " ");
  const description = customDescriptions[name];
  const demo = demoLinks[name];
  const image = projectPreviews[name];
  const building = inProgressRepos.includes(name);
  return (
    <Reveal delay={delay} className="h-full">
      <Glass className="group flex h-full flex-col overflow-hidden">
        <div className="relative aspect-[16/9] overflow-hidden border-b border-white/10 bg-[#0b0c10]">
          {image ? (
            <img src={image} alt={`${title} screenshot`} loading="lazy" className="h-full w-full object-cover object-top opacity-90 transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
          ) : (
            (() => {
              const cover = COVERS[name] ?? { icon: FolderGit2, tint: "252,217,154" };
              return (
                <div
                  className="relative grid h-full w-full place-items-center"
                  style={{ background: `radial-gradient(90% 80% at 75% 15%, rgba(${cover.tint},0.32), transparent 65%), radial-gradient(70% 60% at 10% 100%, rgba(${cover.tint},0.14), transparent 70%), linear-gradient(135deg, #14161f, #07080c)` }}
                >
                  {/* a faint grid, like the room's dot grain */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(closest-side,black,transparent)]" />
                  <span className="relative grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.4)] backdrop-blur-md transition-transform duration-500 ease-out group-hover:scale-105" style={{ boxShadow: `0 0 40px rgba(${cover.tint},0.25)` }}>
                    <cover.icon className="h-7 w-7" style={{ color: `rgb(${cover.tint})` }} />
                  </span>
                </div>
              );
            })()
          )}
          {building && <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-amber-200 backdrop-blur-md">In progress</span>}
        </div>
        <div className="flex flex-1 flex-col p-5">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {description && <p className="mt-1.5 flex-1 text-sm leading-relaxed text-white/65">{description}</p>}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {demo && (
              <a href={demo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-amber-200 hover:text-amber-100">
                <Gamepad2 className="h-4 w-4" /> Live demo
              </a>
            )}
            <a href={`https://github.com/${GITHUB_USERNAME}/${name}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-white/60 hover:text-white">
              <Github className="h-4 w-4" /> Code
            </a>
          </div>
        </div>
      </Glass>
    </Reveal>
  );
};

const NAV = [
  ["about", "About"],
  ["projects", "Projects"],
  ["experience", "Experience"],
  ["skills", "Skills"],
  ["contact", "Contact"],
] as const;

const QuickView = () => {
  const reduce = useReducedMotion();
  useEffect(() => {
    const prev = document.title;
    document.title = "Shajith Sasikumar · Quick view";
    return () => {
      document.title = prev;
    };
  }, []);
  const timeline = [...education, ...experience];

  return (
    <div className="min-h-screen bg-[#0d0e11] text-white selection:bg-amber-200/30">
      {/* the room's light: a warm lamp glow top right, a cool window glow top left, faint dot grain */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(255,190,110,0.16),transparent)]" />
        <div className="absolute -left-48 top-24 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(90,120,220,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px] opacity-40" />
      </div>

      {/* top bar */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0d0e11]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-[#c87a3a] text-xs font-bold text-[#1a1206]">SS</span>
            <span className="hidden text-sm font-semibold sm:inline">{profile.name}</span>
          </a>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="rounded-full px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white">
                {label}
              </a>
            ))}
          </nav>
          <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-amber-200 px-4 py-2 text-sm font-semibold text-[#1a1206] transition-[background-color,transform] duration-150 hover:bg-amber-100 active:scale-[0.97]">
            <DoorOpen className="h-4 w-4" /> Step into the room
          </Link>
        </div>
      </header>

      <main id="top" className="relative mx-auto max-w-6xl px-5 sm:px-8">
        {/* hero */}
        <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <motion.p
              className="text-[11px] font-semibold uppercase tracking-[0.36em] text-amber-200/80"
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            >
              Portfolio · Quick view
            </motion.p>
            <h1 className="mt-4 text-5xl font-bold leading-[0.95] tracking-[-0.045em] sm:text-7xl">
              {profile.name.split(" ").map((word, i) => (
                <span key={word} className="block overflow-hidden pb-[0.08em]">
                  <motion.span
                    className="inline-block"
                    initial={reduce ? { opacity: 0 } : { transform: "translateY(105%)" }}
                    animate={reduce ? { opacity: 1 } : { transform: "translateY(0%)" }}
                    transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.1 + i * 0.08 }}
                  >
                    {word}
                  </motion.span>
                </span>
              ))}
            </h1>
            <Reveal delay={0.3}>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">{profile.tagline}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-white/55">
                <MapPin className="h-4 w-4" /> London, Ontario · Western University
              </p>
              <div className="mt-7 flex flex-wrap gap-2.5">
                {profile.resumePdf && (
                  <Action href={profile.resumePdf} primary>
                    <FileText className="h-4 w-4" /> Resume
                  </Action>
                )}
                <Action href={`mailto:${profile.email}`}>
                  <Mail className="h-4 w-4" /> Email
                </Action>
                <Action href={profile.linkedin}>
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </Action>
                <Action href={profile.github}>
                  <Github className="h-4 w-4" /> GitHub
                </Action>
              </div>
            </Reveal>
          </div>
          {/* the room, framed like a window into it */}
          <Reveal delay={0.2}>
            <Link to="/" className="group relative block overflow-hidden rounded-[28px] border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
              <img src="/room.jpg" alt="Shajith's dorm room recreated in 3D, at night" className="aspect-[1200/630] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-end gap-3 p-5 sm:justify-between">
                <p className="hidden max-w-[16rem] text-sm text-white/80 sm:block">The full portfolio is hidden around my dorm room, recreated in 3D.</p>
                <span className="liquid-glass on-glass inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium">
                  Step inside <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          </Reveal>
        </section>

        {/* about */}
        <section className="py-12">
          <SectionTitle id="about" eyebrow="About" title="Engineering, business, and building things" />
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <Reveal className="space-y-4 text-base leading-relaxed text-white/70">
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
            </Reveal>
            <div className="grid grid-cols-2 content-start gap-3">
              {[
                ["2", "degrees at once: BESc + Ivey HBA"],
                ["10K+", "followers for my streetwear brand, started at 15"],
                ["96.3%", "four-year high school average"],
                ["3", "student and community leadership roles"],
              ].map(([n, label], i) => (
                <Reveal key={label} delay={i * 0.06}>
                  <Glass className="h-full p-4">
                    <p className="text-3xl font-bold tracking-[-0.03em] text-amber-200">{n}</p>
                    <p className="mt-1 text-xs leading-snug text-white/60">{label}</p>
                  </Glass>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* projects */}
        <section className="py-12">
          <SectionTitle id="projects" eyebrow="Projects" title="Things I've built" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProjects.map((name, i) => (
              <ProjectCard key={name} name={name} delay={(i % 3) * 0.06} />
            ))}
          </div>
          <Reveal>
            <a href={profile.github} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
              <Github className="h-4 w-4" /> Everything on GitHub <ArrowUpRight className="h-4 w-4" />
            </a>
          </Reveal>
        </section>

        {/* experience and education, as one timeline */}
        <section className="py-12">
          <SectionTitle id="experience" eyebrow="Experience" title="Where I've been" />
          <ol className="relative border-l border-white/10 pl-6 sm:pl-8">
            {timeline.map((item, i) => (
              <li key={`${item.title}-${item.org}`} className="relative pb-7 last:pb-0">
                <span className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 sm:-left-[39px] ${item.type === "education" ? "border-amber-200 bg-amber-200/30" : "border-white/50 bg-[#0d0e11]"}`} aria-hidden="true" />
                <Reveal delay={Math.min(i, 4) * 0.04}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-semibold text-white">
                      {item.title} <span className="font-normal text-white/50">· {item.org}</span>
                    </h3>
                    <p className="font-mono text-xs text-white/55">{item.date}</p>
                  </div>
                  <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-white/60">{item.description}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        {/* leadership */}
        <section className="py-12">
          <SectionTitle id="leadership" eyebrow="Leadership" title="Leading people" />
          <div className="grid gap-4 md:grid-cols-3">
            {roles.map((r, i) => (
              <Reveal key={r.title} delay={i * 0.06} className="h-full">
                <Glass className="h-full p-5">
                  <r.icon className="h-5 w-5 text-amber-200" />
                  <h3 className="mt-3 font-semibold text-white">{r.title}</h3>
                  <p className="text-sm text-white/50">{r.org}</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">{r.description}</p>
                </Glass>
              </Reveal>
            ))}
          </div>
        </section>

        {/* services */}
        <section className="py-12">
          <SectionTitle id="services" eyebrow="Services" title="What I build for businesses" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <Reveal key={s.title} delay={(i % 3) * 0.06} className="h-full">
                <Glass className="h-full p-5">
                  <s.icon className="h-5 w-5 text-amber-200" />
                  <h3 className="mt-3 font-semibold text-white">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">{s.description}</p>
                </Glass>
              </Reveal>
            ))}
          </div>
        </section>

        {/* skills */}
        <section className="py-12">
          <SectionTitle id="skills" eyebrow="Skills" title="Tools of the trade" />
          <div className="grid gap-4 sm:grid-cols-2">
            {skillCategories.map((c, i) => (
              <Reveal key={c.title} delay={(i % 2) * 0.06}>
                <Glass className="p-5">
                  <h3 className="text-sm font-semibold text-white/80">{c.title}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.skills.map((skill) => (
                      <span key={skill} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-white/80">
                        {skill}
                      </span>
                    ))}
                  </div>
                </Glass>
              </Reveal>
            ))}
          </div>
        </section>

        {/* contact */}
        <section className="py-14">
          <Reveal>
            <div id="contact" className="relative scroll-mt-24 overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(120%_120%_at_85%_0%,rgba(252,217,154,0.18),transparent_55%),linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-8 sm:p-12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200/75">Contact</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-[-0.03em] sm:text-5xl">Let's build something.</h2>
              <p className="mt-4 max-w-xl text-white/65">Internships, projects, or a business that could use an AI receptionist or a new website: my inbox is open.</p>
              <div className="mt-8 flex flex-wrap gap-2.5">
                <Action href={`mailto:${profile.email}`} primary>
                  <Mail className="h-4 w-4" /> {profile.email}
                </Action>
                <Action href={profile.linkedin}>
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </Action>
                {profile.resumePdf && (
                  <Action href={profile.resumePdf}>
                    <FileText className="h-4 w-4" /> Resume
                  </Action>
                )}
              </div>
            </div>
          </Reveal>
        </section>

        {/* accessibility statement */}
        <section aria-labelledby="accessibility-title" className="border-t border-white/5 py-10">
          <h2 id="accessibility-title" className="text-lg font-semibold text-white/85">
            Accessibility statement
          </h2>
          <div className="mt-3 grid max-w-3xl gap-3 text-sm leading-relaxed text-white/60">
            <p>
              I want everyone to be able to use this site, including people who rely on a keyboard, a screen reader, magnification or reduced motion. I aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA, and I keep working toward it as the site changes.
            </p>
            <p>
              <span className="text-white/80">What's in place:</span> this quick view is the accessible version of the site and carries the same portfolio as the 3D room: projects, experience, skills, the resume and contact details. It uses real headings and landmarks, works with a keyboard, describes its images with alternative text, keeps text readable against its background, and turns its animations down when your device asks for reduced motion.
            </p>
            <p>
              <span className="text-white/80">Known limitations:</span> the 3D room on the home page is a visual, pointer-driven experience and can't be fully used with a screen reader or keyboard alone. Its games and the room's sound are extras, and everything that matters there is also here. Some linked project demos are hosted elsewhere and may not meet the same standard.
            </p>
            <p>
              <span className="text-white/80">Feedback:</span> if anything here gets in your way, or you'd like the content in another format, email{" "}
              <a href={`mailto:${profile.email}`} className="text-amber-200/90 underline underline-offset-2 hover:text-amber-100">
                {profile.email}
              </a>
              . I'll reply within five business days and do my best to fix it or get you what you need another way.
            </p>
            <p className="text-white/55">Last reviewed {ACCESSIBILITY_REVIEWED}.</p>
          </div>
        </section>

        <footer className="flex flex-col items-center justify-between gap-3 border-t border-white/5 py-8 text-sm text-white/55 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {profile.name} ·{" "}
            <a href="#accessibility-title" className="hover:text-white">
              Accessibility
            </a>
          </p>
          <Link to="/" className="inline-flex items-center gap-1.5 hover:text-white">
            <DoorOpen className="h-4 w-4" /> The 3D version is more fun. Step into the room
          </Link>
        </footer>
      </main>
    </div>
  );
};

export default QuickView;
