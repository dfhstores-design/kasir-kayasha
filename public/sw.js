/*
 * Service worker Kasir Kayasha — app shell offline.
 *
 * Strategi:
 *  - navigasi (HTML): network-first, fallback ke cache index.html.
 *    Tujuannya: saat online pemilik selalu dapat versi terbaru; saat offline app tetap terbuka.
 *  - aset statis (JS/CSS/ikon): stale-while-revalidate — cepat saat offline, diperbarui di background.
 *  - API (/api/*): TIDAK di-cache. Sinkronisasi ditangani antrean lokal (outbox), bukan SW,
 *    agar kegagalan server tidak pernah mengubah data lokal.
 *
 * Naikkan CACHE_VERSION setiap deploy agar cache lama dibersihkan.
 */
const CACHE_VERSION = "kayasha-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // API tidak pernah di-cache.
  if (url.pathname.startsWith("/api/")) return;

  // Hanya tangani origin sendiri.
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
