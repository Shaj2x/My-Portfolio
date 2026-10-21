import { caseStudies, type CaseStudy } from "@/data/caseStudies";
import { customDescriptions, demoLinks, demoVideos, displayNames, education, experience, featuredProjects, nowBuilding, skillCategories, type TimelineItem } from "@/data/portfolio";
import { EMAIL, knowledge, starters, type Entry, type Link } from "./knowledge";

/*
 * The assistant's brain, with no AI model and no network: it reads the question, works out what it's
 * about (a project, a skill, an internship, or one of the taught answers in knowledge.ts), and
 * answers from the site's own data. When nothing matches well enough it says so, rather than guess.
 */

export interface Reply {
  text: string;
  links?: Link[];
  follow?: string[];
  /** a project whose demo video can be played inline */
  video?: string;
}

// ---------- reading the question ----------

const STOP = new Set(
  "a an the is are was were be been am do does did doing you your youre yours he his him she her they their them shajith i me my mine we our it its this that these those of to in on for and or with at by from as about tell can could would should will please any some there here have has had just really also so much very get got".split(
    " ",
  ),
);

/** a few spellings and synonyms folded together, so "uni", "university" and "school" all count as one word */
const CANON: Record<string, string> = {
  uni: "school", university: "school", college: "school", western: "school", program: "school", programme: "school", major: "school", degree: "school", studi: "study",
  internship: "intern", interned: "intern", interning: "intern", coop: "intern", "co-op": "intern", job: "work", worked: "work", working: "work", employment: "work", career: "work",
  built: "build", building: "build", made: "build", make: "build", making: "build", create: "build", created: "build", develop: "build", developed: "build",
  inspired: "why", inspiration: "why", motivation: "why", motivate: "why", reason: "why", purpose: "why", story: "why", origin: "why", idea: "why", problem: "why",
  technologies: "stack", technology: "stack", tech: "stack", tool: "stack", tools: "stack", framework: "stack", frameworks: "stack", written: "stack",
  favourite: "favorite", fav: "favorite", cv: "resume", "résumé": "resume", email: "contact", reach: "contact", hire: "contact",
};

const stem = (t: string) => {
  if (CANON[t]) return CANON[t];
  let s = t;
  if (s.length > 5 && s.endsWith("ing")) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith("ed")) s = s.slice(0, -2);
  else if (s.length > 4 && s.endsWith("es")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  return CANON[s] ?? s;
};

