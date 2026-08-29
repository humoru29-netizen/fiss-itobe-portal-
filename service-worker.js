// FISS Itobe Portal — service worker
//
// This ONLY caches the app shell (the portal page itself, manifest, icons)
// so the portal is installable and can still open when the connection is
// briefly unavailable. It deliberately does NOT cache anything from
// Firebase/Firestore — results, fees, PINs, and account data must always
// be read live from the network, never from a stale cache.

const CACHE_NAME = "fiss-portal-v1";
const PRECACHE_URLS = [
  "./",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {}) // don't block install if a precache URL 404s
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle same-origin GET requests. Firebase Auth/Firestore calls
  // and any other cross-origin requests are left completely alone.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // Network-first for page navigations, so everyone gets the latest
  // version of the portal whenever they're online. Falls back to the
  // last cached copy only if the network request fails.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match("./")))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest).
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
