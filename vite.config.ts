import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Digital Dash (public/digital-dash.html) is a plain HTML file that Vite doesn't process, so hand it
// the public Supabase settings as a tiny script. Only the publishable (anon) key is exposed, the same
// one the React app already ships; row level security keeps each user's data private.
function digitalDashConfig(): Plugin {
  let body = "";
  return {
    name: "digital-dash-config",
    configResolved(config) {
      const env = loadEnv(config.mode, process.cwd(), "VITE_");
      body = `window.DASH_CONFIG=${JSON.stringify({
        supabaseUrl: env.VITE_SUPABASE_URL || "",
        supabaseKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
      })};`;
    },
    configureServer(server) {
      server.middlewares.use("/digital-dash-config.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.end(body);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "digital-dash-config.js", source: body });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), digitalDashConfig(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
