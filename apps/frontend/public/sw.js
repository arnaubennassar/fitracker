const CACHE_NAME = "fitracker-shell-v1";
const APP_SHELL = ["/", "/login", "/history", "/offline.html", "/icon.svg"];

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
