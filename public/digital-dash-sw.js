/* Digital Dash service worker: makes the dashboard installable and usable offline.
   The app itself is network-first (you always get the latest version when online, the cached
   copy when not); Google Fonts are cache-first since they never change. Scope: /digital-dash* only,
   so the rest of the portfolio is untouched.
   It also shows push reminders (sent by the dash-push Supabase function) and opens the app when one is tapped. */
const CACHE = "digital-dash-v2";
const FONTS = "digital-dash-fonts";
const CORE = [
  "/digital-dash.html",
  "/digital-dash.webmanifest",
  "/digital-dash-icon-192.png",
  "/digital-dash-icon-512.png",
  "/digital-dash-maskable-512.png",
  "/digital-dash-apple-180.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("digital-dash-") && k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin && url.pathname.startsWith("/digital-dash")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((m) => m || caches.match("/digital-dash.html")))
    );
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.match(req).then((m) => m || fetch(req).then((res) => {
        const copy = res.clone(); caches.open(FONTS).then((c) => c.put(req, copy)); return res;
      }))
    );
  }
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: "Digital Dash", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Digital Dash", {
    body: d.body || "",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: "/digital-dash-icon-192.png",
    badge: "/digital-dash-icon-192.png",
    timestamp: d.at || Date.now(),
    data: { url: d.url || "/digital-dash.html" }
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/digital-dash.html", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (new URL(c.url).pathname.startsWith("/digital-dash")) {
        return c.focus().then((w) => (w && "navigate" in w ? w.navigate(url) : w)).catch(() => {});
      }
    }
    return self.clients.openWindow(url);
  }));
});
