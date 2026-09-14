import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Reveal from "@/components/site/Reveal";
import SectionHead from "@/components/site/SectionHead";
import LedgerRow from "@/components/site/LedgerRow";
import { profile, projectDemos, projectNotes, projectsInProgress } from "@/content/profile";

interface Repo {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
}

type State =
  | { status: "loading" }
  | { status: "ready"; repos: Repo[] }
  | { status: "error" };

const prettyName = (name: string) =>
  name.replace(/---.*$/, "").replace(/[-_]+/g, " ").trim();

const Work = () => {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    fetch(`https://api.github.com/users/${profile.githubUser}/repos?sort=updated&per_page=12`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
        return res.json() as Promise<Repo[]>;
      })
      .then((data) => {
        const repos = data.filter(
          (r) => r.name !== profile.githubUser && r.name !== `${profile.githubUser}.github.io`
        );
        setState({ status: "ready", repos });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({ status: "error" });
      });

    return () => controller.abort();
  }, []);

  return (
    <section id="work" className="section border-b border-border">
      <div className="measure">
        <SectionHead kicker="Selected work" title="Things I've shipped">
          Pulled live from{" "}
          <a
            href={profile.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline decoration-primary/30 underline-offset-[4px] hover:decoration-primary"
          >
            GitHub
          </a>
          , newest first.
        </SectionHead>

        {state.status === "loading" && (
          <ul className="ledger" aria-busy="true" aria-label="Loading repositories">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="ledger-row">
                <div className="h-3 w-20 animate-pulse rounded-sm bg-muted" />
                <div className="space-y-2">
                  <div className="h-4 w-48 animate-pulse rounded-sm bg-muted" />
                  <div className="h-3 w-full max-w-md animate-pulse rounded-sm bg-muted" />
                </div>
                <div className="h-3 w-16 animate-pulse rounded-sm bg-muted md:justify-self-end" />
              </li>
            ))}
          </ul>
        )}

        {state.status === "error" && (
          <div className="border-l-2 border-signal bg-secondary/60 px-5 py-4">
            <p className="font-display text-sm font-semibold">GitHub didn't answer.</p>
            <p className="prose-measure mt-1.5 text-[0.9375rem] text-muted-foreground">
              The repository list is fetched live and the request failed — usually a rate limit.
              You can{" "}
              <a
                href={profile.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline decoration-primary/30 underline-offset-[4px] hover:decoration-primary"
              >
                browse the repositories directly
              </a>{" "}
              in the meantime.
            </p>
          </div>
        )}

        {state.status === "ready" && state.repos.length === 0 && (
          <p className="text-muted-foreground">No public repositories to show right now.</p>
        )}

        {state.status === "ready" && state.repos.length > 0 && (
          <Reveal>
            <ul className="ledger">
              {state.repos.map((repo) => {
                const demo = projectDemos[repo.name];
                const inProgress = projectsInProgress.includes(repo.name);
                return (
                  <LedgerRow
                    key={repo.id}
                    period={new Date(repo.updated_at).toLocaleDateString("en-CA", {
                      year: "numeric",
                      month: "short",
                    })}
                    title={prettyName(repo.name)}
                    href={repo.html_url}
                    org={repo.language ?? undefined}
                    note={projectNotes[repo.name] ?? repo.description ?? undefined}
                    tag={inProgress ? "In progress" : undefined}
                    trailing={
                      <>
                        {repo.stargazers_count > 0 && (
                          <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-muted-foreground tnum">
                            ★ {repo.stargazers_count}
                          </span>
                        )}
                        {demo && (
                          <a
                            href={demo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-primary underline decoration-primary/30 underline-offset-[4px] hover:decoration-primary"
                          >
                            Live demo
                            <ArrowUpRight
                              size={11}
                              strokeWidth={2}
                              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                            />
                          </a>
                        )}
                      </>
                    }
                  />
                );
              })}
            </ul>
          </Reveal>
        )}

        <a
          href={`${profile.github}?tab=repositories`}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-7 inline-flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-primary underline decoration-primary/30 underline-offset-[5px] hover:decoration-primary"
        >
          All repositories
          <ArrowUpRight
            size={12}
            strokeWidth={2}
            className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </a>
      </div>
    </section>
  );
};

export default Work;
