const CACHE = "rockfocus-v5";
const SHELL = ["index.html", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) =>
      Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // 跨域（api.github.com 的 Gist 同步）直连，绝不进缓存，避免拉到过期数据
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((c) =>
      c || fetch(req).then((r) => {
        const cp = r.clone();
        caches.open(CACHE).then((c) => c.put(req, cp));
        return r;
      }).catch(() => caches.match("index.html"))
    )
  );
});
