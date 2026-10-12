// Minimal offline shell: caches static assets only. API calls (Supabase) always go to the network,
// so no journal data is ever stored by the service worker.
const CACHE = "aplus-tradeplay-v2";
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
);
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|webmanifest|woff2)$/.test(url.pathname)) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => (r.ok && c.put(e.request, r.clone()), r)))
    );
  }
});
// Reminders raised by the app open the right screen when tapped.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      const c = cs.find((x) => new URL(x.url).origin === self.location.origin);
      return c ? c.focus().then((w) => w && w.navigate(url)) : self.clients.openWindow(url);
    })
  );
});
