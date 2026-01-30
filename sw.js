/* Dart-turnering PWA service worker (v60)
   - Network-first för HTML (så du får uppdateringar)
   - Cache-first för övrigt (snabbt + offline)
*/
const CACHE_NAME = "dart-turnering-v76";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./online.js"
];

// Install: cacha kärnfiler
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: städa gamla cache
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

function isHTML(request) {
  return request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Låt Firebase/CDN och API-anrop gå direkt till nätet (undvik cache-strul)
  try{
    const url = new URL(req.url);
    const host = url.hostname || "";
    const isFirebase = host.includes("firebaseapp.com") || host.includes("googleapis.com") || host.includes("gstatic.com") || host.includes("firebaseio.com");
    const isCrossOrigin = url.origin !== self.location.origin;
    if(isCrossOrigin || isFirebase){
      event.respondWith(fetch(req));
      return;
    }
  }catch(e){}


  // Network-first för HTML (så nya index.html slår igenom)
  if (isHTML(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(()=>{});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("./index.html"))
        )
    );
    return;
  }

  // Cache-first för allt annat
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Bara cacha "OK"-svar
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(()=>{});
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