/** lower case, contractions opened up, punctuation gone (but C++, C# and Next.js kept whole) */
export const normalize = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\b(what|who|where|how|that|it)'s\b/g, "$1 is")
    .replace(/'re\b/g, " are")
    .replace(/'ve\b/g, " have")
    .replace(/n't\b/g, " not")
    .replace(/[^a-z0-9+#.'\s-]/g, " ")
    .replace(/(^|\s)'+|'+(\s|$)/g, " ")
    .replace(/\.(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

export const terms = (text: string) =>
  normalize(text)
    .trim()
    .split(" ")
    .map((t) => t.replace(/'/g, ""))
    .filter((t) => t && !STOP.has(t))
    .map(stem);

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(` ${w}`));

// ---------- things the question can be about ----------

interface Project {
  repo: string;
  title: string;
  aliases: string[];
  study?: CaseStudy;
}

const PROJECT_ALIASES: Record<string, string[]> = {
  "Marq-Living-Platform": ["marq living", "marq", "the marq", "shuttle app", "shuttle tracker", "building app"],
  devassist: ["devassist", "dev assist", "dev-assist"],
  "schematica-circuits": ["schematica", "circuit simulator", "circuit app", "circuit solver"],
  digitaldash: ["digital dash", "digitaldash", "study dashboard"],
  Mercatus: ["mercatus", "trading game", "stock game"],
  StatStack: ["statstack", "stat stack", "nba game", "higher or lower"],
  "Anthropogenic-Sound-Device-Simulator---ES1050-Project": ["es1050", "es 1050", "sound device", "noise monitor", "anthropogenic"],
  "Raptors-Slot-Machine": ["slot machine", "slots", "raptors slot"],
  "Raptors-BlackJack": ["blackjack", "black jack"],
  HarmonAI: ["harmonai", "harmon ai", "music quiz"],
};

const projects: Project[] = Object.entries(PROJECT_ALIASES).map(([repo, aliases]) => ({
  repo,
  title: displayNames[repo] ?? repo.replace(/-+/g, " "),
  aliases,
  study: caseStudies.find((c) => c.repo === repo),
}));

/** the longest alias wins, so "the marq" isn't mistaken for something shorter */
const findProject = (q: string) => {
  let best: { p: Project; len: number } | null = null;
  for (const p of projects) for (const a of p.aliases) if (q.includes(` ${a} `) && (!best || a.length > best.len)) best = { p, len: a.length };
  return best?.p ?? null;
};

const ORG_ALIASES: [string[], string][] = [
  [["visual elements", "manufacturing intern", "cnc", "solidworks api", "woodwop", "homag"], "Visual Elements"],
  [["greenveil", "green veil", "packaging"], "GreenVeil"],
  [["thinkthamizh", "think thamizh", "shopify"], "ThinkThamizh"],
  [["elections canada", "deputy returning officer", "returning officer", "election"], "Elections Canada"],
  [["brampton library", "library"], "Brampton Library"],
  [["gradcity", "grad trip"], "GradCity"],
  [["carabram", "tamil association"], "Brampton Tamil Association"],
];

const findJob = (q: string): TimelineItem | null => {
  for (const [aliases, org] of ORG_ALIASES) if (aliases.some((a) => q.includes(` ${a} `))) return experience.find((e) => e.org.includes(org)) ?? null;
  return null;
};

/** every skill on the site, with the other ways people write it */
const SKILL_ALIASES: Record<string, string[]> = {
  TypeScript: ["typescript", "ts"], JavaScript: ["javascript", "js", "node", "node.js", "nodejs"], Python: ["python", "py"], Go: ["golang", "go"], Rust: ["rust"],
  C: ["c"], "C++": ["c++", "cpp"], Java: ["java"], MATLAB: ["matlab"], VBA: ["vba", "excel vba", "macros"],
  React: ["react", "react.js", "reactjs"], "Next.js": ["next.js", "nextjs"], FastAPI: ["fastapi"], PyTorch: ["pytorch", "torch"], Docker: ["docker", "containers"],
  PostgreSQL: ["postgresql", "postgres", "sql"], Redis: ["redis"], Kafka: ["kafka"], TimescaleDB: ["timescaledb", "timescale"], Supabase: ["supabase"], Git: ["git"],
  ESP32: ["esp32", "microcontrollers", "arduino"], Sensors: ["sensors"], PLCs: ["plc", "plcs"], MQTT: ["mqtt", "iot"], "CNC (HOMAG)": ["cnc"], woodWOP: ["woodwop"],
  SolidWorks: ["solidworks", "cad"], OnShape: ["onshape"], Photoshop: ["photoshop"], "After Effects": ["after effects"], "FL Studio": ["fl studio"],
};
/** short names that are also ordinary words: only skills when the question is clearly about skills */
const AMBIGUOUS = new Set(["go", "c", "ts", "js", "py", "node", "sensors", "git", "react", "torch", "containers", "macros", "sql"]);
const SKILL_CONTEXT = ["know", "use", "used", "using", "experience", "familiar", "proficient", "skill", "code", "coding", "program", "programming", "language", "write", "writing", "worked with", "work with", "good at", "comfortable"];

const findSkills = (q: string) => {
  const skillish = has(q, ...SKILL_CONTEXT) || q.trim().split(" ").length <= 2;
  const found: string[] = [];
  for (const [skill, aliases] of Object.entries(SKILL_ALIASES)) {
    const hit = aliases.some((a) => q.includes(` ${a} `) && (!AMBIGUOUS.has(a) || (skillish && !q.includes(` ${a} to `) && !q.includes(` to ${a} `))));
    if (hit) found.push(skill);
  }
  // "C" inside "C++" or "Objective-C" isn't C
  return found.filter((s) => !(s === "C" && found.includes("C++")));
};

/** where on the site a skill shows up: the "Why" pages' stacks and the internships */
const usesOf = (skill: string) => {
  const words = [skill, ...(SKILL_ALIASES[skill] ?? []).filter((a) => !AMBIGUOUS.has(a))].map((w) => w.toLowerCase());
  const mentions = (text: string) => words.some((w) => new RegExp(`(^|[^a-z])${w.replace(/[.+]/g, "\\$&")}([^a-z]|$)`, "i").test(text));
  const inProjects = caseStudies.filter((c) => mentions(c.facts.find((f) => f.label === "Stack")?.value ?? "")).map((c) => c.title);
  const inJobs = experience.filter((e) => mentions(e.description)).map((e) => e.org.split(" · ")[0]);
  const category = skillCategories.find((c) => c.skills.includes(skill))?.title;
  return { inProjects, inJobs, category };
};

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

// ---------- answers built from the site's data ----------

const projectLinks = (p: Project): Link[] => [
  ...(p.study ? [{ label: `Why I built ${p.title}`, href: `/work/${p.study.slug}` }] : []),
  ...(demoLinks[p.repo] ? [{ label: "Try it live", href: demoLinks[p.repo] }] : []),
  { label: "Code", href: `https://github.com/Shaj2x/${p.repo}` },
];

const aboutProject = (p: Project, q: string): Reply => {
  const s = p.study;
  const links = projectLinks(p);
  const video = demoVideos[p.repo] ? p.repo : undefined;
  const more = s ? [`Why did you build ${p.title}?`, `How does ${p.title} work?`, `What is ${p.title} built with?`] : [];
  if (has(q, "why", "inspir", "motivat", "reason", "story", "start", "idea", "problem", "come up")) {
    if (s) return { text: `${s.story[0]}\n\n${s.story[s.story.length - 1]}`, links, video, follow: more.filter((m) => !m.startsWith("Why")) };
  }
  if (s && has(q, "stack", "tech", "built with", "language", "framework", "written in", "use", "made with")) {
    const stack = s.facts.find((f) => f.label === "Stack")?.value;
    return { text: `${p.title} is built with **${stack}**.\n\n${s.flow.map((f) => `**${f.step}:** ${f.detail}`).join("\n")}`, links, follow: more.filter((m) => !m.startsWith("What is")) };
  }
  if (s && has(q, "how", "work", "architecture", "design", "under the hood")) {
    return { text: `${s.flow.map((f, i) => `${i + 1}. **${f.step}:** ${f.detail}`).join("\n")}\n\n${s.decisions[0].title}: ${s.decisions[0].text}`, links, follow: more.filter((m) => !m.startsWith("How")) };
  }
  if (s && has(q, "hard", "challeng", "difficult", "decision", "learn", "tradeoff", "trade-off", "proud")) {
    return { text: s.decisions.slice(0, 2).map((d) => `**${d.title}.** ${d.text}`).join("\n\n"), links, follow: more };
  }
  if (s && has(q, "status", "done", "finish", "complete", "next", "progress", "roadmap", "plan")) {
    return { text: `${s.status}\n\nNext: ${list(s.next.map((n) => n.charAt(0).toLowerCase() + n.slice(1)))}.`, links, follow: more };
  }
  if (has(q, "demo", "video", "try", "see it", "play", "live", "link", "watch")) {
    return { text: demoLinks[p.repo] ? `You can try ${p.title} live, or watch the demo.` : `${p.title} doesn't have a public live version yet, but you can watch a demo of it running.`, links, video, follow: more };
  }
  const desc = customDescriptions[p.repo] ?? `${p.title} is one of my projects.`;
  return { text: `**${p.title}:** ${desc}`, links, video, follow: s ? more : ["What else have you built?"] };
};

const aboutJob = (job: TimelineItem): Reply => ({
  text: `**${job.title}**, ${job.org} (${job.date}).\n\n${job.description}`,
  follow: ["What internships have you done?", "What are your strongest skills?"],
});

const aboutSkills = (skills: string[]): Reply => {
  const parts = skills.map((skill) => {
    const { inProjects, inJobs } = usesOf(skill);
    const where = [...inProjects.map((p) => `${p}`), ...inJobs.map((j) => `my internship at ${j}`)];
    return where.length ? `**${skill}:** yes. I've used it in ${list(where)}.` : `**${skill}:** yes, it's one of the tools I use.`;
  });
  return { text: parts.join("\n\n"), follow: ["What are your strongest skills?", "What are you building right now?"] };
};

const INTERNS = experience.filter((e) => /intern/i.test(e.title));

/** answers drawn from the site's data, matched like the taught ones */
const derived: (Omit<Entry, "answer"> & { reply: () => Reply })[] = [
  {
    id: "now-building",
    asks: ["what are you building right now", "what are you working on", "what are you working on now", "what is on your whiteboard", "currently building", "what are you doing now", "whats next"],
    reply: () => ({
      text: `Right now: **${list(nowBuilding)}**. DevAssist is an AI platform that tests every code change in a sandbox before it ships, Schematica turns a photo of a circuit into a live simulation, and Digital Dash is a study dashboard for students.`,
      follow: ["Why did you build DevAssist?", "How does Schematica work?", "What else have you built?"],
    }),
  },
  {
    id: "projects",
    asks: ["what have you built", "what else have you built", "projects", "what projects have you made", "what projects have you built", "show me your work", "best project", "favorite project", "portfolio", "what are your projects", "side projects"],
    reply: () => ({
      text: `My three biggest: **Marq Living** (an app and building-operations platform for my building), **DevAssist** (AI agents that plan, code and test changes in a sandbox) and **Schematica** (photo of a circuit to live simulation). I've also built ${list(
        featuredProjects.filter((r) => !caseStudies.some((c) => c.repo === r)).slice(0, 5).map((r) => displayNames[r] ?? r),
      )}.`,
      links: caseStudies.map((c) => ({ label: `Why I built ${c.title}`, href: `/work/${c.slug}` })),
      follow: ["Why did you build Marq Living?", "How does DevAssist work?", "What is Digital Dash?"],
    }),
  },
  {
    id: "internships",
    asks: ["what internships have you done", "work experience", "experience", "where have you worked", "intern", "jobs", "employment history", "professional experience"],
    reply: () => ({
      text: `${INTERNS.length} internships so far:\n\n${INTERNS.map((e) => `**${e.title}**, ${e.org.split(" · ")[0]} (${e.date}): ${e.description.split(". ")[0]}.`).join("\n\n")}`,
      follow: ["Tell me about Visual Elements", "Tell me about GreenVeil", "Tell me about ThinkThamizh"],
    }),
  },
  {
    id: "skills",
    asks: ["what are your skills", "what are your strongest skills", "tech stack", "what languages do you know", "programming languages", "what do you code in", "what technologies do you use", "skillset"],
    reply: () => ({
      text: skillCategories
        .filter((c) => c.title !== "Beyond Code")
        .map((c) => `**${c.title}:** ${c.skills.join(", ")}`)
        .join("\n\n") + "\n\nThe ones I use most: **TypeScript, Python, Go and React**, with Postgres and Docker underneath.",
      follow: ["Do you know Rust?", "What are you building right now?"],
    }),
  },
  {
    id: "school",
    asks: ["what do you study", "what is your program", "school", "education", "what year are you in", "when do you graduate", "graduation", "study", "degree"],
    reply: () => {
      const uni = education[0];
      const [start, end] = uni.date.match(/\d{4}/g) ?? [];
      return {
        text: `I'm at **${uni.org}** doing a dual degree: **Electrical Engineering** (BESc) and an **Ivey HBA**.${start && end ? ` I started in ${start} and ${/expected/i.test(uni.date) ? "expect to graduate" : "graduate"} in ${end}.` : ""}`,
        follow: ["Why engineering and business?", "What internships have you done?"],
      };
    },
  },
];

// ---------- matching the taught and derived answers ----------

type Candidate = { id: string; asks: string[]; reply: () => Reply };
const candidates: Candidate[] = [
  ...knowledge.map((e) => ({ id: e.id, asks: e.asks, reply: (): Reply => ({ text: e.answer, links: e.links, follow: e.follow }) })),
  ...derived,
];
const bags = candidates.map((c) => new Set(c.asks.flatMap(terms)));
const df = new Map<string, number>();
for (const bag of bags) for (const t of bag) df.set(t, (df.get(t) ?? 0) + 1);
const idf = (t: string) => Math.log(1 + candidates.length / (1 + (df.get(t) ?? 0)));
const WH = new Set(["what", "who", "where", "when", "why", "how", "which"]);

/** the best taught or derived answer, with how sure we are (0 to 1+) */
export const bestMatch = (question: string) => {
  const q = normalize(question);
  const qt = [...new Set(terms(question))];
  const total = qt.reduce((n, t) => n + idf(t), 0) || 1;
  let best: { c: Candidate; score: number } | null = null;
  candidates.forEach((c, i) => {
    // asked word for word: "who are you" is all small words, but it's exactly an ask
    if (c.asks.some((a) => normalize(a) === q)) {
      if (!best || 2 > best.score) best = { c, score: 2 };
      return;
    }
    const shared = qt.filter((t) => bags[i].has(t));
    if (!shared.some((t) => !WH.has(t))) return;
    let score = shared.reduce((n, t) => n + idf(t), 0) / total;
    // asking it (nearly) word for word
    if (c.asks.some((a) => normalize(a).trim().split(" ").length > 1 && q.includes(normalize(a)))) score += 0.5;
    if (!best || score > best.score) best = { c, score };
  });
  return best as { c: Candidate; score: number } | null;
};

const THRESHOLD = 0.55;

const dontKnow = (): Reply => ({
  text: `I haven't written an answer to that one yet. Email me at **${EMAIL}** and I'll answer it myself.`,
  links: [{ label: "Email me", href: `mailto:${EMAIL}` }],
  follow: starters.slice(0, 3),
});

export const answer = (question: string): Reply => {
  const q = normalize(question);
  if (!q.trim()) return { text: "Ask me anything about my projects, internships, skills or school.", follow: starters };

  // the taught answers come first when they're a near word-for-word match ("is this your real room")
  const match = bestMatch(question);
  if (match && match.score >= 1) return match.c.reply();

  const project = findProject(q);
  if (project) return aboutProject(project, q);
  const job = findJob(q);
  if (job) return aboutJob(job);
  const spoken = has(q, "speak", "spoken", "tamil", "french", "english");
  const skills = spoken ? [] : findSkills(q);
  if (skills.length) return aboutSkills(skills);

  if (match && match.score >= THRESHOLD) return match.c.reply();
  if (has(q, "do you know", "can you code", "can you program", "have you used", "experience with", "familiar with", "proficient in", "do you use", "worked with"))
    return {
      text: "That one isn't on my list yet. Most of my work is in **TypeScript, Python, Go and React**, with **Rust** for Schematica's solver, and I pick up new tools fast when a project needs them.",
      follow: ["What are your skills?", "What are you building right now?"],
    };
  return dontKnow();
};

export { starters };
