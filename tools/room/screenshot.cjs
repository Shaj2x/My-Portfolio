/*
 * Headless screenshots of the 3D room, for checking changes without a GPU.
 *
 *   node tools/room/screenshot.cjs <url> <out-prefix> [steps.json]
 *
 * Uses the globally installed Playwright with Chromium's software GL (SwiftShader). That renderer
 * is SLOW (a frame can take seconds), so waits are long and animations crawl; judge composition,
 * colour and layout, not smoothness. `steps.json` is an optional list of actions, e.g.
 *   [{"wait":30000},{"shot":"doorway"},{"click":"text=Step inside"},{"wait":40000},{"shot":"inside"},
 *    {"key":"t"},{"wait":60000},{"shot":"telescope"},{"drag":[480,300,420,300]},{"wheel":-200},
 *    {"localStorage":{"portfolio-room:v1":{"weather":"snow","timeMode":"day"}}},{"viewport":[390,780]}]
 * Run the dev server bound to IPv4 first:
 *   VITE_SUPABASE_URL=http://x.invalid VITE_SUPABASE_PUBLISHABLE_KEY=x npx vite --host 127.0.0.1 --port 8080
 */
const path = require("path");
const { execSync } = require("child_process");
const pw = require(path.join(execSync("npm root -g").toString().trim(), "playwright"));

(async () => {
  const [url, prefix, stepsFile] = process.argv.slice(2);
  if (!url || !prefix) throw new Error("usage: screenshot.cjs <url> <out-prefix> [steps.json]");
  const steps = stepsFile ? require(path.resolve(stepsFile)) : [{ wait: 30000 }, { shot: "doorway" }];
  const b = await pw.chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const vp = steps.find((s) => s.viewport)?.viewport ?? [960, 540];
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] } });
  const seed = steps.find((s) => s.localStorage)?.localStorage;
  if (seed) {
    await ctx.addInitScript((entries) => {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, JSON.stringify(v));
    }, seed);
  }
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("pageerror:", e.message));
  p.on("console", (m) => m.type() === "error" && !m.text().includes("ERR_CERT") && console.log("console error:", m.text().slice(0, 200)));
  // "domcontentloaded": external fonts may never finish loading behind the sandbox proxy
  await p.goto(url, { waitUntil: "domcontentloaded" });
  for (const s of steps) {
    if (s.wait) await p.waitForTimeout(s.wait);
    if (s.click) await p.click(s.click);
    if (s.key) await p.keyboard.press(s.key);
    if (s.wheel) {
      await p.mouse.move(vp[0] / 2, vp[1] / 2);
      await p.mouse.wheel(0, s.wheel);
    }
    if (s.drag) {
      const [x0, y0, x1, y1] = s.drag;
      await p.mouse.move(x0, y0);
      await p.mouse.down();
      await p.mouse.move(x1, y1, { steps: 10 });
      await p.mouse.up();
    }
    if (s.eval) console.log("eval:", JSON.stringify(await p.evaluate(s.eval)));
    if (s.shot) {
      const out = `${prefix}-${s.shot}.png`;
      await p.screenshot({ path: out, timeout: 180000 });
      console.log("saved", out);
    }
  }
  await b.close();
})();
