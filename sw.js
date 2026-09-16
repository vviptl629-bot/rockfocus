const CACHE = "rockfocus-v10";
const NAV_KEY = "index.html"; // 导航请求统一用缓存里的 index.html 兜底
const SHELL = ["index.html", "manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // 逐项缓存并容忍单项失败：移动网络抖动时也不至于整个 SW 装不上
      // （装不上 = 永远没缓存 = 每次冷启动都要等一次到 github.io 的网络往返）
      .then((c) =>
        Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 页面导航：缓存优先（秒开）+ 后台拉最新版写回缓存（stale-while-revalidate）
// 关键修复：以前导航请求的 URL 是 /rockfocus/，而缓存里只有 index.html，匹配不上 →
// 每次点图标都要走一次完整网络往返（DNS+TLS+请求），弱网下就是那 10 秒。
async function serveNavigation(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(NAV_KEY, { ignoreSearch: true });
  const fresh = fetch(req)
    .then((r) => {
      if (r && r.ok) c.put(NAV_KEY, r.clone());
      return r;
    })
    .catch(() => null);
  if (hit) {
    fresh; // 后台静默更新，不阻塞本次渲染
    return hit;
  }
  const r = await fresh;
  return (
    r ||
    (await c.match(NAV_KEY, { ignoreSearch: true })) ||
    new Response("离线，且没有可用缓存。请联网打开一次以完成离线安装。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // 跨域（api.github.com 的 Gist 同步）直连，绝不进缓存，避免拉到过期数据
  if (new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(serveNavigation(req));
    return;
  }

  e.respondWith(
    (async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r && r.ok) c.put(req, r.clone());
        return r;
      } catch (err) {
        return hit || Response.error();
      }
    })()
  );
});

// 点击提醒通知 → 回到应用（聚焦已有窗口，否则新开）
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(self.registration.scope);
    })
  );
});
