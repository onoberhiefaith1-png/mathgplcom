// Math Lab offline shell: cache-first for same-origin app assets so Math Lab
// opens without data after the first load. All maths runs on-device.
const CACHE = "mathlab-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/math-lab"])).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: url.pathname.startsWith("/assets/") }).then((hit) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok && (url.pathname.startsWith("/assets/") || url.pathname === "/math-lab" || event.request.mode === "navigate")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => hit || (event.request.mode === "navigate" ? caches.match("/math-lab") : Response.error()));
      return hit || network;
    }),
  );
});
