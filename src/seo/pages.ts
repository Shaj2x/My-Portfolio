import { caseStudies } from "../data/caseStudies";

/*
 * Link previews and search, page by page. The site is one app, so every address gets the same
 * index.html, and link previewers (iMessage, LinkedIn, Slack, Discord) and many search crawlers don't
 * run its JavaScript. So the build writes a copy of index.html for each page below with that page's
 * own title, description, preview image and structured data already in the HTML.
 *
 * Imported by vite.config.ts at build time, so it must not import anything that needs a browser.
 */

export const SITE = "https://shajithsasikumar.com";
const NAME = "Shajith Sasikumar";

export interface SeoPage {
  /** the address, e.g. "/quick" */
  path: string;
  title: string;
  description: string;
  /** the preview image (1200×630), as a path on the site */
  image: string;
  imageAlt: string;
  /** JSON-LD for search engines */
  data?: object;
  /** left out of the sitemap (still previews nicely when shared) */
  private?: boolean;
}

const person = {
  "@type": "Person",
  "@id": `${SITE}/#me`,
  name: NAME,
  url: SITE,
  jobTitle: "Electrical Engineering student",
  description: "Electrical Engineering + Ivey HBA student at Western University. AI builder, entrepreneur and full-stack developer.",
  affiliation: { "@type": "CollegeOrUniversity", name: "Western University", url: "https://www.uwo.ca" },
  alumniOf: { "@type": "HighSchool", name: "Chinguacousy Secondary School" },
  address: { "@type": "PostalAddress", addressLocality: "London", addressRegion: "ON", addressCountry: "CA" },
  knowsAbout: ["Electrical engineering", "Software engineering", "AI agents", "React", "TypeScript", "Python", "Go", "Rust", "Embedded systems"],
  sameAs: ["https://github.com/Shaj2x", "https://www.linkedin.com/in/shajith-sasikumar-5080a5344/"],
};

/** the home page's structured data; index.html carries the rest of its tags itself */
export const homeData = {
  "@context": "https://schema.org",
  "@graph": [person, { "@type": "WebSite", "@id": `${SITE}/#site`, url: SITE, name: NAME, author: { "@id": `${SITE}/#me` } }],
};

export const pages: SeoPage[] = [
  {
    path: "/quick",
    title: `${NAME} · Portfolio`,
    description: "Electrical Engineering + Ivey HBA at Western University. Projects, internships, skills and contact, all on one page.",
    image: "/og.jpg",
    imageAlt: "Shajith's dorm room in 3D at night: a red bed under the window, a lit floor lamp, and a desk with a curved monitor.",
    data: { "@context": "https://schema.org", "@type": "ProfilePage", url: `${SITE}/quick`, mainEntity: person },
  },
  ...caseStudies.map(
    (c): SeoPage => ({
      path: `/work/${c.slug}`,
      title: `Why I built ${c.title} · ${NAME}`,
      description: c.tagline,
      image: `/og/why-${c.slug}.jpg`,
      imageAlt: `Why I built ${c.title}: ${c.tagline}`,
      data: {
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        name: c.title,
        description: c.tagline,
        url: `${SITE}/work/${c.slug}`,
        codeRepository: `https://github.com/Shaj2x/${c.repo}`,
        author: { "@type": "Person", "@id": `${SITE}/#me`, name: NAME, url: SITE },
      },
    }),
  ),
  {
    path: "/ma",
    title: "Ma's Garden",
    description: "A fruit-matching game, made for Ma. Match three, clear the garden, and pick up where you left off.",
    image: "/og/ma.jpg",
    imageAlt: "Ma's Garden: a board of strawberries, apples, oranges and lemons.",
    private: true,
  },
];

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** sets the content of an existing tag, matched by its name or property; fails loudly if it's missing */
const setTag = (html: string, pattern: RegExp, replacement: string) => {
  if (!pattern.test(html)) throw new Error(`link previews: index.html has no tag matching ${pattern}`);
  return html.replace(pattern, replacement);
};
const setMeta = (html: string, attr: "name" | "property", key: string, value: string) =>
  setTag(html, new RegExp(`<meta ${attr}="${key.replace(/[.:]/g, "\\$&")}" content="[^"]*" />`), `<meta ${attr}="${key}" content="${escape(value)}" />`);

/** structured data as a script tag; `<` is escaped so text can never close the tag */
export const jsonLd = (data: object) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

/** index.html, retitled and re-described for one page */
export const renderPage = (html: string, page: SeoPage) => {
  const url = `${SITE}${page.path}`;
  const image = `${SITE}${page.image}`;
  let out = setTag(html, /<title>[^<]*<\/title>/, `<title>${escape(page.title)}</title>`);
  out = setMeta(out, "name", "description", page.description);
  out = setTag(out, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`);
  for (const [key, value] of [
    ["og:url", url],
    ["og:title", page.title],
    ["og:description", page.description],
    ["og:image", image],
    ["og:image:alt", page.imageAlt],
  ])
    out = setMeta(out, "property", key, value);
  for (const [key, value] of [
    ["twitter:title", page.title],
    ["twitter:description", page.description],
    ["twitter:image", image],
    ["twitter:image:alt", page.imageAlt],
  ])
    out = setMeta(out, "name", key, value);
  // swap the home page's structured data for this page's
  out = out.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/, "");
  if (page.data) out = out.replace("</head>", `  ${jsonLd(page.data)}\n  </head>`);
  return out;
};

/** every public page, for search engines */
export const sitemap = () =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", ...pages.filter((p) => !p.private).map((p) => p.path)]
    .map((p) => `  <url><loc>${SITE}${p === "/" ? "/" : p}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
