import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { homeData, jsonLd, pages, renderPage, sitemap } from "./src/seo/pages";

/** link previews and search: structured data on the home page, and a copy of it per page with that page's own tags */
const linkPreviews = (): Plugin => {
  let outDir = "dist";
  return {
    name: "link-previews",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml: (html) => html.replace("</head>", `  ${jsonLd(homeData)}\n  </head>`),
    closeBundle() {
      const index = path.join(outDir, "index.html");
      if (!fs.existsSync(index)) return;
      const html = fs.readFileSync(index, "utf8");
      for (const page of pages) {
        const dir = path.join(outDir, page.path);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "index.html"), renderPage(html, page));
      }
      fs.writeFileSync(path.join(outDir, "sitemap.xml"), sitemap());
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), linkPreviews(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
