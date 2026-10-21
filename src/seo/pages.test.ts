import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { caseStudies } from "@/data/caseStudies";
import { pages, renderPage, sitemap, SITE } from "./pages";

const root = path.resolve(__dirname, "../..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")) as { rewrites: { source: string; destination: string }[] };

describe("link previews", () => {
  it("gives every page its own title, description, address and image", () => {
    for (const page of pages) {
      const html = renderPage(index, page);
      expect(html).toContain(`<title>${page.title}</title>`);
      expect(html).toContain(`<link rel="canonical" href="${SITE}${page.path}" />`);
      expect(html).toContain(`<meta property="og:url" content="${SITE}${page.path}" />`);
      expect(html).toContain(`<meta property="og:image" content="${SITE}${page.image}" />`);
      expect(html).toContain(`<meta name="twitter:image" content="${SITE}${page.image}" />`);
      expect(html).not.toContain('content="Shajith\'s room · Shajith Sasikumar\'s portfolio"');
    }
  });

  it("has a preview image on disk for every page", () => {
    for (const page of pages) expect(fs.existsSync(path.join(root, "public", page.image)), page.image).toBe(true);
  });

  it("has a case study page for every case study", () => {
    for (const c of caseStudies) expect(pages.some((p) => p.path === `/work/${c.slug}`)).toBe(true);
  });

  it("serves each page's own HTML on Vercel, before the catch-all", () => {
    const catchAll = vercel.rewrites.findIndex((r) => r.destination === "/index.html");
    const work = vercel.rewrites.findIndex((r) => r.source.startsWith("/work/"));
    expect(work).toBeGreaterThanOrEqual(0);
    expect(work).toBeLessThan(catchAll);
    for (const c of caseStudies) expect(vercel.rewrites[work].source, `vercel.json must list ${c.slug}`).toMatch(new RegExp(`[(|]${c.slug}[|)]`));
    for (const page of pages.filter((p) => !p.path.startsWith("/work/")))
      expect(vercel.rewrites.slice(0, catchAll).some((r) => r.source === page.path && r.destination === `${page.path}/index.html`), page.path).toBe(true);
  });

  it("escapes text so it can't break out of a tag", () => {
    const html = renderPage(index, { ...pages[0], title: 'A "quoted" <b>title</b>', data: { x: "</script><script>alert(1)" } });
    expect(html).toContain("<title>A &quot;quoted&quot; &lt;b&gt;title&lt;/b&gt;</title>");
    expect(html).not.toContain("</script><script>alert(1)");
  });

  it("lists public pages in the sitemap", () => {
    const xml = sitemap();
    expect(xml).toContain(`<loc>${SITE}/</loc>`);
    for (const c of caseStudies) expect(xml).toContain(`<loc>${SITE}/work/${c.slug}</loc>`);
    expect(xml).not.toContain("/ma<");
  });
});
