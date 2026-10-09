/**
 * The portfolio, hidden around the room: each section is behind an object that suits it, found by
 * clicking things. The hover label names only the object, so the section is a small surprise.
 */
export type PortfolioId = "about" | "projects" | "resume" | "leadership" | "skills" | "services" | "contact";

export const PORTFOLIO_SPOTS: Record<PortfolioId, { object: string; title: string }> = {
  about: { object: "The fragrances", title: "About Me" },
  projects: { object: "The laptop screen", title: "Projects" },
  resume: { object: "The resume in the drawer", title: "Resume" },
  leadership: { object: "The Western lanyard", title: "Leadership" },
  skills: { object: "The mouse", title: "Skills" },
  services: { object: "The desk chair", title: "What I Build" },
  contact: { object: "The door", title: "Contact" },
};

export const PORTFOLIO_IDS = Object.keys(PORTFOLIO_SPOTS) as PortfolioId[];
