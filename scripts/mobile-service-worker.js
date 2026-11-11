const CACHE = __CACHE__,
  CORE = __CORE__,
  FILES = __FILES__;
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
