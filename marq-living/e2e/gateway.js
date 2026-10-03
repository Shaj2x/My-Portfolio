// Minimal stand-in for Supabase's API gateway: /auth/v1 -> GoTrue, /rest/v1 -> PostgREST,
// /templates/* -> email templates from the repo.
const http = require("http"), fs = require("fs"), path = require("path");
const routes = [["/auth/v1", Number(process.env.GOTRUE_PORT)], ["/rest/v1", Number(process.env.PGRST_PORT)]];
http.createServer((req, res) => {
  if (req.url.startsWith("/templates/")) {
    const f = path.join(process.env.TEMPLATES, path.basename(req.url));
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(fs.readFileSync(f));
  }
  const r = routes.find(([p]) => req.url.startsWith(p));
  if (!r) { res.writeHead(404); return res.end(); }
  const up = http.request({ host: "127.0.0.1", port: r[1], path: req.url.slice(r[0].length) || "/", method: req.method, headers: req.headers }, (u) => {
    res.writeHead(u.statusCode, u.headers); u.pipe(res);
  });
  up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
}).listen(Number(process.env.GATEWAY_PORT), () => console.log("gateway on", process.env.GATEWAY_PORT));
