/* Dart-turnering PWA service worker (v79)
   - Network-first för HTML (uppdateringar)
   - Cache-first för övrigt
   - Stabil index-fallback (cacheas under fast nyckel)
*/

const BUILD = "v79";
const CACHE_NAME = `dart-turnering-${BUILD}`;

// Under aktiv utveckling: precacha bara stabila assets.
// (Undvik index.html och online.js för att slippa "fastnade" versioner.)
const CORE_ASSETS = [
  "./",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

function isHTML(req){
  return req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req));
    return;
  }

  if (isHTML(req)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put("./index.html", res.clone());
        return res;
      } catch (e) {
        const cached = await caches.match("./index.html");
        return cached || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    const res = await fetch(req);
    if (res && res.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
    }
    return res;
  })());
});
