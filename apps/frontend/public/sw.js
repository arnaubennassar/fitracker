const CACHE_NAME = "fitracker-shell-v3";
const APP_SHELL = ["/", "/login", "/history", "/offline.html", "/icon.svg"];

function shouldBypassCache(request) {
  if (request.cache === "no-store") {
    return true;
  }

  const url = new URL(request.url);

  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/api/") ||
      url.searchParams.has("_rsc") ||
      request.headers.has("next-router-state-tree") ||
      request.headers.has("rsc"))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve(false);
        }),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (shouldBypassCache(event.request)) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (
          (await cache.match(event.request)) ||
          (await cache.match("/offline.html")) ||
          Response.error()
        );
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (
            response.ok &&
            event.request.url.startsWith(self.location.origin)
          ) {
            const clone = response.clone();
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone));
          }

          return response;
        }),
    ),
  );
});
