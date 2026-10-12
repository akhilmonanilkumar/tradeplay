// Minimal offline shell: caches static assets only. API calls (Supabase) always go to the network,
// so no journal data is ever stored by the service worker.
const CACHE = "tradeplay-v1";
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
);
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => (r.ok && c.put(e.request, r.clone()), r)))
    );
  }
});
