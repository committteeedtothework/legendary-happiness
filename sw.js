const CACHE = "dcsmcraft-mobile-792a6f8453e6f481",
  CORE = ["./NOTICES.txt","./app.71d7b8dfaf31.js","./icon-180.png","./icon-192.png","./icon-512.png","./index.html","./manifest.webmanifest","./style.caf61ec9086e.css","./offline-manifest.json"],
  FILES = ["./NOTICES.txt","./app.71d7b8dfaf31.js","./assets/aria-math.48e53255c03f.mp3","./assets/biome-fest.72e81688a8a0.mp3","./assets/blind-spots.a593f18c8bca.mp3","./assets/break-through-it-all.7becd1543b6b.mp3","./assets/clark.ef5d5828a3c7.mp3","./assets/danny.63afeff1f3d1.mp3","./assets/devin-sword-claim.400e34aca3bc.mp3","./assets/dreiton.52524c552b6b.mp3","./assets/dry-hands.bd8812dd35ed.mp3","./assets/giganto.35053758d63b.glb","./assets/haggstrom.63d6db161912.mp3","./assets/haunt-muskie.231e151d0553.mp3","./assets/key.5928412e8ba9.mp3","./assets/living-mice.0188f704883d.mp3","./assets/matthew-pistols-claim.db8a36c54d14.mp3","./assets/menu-console-source.f025b026bf27.mp3","./assets/mice-on-venus.dd414109d7d9.mp3","./assets/minecraft.4d221e17857c.mp3","./assets/oxygene.db8f1ac9a592.mp3","./assets/sonic-power-boost.86cb6a94e28d.mp3","./assets/sonic.a3cf34828a94.glb","./assets/subwoofer-lullaby.52add411175c.mp3","./assets/sweden.50852312f18e.mp3","./assets/taswell.93662af573b4.mp3","./assets/titan-giganto.eb2b0a275d6a.mp3","./assets/titan-wyvern.b237dfc485bf.mp3","./assets/undefeatable.aa97147596f1.mp3","./assets/wet-hands.1af7d0ab71b3.mp3","./assets/wyvern.f12f269f3c76.glb","./icon-180.png","./icon-192.png","./icon-512.png","./index.html","./manifest.webmanifest","./style.caf61ec9086e.css","./offline-manifest.json"];
const absolute = (p) => new URL(p, self.registration.scope).href;
const allowed = new Set(FILES.map(absolute));
self.addEventListener("install", (e) =>
  e.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        await cache.addAll(CORE.map(absolute));
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
    })(),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      const current = await caches.open(CACHE);
      for (const name of await caches.keys()) {
        if (!name.startsWith("dcsmcraft-mobile-") || name === CACHE) continue;
        const old = await caches.open(name);
        let complete = true;
        try {
          for (const request of await old.keys())
            if (allowed.has(request.url) && !(await current.match(request))) {
              const response = await old.match(request);
              if (response) await current.put(request, response);
            }
        } catch {
          complete = false;
        }
        if (complete) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("message", (e) => {
  if (e.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
});
function ranged(response, range) {
  return response.arrayBuffer().then((body) => {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m || (!m[1] && !m[2]))
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${body.byteLength}` },
      });
    let start = m[1]
        ? Number(m[1])
        : Math.max(0, body.byteLength - Number(m[2])),
      end = m[1]
        ? m[2]
          ? Math.min(Number(m[2]), body.byteLength - 1)
          : body.byteLength - 1
        : body.byteLength - 1;
    if (start >= body.byteLength || start > end)
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${body.byteLength}` },
      });
    const headers = new Headers(response.headers);
    headers.set("Content-Range", `bytes ${start}-${end}/${body.byteLength}`);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Length", String(end - start + 1));
    return new Response(body.slice(start, end + 1), { status: 206, headers });
  });
}
self.addEventListener("fetch", (e) => {
  const r = e.request,
    u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin) return;
  const url = r.mode === "navigate" ? absolute("./index.html") : u.href;
  if (!allowed.has(url)) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE),
        stored = r.cache === "reload" ? null : await cache.match(url);
      if (stored)
        return r.headers.has("range")
          ? ranged(stored, r.headers.get("range"))
          : stored;
      const response = await fetch(r);
      if (
        response.status === 200 &&
        !r.headers.has("range") &&
        r.cache !== "reload"
      )
        await cache.put(url, response.clone());
      return response;
    })(),
  );
});
