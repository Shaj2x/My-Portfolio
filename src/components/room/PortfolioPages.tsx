import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FileText, Gamepad2, Github, Linkedin, Mail } from "lucide-react";
import {
  aboutParagraphs,
  customDescriptions,
  demoLinks,
  education,
  experience,
  GITHUB_USERNAME,
  inProgressRepos,
  displayNames,
  profile,
  roles,
  services,
  skillCategories,
} from "@/data/portfolio";
import type { PortfolioId } from "./portfolioSpots";

/* The sections of the portfolio, as they appear when found around the room. */

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">{title}</h3>
    {children}
  </section>
);

const Card = ({ children }: { children: ReactNode }) => (
  <div className="sheen rounded-xl border border-white/10 bg-white/[0.04] p-4 transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:border-white/20 hover:bg-white/[0.07] hover:shadow-[0_10px_30px_rgba(0,0,0,0.25)] motion-safe:hover:-translate-y-0.5">{children}</div>
);

export const LinkButton = ({ href, children }: { href: string; children: ReactNode }) => (
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
  /** the "website" set on the repo, used as a demo link when there isn't one here */
  homepage?: string | null;
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
        {repos.map((r) => {
          // what's written here wins over GitHub's (often empty) description and website
          const description = customDescriptions[r.name] ?? r.description;
          const demo = demoLinks[r.name] ?? (r.homepage || null);
          return (
            <Card key={r.name}>
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 break-words font-semibold text-white">{displayNames[r.name] ?? r.name.replace(/-+/g, " ")}</p>
                {inProgressRepos.includes(r.name) && <span className="shrink-0 rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">In progress</span>}
              </div>
              {description && <p className="mt-1.5 text-sm text-white/70">{description}</p>}
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {demo && (
                  <a className="inline-flex items-center gap-1 text-[#7fb2ff] hover:text-white" href={demo} target="_blank" rel="noopener noreferrer">
                    <Gamepad2 className="h-4 w-4" /> Live demo
                  </a>
                )}
                <a className="inline-flex items-center gap-1 text-white/60 hover:text-white" href={r.html_url} target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4" /> Code
                </a>
              </div>
            </Card>
          );
        })}
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

export const PortfolioPage = ({ id }: { id: PortfolioId }) => {
  switch (id) {
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
  }
};
