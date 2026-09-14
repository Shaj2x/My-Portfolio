import { useEffect, useState } from "react";
import Band from "@/components/site/Band";
import Kicker from "@/components/site/Kicker";
import Reveal from "@/components/site/Reveal";
import ListRow from "@/components/site/ListRow";
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

type State = { status: "loading" } | { status: "ready"; repos: Repo[] } | { status: "error" };

const prettyName = (name: string) => name.replace(/---.*$/, "").replace(/[-_]+/g, " ").trim();

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
    <Band id="work">
      <Reveal>
        <Kicker>Selected work</Kicker>
        <h2 className="t-heading-lg mt-7 max-w-[15ch]">Things I have shipped</h2>
        <p className="t-body-sm mt-7 max-w-[46ch] text-felt-gray">
          Pulled live from GitHub, newest first.
        </p>
      </Reveal>

      {state.status === "loading" && (
        <ul className="mt-11.5 border-t border-obsidian/15" aria-busy="true" aria-label="Loading repositories">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="border-b border-obsidian/15 py-7">
              <div className="h-[11px] w-[88px] bg-obsidian/10" />
              <div className="mt-3.5 h-[30px] w-[280px] max-w-full bg-obsidian/10" />
              <div className="mt-3.5 h-[16px] w-[440px] max-w-full bg-obsidian/10" />
            </li>
          ))}
        </ul>
      )}

      {state.status === "error" && (
        <div className="mt-11.5 border-t border-obsidian py-7">
          <p className="t-subheading">GitHub did not answer.</p>
          <p className="t-body-sm mt-3.5 max-w-[52ch] text-felt-gray">
            The repository list is fetched live and the request failed — usually a rate limit.
          </p>
          <a
            href={profile.github}
            target="_blank"
            rel="noopener noreferrer"
            className="t-label link mt-7 inline-block"
          >
            Browse the repositories directly →
          </a>
        </div>
      )}

      {state.status === "ready" && state.repos.length === 0 && (
        <p className="t-body-sm mt-11.5 text-felt-gray">No public repositories to show right now.</p>
      )}

      {state.status === "ready" && state.repos.length > 0 && (
        <Reveal>
          <ul className="mt-11.5 border-t border-obsidian/15">
            {state.repos.map((repo) => (
              <ListRow
                key={repo.id}
                period={new Date(repo.updated_at).toLocaleDateString("en-CA", {
                  year: "numeric",
                  month: "short",
                })}
                title={prettyName(repo.name)}
                href={repo.html_url}
                org={repo.language ?? undefined}
                note={projectNotes[repo.name] ?? repo.description ?? undefined}
                tag={projectsInProgress.includes(repo.name) ? "In progress" : undefined}
                trailing={
                  <>
                    {repo.stargazers_count > 0 && (
                      <span className="t-label tnum text-felt-gray">
                        {repo.stargazers_count} stars
                      </span>
                    )}
                    {projectDemos[repo.name] && (
                      <a
                        href={projectDemos[repo.name]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="t-label link"
                      >
                        Live demo →
                      </a>
                    )}
                  </>
                }
              />
            ))}
          </ul>
        </Reveal>
      )}

      <a
        href={`${profile.github}?tab=repositories`}
        target="_blank"
        rel="noopener noreferrer"
        className="t-label link mt-10 inline-block"
      >
        All repositories →
      </a>
    </Band>
  );
};

export default Work;
