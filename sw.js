/* Service worker: оболочка всегда с сети без HTTP-кэша; офлайн — из Cache Storage */
const CACHE = "sk-shell-v13";
const ASSETS = [
  "./",
  "./index.html",
  "./app/css/app.css",
  "./app/js/app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-maskable.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function isShell(url) {
  const p = url.pathname;
  return (
    p.endsWith(".js") ||
    p.endsWith(".css") ||
    p.endsWith(".html") ||
    p.endsWith(".webmanifest") ||
    p.endsWith("/") ||
    p.endsWith("/semejnoe-menyu")
  );
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== "GET") return;

  if (isShell(url) || e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request, { cache: "no-store" })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request).then((hit) => hit || caches.match("./index.html") || caches.match("./"))
        )
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request, { cache: "no-store" })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const screen = e.notification.data?.screen || "today";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.postMessage({ type: "open-screen", screen });
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(`./?screen=${encodeURIComponent(screen)}`);
    })
  );
});
