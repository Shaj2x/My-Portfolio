import { useEffect, useState } from "react";
import { ExternalLink, Github, Star, GitFork, Loader2, Gamepad2, Construction } from "lucide-react";
import { motion } from "framer-motion";
import MotionSection from "./MotionSection";

interface GitHubRepo {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  updated_at: string;
}

const GITHUB_USERNAME = "Shaj2x";

const demoLinks: Record<string, string> = {
  "Raptors-Slot-Machine": "https://shaj2x.github.io/Raptors-Slot-Machine/",
  "Raptors-BlackJack": "https://shaj2x.github.io/Raptors-BlackJack/",
  "StatStack": "https://shaj2x.github.io/StatStack/",
  "Mercatus": "https://shaj2x.github.io/Mercatus/",
  "Anthropogenic-Sound-Device-Simulator---ES1050-Project": "https://shaj2x.github.io/Anthropogenic-Sound-Device-Simulator---ES1050-Project/",
};

const inProgressRepos = ["MarkWise", "HarmonAI"];

const customDescriptions: Record<string, string> = {
  "Mercatus": "A strategy game that teaches stocks, crypto, and market timing through simulated trading decisions.",
};

const languageColors: Record<string, string> = {
  HTML: "hsl(12, 80%, 55%)",
  CSS: "hsl(264, 60%, 55%)",
  JavaScript: "hsl(53, 93%, 54%)",
  TypeScript: "hsl(211, 60%, 48%)",
  Python: "hsl(207, 55%, 45%)",
  Java: "hsl(20, 70%, 50%)",
  "C++": "hsl(340, 55%, 50%)",
  "C#": "hsl(270, 60%, 50%)",
};

const Projects = () => {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=10`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data: GitHubRepo[]) => {
        const filtered = data.filter(
          (r) => r.name !== GITHUB_USERNAME && r.name !== `${GITHUB_USERNAME}.github.io`
        );
        setRepos(filtered);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <section id="projects" className="section-padding">
      <MotionSection className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          <span className="text-gradient">02.</span> Projects
        </h2>
        <p className="text-muted-foreground mb-12">
          Live from{" "}
          <a
            href={`https://github.com/${GITHUB_USERNAME}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            GitHub
          </a>
        </p>

        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        )}

        {error && (
          <p className="text-center text-muted-foreground py-20">
            Couldn't load repositories. Check back later!
          </p>
        )}

        {!loading && !error && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {repos.map((repo, i) => (
              <motion.div
                key={repo.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6 }}
                className="group bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors duration-300 flex flex-col h-[320px]"
              >
                <div className="flex items-center justify-between mb-4">
                  <Github className="text-primary" size={22} />
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>

                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                  {repo.name.replace(/-/g, " ")}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-1">
                  {customDescriptions[repo.name] || repo.description || "No description provided."}
                </p>
                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mb-4"
                >
                  See more →
                </a>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4 mt-auto">
                  {repo.language && (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: languageColors[repo.language] || "hsl(0,0%,50%)" }}
                      />
                      {repo.language}
                    </span>
                  )}
                  {repo.stargazers_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Star size={12} /> {repo.stargazers_count}
                    </span>
                  )}
                  {repo.forks_count > 0 && (
                    <span className="flex items-center gap-1">
                      <GitFork size={12} /> {repo.forks_count}
                    </span>
                  )}
                </div>

                {demoLinks[repo.name] && (
                  <a
                    href={demoLinks[repo.name]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors text-sm font-medium w-fit"
                  >
                    <Gamepad2 size={16} />
                    Play Live Demo
                  </a>
                )}
                {inProgressRepos.includes(repo.name) && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-md text-sm font-medium w-fit">
                    <Construction size={16} />
                    In Progress
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}

        <div className="text-center mt-10">
          <a
            href={`https://github.com/${GITHUB_USERNAME}?tab=repositories`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 border border-primary text-primary rounded-md hover:bg-primary/10 transition-colors font-mono text-sm"
          >
            View All on GitHub <ExternalLink size={14} />
          </a>
        </div>
      </MotionSection>
    </section>
  );
};

export default Projects;
