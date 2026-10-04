/* InterviewPrep Hub service worker: offline support.

   - App files are cached on install, so the app opens without a network.
   - Pages (navigation): network first, cached copy when offline.
   - Everything else: served from cache immediately, then refreshed in the
     background (stale-while-revalidate), so edited questions appear on the next visit.

   When you add, rename or remove a file below, bump CACHE_VERSION. */

const CACHE_VERSION = "v2";
const CACHE_NAME = `interview-prep-${CACHE_VERSION}`;
const RUNTIME_CACHE = `interview-prep-runtime-${CACHE_VERSION}`;

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",

  "./css/style.css",
  "./css/dark-theme.css",
  "./css/light-theme.css",

  "./js/theme.js",
  "./js/progress.js",
  "./js/notes.js",
  "./js/questions.js",
  "./js/search.js",
  "./js/filters.js",
  "./js/interview-mode.js",
  "./js/pwa.js",
  "./js/app.js",

  "./data/python.json",
  "./data/fastapi.json",
  "./data/django.json",
  "./data/sql.json",
  "./data/postgresql.json",
  "./data/redis.json",
  "./data/testing.json",
  "./data/genai.json",
  "./data/php.json",
  "./data/javascript.json",
  "./data/cloud-devops.json",
  "./data/architecture.json",

  "./assets/icons/favicon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
});

// The page asks the new version to take over when the user clicks "Refresh".
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("interview-prep-") && key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith("http")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  const cacheName = url.origin === self.location.origin ? CACHE_NAME : RUNTIME_CACHE;
  const { response, refresh } = staleWhileRevalidate(request, cacheName);
  event.respondWith(response);
  event.waitUntil(refresh);
});

// Pages: try the network (fresh index.html), fall back to the cache when offline.
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request, { ignoreSearch: true }))
      || (await cache.match("./index.html"))
      || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

// Files: answer from the cache right away and update the cache in the background.
function staleWhileRevalidate(request, cacheName) {
  const cachePromise = caches.open(cacheName);

  const refresh = cachePromise.then(cache =>
    fetch(request)
      .then(response => {
        // "opaque" = cross-origin files such as Google Fonts and highlight.js from the CDN
        if (response.ok || response.type === "opaque") cache.put(request, response.clone());
        return response;
      })
      .catch(() => undefined)
  );

  const response = cachePromise
    .then(cache => cache.match(request))
    .then(cached => cached || refresh)
    .then(result => result || new Response("", { status: 504, statusText: "Offline" }));

  return { response, refresh };
}
