// Base Sonic's freehand Cyloop: only closed, grounded paths produce rings.
export const GRASS_CYLOOP = Object.freeze({
  minLength: 14,
  minArea: 12,
  maxArea: 220,
  maxLength: 120,
  maxPoints: 128,
  cooldown: 6,
  rings: 8,
  value: 5,
  lifetime: 24,
});
export const freshGrassCyloop = () => ({
  points: [],
  length: 0,
  cooldown: 0,
  drops: [],
  serial: 0,
  finish: null,
});
const validPoint = (p) =>
  p && [p.x, p.z].every(Number.isFinite) && Math.hypot(p.x, p.z) < 178;
export function grassLoopArea(points) {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++)
    area += points[j].x * points[i].z - points[i].x * points[j].z;
  return Math.abs(area) * 0.5;
}
export function restoreGrassCyloop(raw) {
  const q = freshGrassCyloop();
  if (!raw) return q;
  q.serial = Number.isInteger(raw.serial)
    ? Math.max(0, Math.min(1e7, raw.serial))
    : 0;
  q.cooldown = Number.isFinite(raw.cooldown)
    ? Math.max(0, Math.min(GRASS_CYLOOP.cooldown, raw.cooldown))
    : 0;
  const seen = new Set();
  q.drops = (Array.isArray(raw.drops) ? raw.drops : [])
    .filter(
      (d) =>
        validPoint(d) &&
        Number.isFinite(d.age) &&
        d.age >= 0 &&
        d.age < GRASS_CYLOOP.lifetime &&
        typeof d.id === "string" &&
        /^grass:\d+:\d+$/.test(d.id) &&
        !seen.has(d.id) &&
        seen.add(d.id),
    )
    .slice(0, 64)
    .map((d) => ({ id: d.id, x: d.x, z: d.z, age: d.age }));
  // Partial drawings are cancelled at load, never converted into a reward.
  return q;
}
export function advanceGrassCyloop(s, input, dt, emit) {
  const q = (s.grassCyloop ||= freshGrassCyloop()),
    c = GRASS_CYLOOP,
    p = s.avatar;
  q.cooldown = Math.max(0, q.cooldown - dt);
  if (q.finish && s.time - q.finish.at > 1.1) q.finish = null;
  for (const d of q.drops) {
    d.age += dt;
    if (
      s.rings < s.config.rings &&
      d.age > 0.45 &&
      p.y < 2 &&
      Math.hypot(p.x - d.x, p.z - d.z) < 2
    ) {
      const count = Math.min(c.value, s.config.rings - s.rings);
      s.rings += count;
      d.age = c.lifetime;
      emit(s, "ring", { count, x: d.x, y: 1, z: d.z });
    }
  }
  if (q.drops.length) q.drops = q.drops.filter((d) => d.age < c.lifetime);
  const drawing =
    input.cyloop &&
    p.onGround &&
    p.y < 0.3 &&
    !s.climb?.attached &&
    !s.emerald &&
    !q.cooldown &&
    q.drops.length <= 56;
  if (!drawing) {
    q.points.length = 0;
    q.length = 0;
    return;
  }
  if (!q.points.length) {
    q.points.push({ x: p.x, z: p.z });
    return;
  }
  const last = q.points.at(-1),
    distance = Math.hypot(p.x - last.x, p.z - last.z);
  if (distance < 0.3) return;
  // Reject teleports/collision corrections and bounded oversized drawings.
  if (
    distance > 4 ||
    q.length + distance > c.maxLength ||
    q.points.length >= c.maxPoints
  ) {
    q.points.length = 0;
    q.length = 0;
    return;
  }
  q.length += distance;
  q.points.push({ x: p.x, z: p.z });
  if (
    q.length < c.minLength ||
    Math.hypot(p.x - q.points[0].x, p.z - q.points[0].z) > 1.7
  )
    return;
  const area = grassLoopArea(q.points);
  if (area < c.minArea || area > c.maxArea) return;
  const center = q.points.reduce(
    (v, n) => ({
      x: v.x + n.x / q.points.length,
      z: v.z + n.z / q.points.length,
    }),
    { x: 0, z: 0 },
  );
  // The Titan's base is not grass; don't put rewards in its collision shell.
  if (Math.hypot(center.x, center.z) < 25) return;
  q.serial++;
  q.cooldown = c.cooldown;
  q.finish = { points: q.points.map((p) => ({ ...p })), at: s.time };
  for (let i = 0; i < c.rings; i++) {
    const a = (i / c.rings) * Math.PI * 2;
    q.drops.push({
      id: `grass:${q.serial}:${i}`,
      x: center.x + Math.sin(a) * 3.4,
      z: center.z + Math.cos(a) * 3.4,
      age: 0,
    });
  }
  emit(s, "grass-cyloop", { x: center.x, y: 1, z: center.z });
  q.points.length = 0;
  q.length = 0;
}
