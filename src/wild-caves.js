import { B, MIN_Y } from "./data.js";
import { hash, noise2, noise3 } from "./random.js";
import { deepCaveNode } from "./cave-update.js";
const plans = new Map();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Pure world-space plans are shared by adjacent chunks and never consume RNG.
// Existing cave region anchors/mineshafts remain meaningful, but their shapes
// and the routes between them are no longer the same repeated two-level grid.
export function wildCavePlan(rx, rz, layer, seed) {
  const key = `${seed}:${rx},${rz}:${layer}`;
  if (plans.has(key)) return plans.get(key);
  const a = deepCaveNode(rx, rz, layer, seed);
  const rnd = (n) => hash(rx, n + layer * 173, rz, seed + 14001);
  const segments = [];
  const room = (center, r, index) => {
    segments.push({
      a: center,
      b: center,
      r,
      room: true,
      type: a.type,
      angle: rnd(21 + index) * Math.PI * 2,
      aspect: 0.65 + rnd(31 + index) * 1.1,
      tall: 0.38 + rnd(41 + index) * 0.82,
      phase: rnd(51 + index) * Math.PI * 2,
      pillars: rnd(61 + index) > 0.55,
    });
  };
  room(a, 10 + rnd(1) * 16, 0);
  if (rnd(2) > 0.3)
    room(
      {
        x: a.x + (rnd(3) - 0.5) * 28,
        z: a.z + (rnd(4) - 0.5) * 28,
        y: clamp(a.y + (rnd(5) - 0.5) * 13, -49, 40),
      },
      8 + rnd(6) * 14,
      1,
    );
  const route = (b, tag, entrance = false) => {
    const count = 3 + Math.floor(rnd(tag) * 3);
    const dx = b.x - a.x,
      dz = b.z - a.z,
      len = Math.max(1, Math.hypot(dx, dz));
    let prev = a;
    for (let n = 1; n <= count; n++) {
      const t = n / count,
        bend = n === count ? 0 : (rnd(tag + n + 1) - 0.5) * 40;
      const point =
        n === count
          ? b
          : {
              x: a.x + dx * t - (dz / len) * bend,
              z: a.z + dz * t + (dx / len) * bend,
              y: clamp(
                a.y + (b.y - a.y) * t + (rnd(tag + n + 9) - 0.5) * 15,
                -52,
                52,
              ),
            };
      const r = 2.3 + rnd(tag + n + 19) * 3.2;
      segments.push({
        a: prev,
        b: point,
        r,
        tall: 0.65 + rnd(tag + n + 29) * 0.7,
        entrance,
      });
      prev = point;
    }
  };
  route(deepCaveNode(rx + 1, rz, layer, seed), 80);
  if (rnd(7) > 0.26) route(deepCaveNode(rx, rz + 1, layer, seed), 130);
  if (rnd(8) > 0.77) route(deepCaveNode(rx + 1, rz + 1, layer, seed), 180);
  if (layer === 0 && rnd(9) > 0.48) route(deepCaveNode(rx, rz, 1, seed), 230);
  // Short branching dead ends provide distinct exploration routes and ore walls.
  if (rnd(10) > 0.32)
    route(
      {
        x: a.x + (rnd(11) - 0.5) * 100,
        z: a.z + (rnd(12) - 0.5) * 100,
        y: clamp(a.y + (rnd(13) - 0.5) * 28, -50, 45),
      },
      280,
    );
  if (layer === 1 && rnd(14) > 0.5) {
    segments.push({
      a,
      b: { x: a.x + 24 + rnd(15) * 38, z: a.z - 15 + rnd(16) * 30, y: 0 },
      r: 3 + rnd(17),
      tall: 0.9,
      entrance: true,
    });
  }
  if (plans.size >= 1536) plans.clear();
  plans.set(key, segments);
  return segments;
}
export function carveWildCaves(w, c, put) {
  const ox = c.cx * 16,
    oz = c.cz * 16,
    seed = w.seedInt;
  for (let rz = Math.floor(oz / 96) - 2; rz <= Math.floor(oz / 96) + 1; rz++)
    for (let rx = Math.floor(ox / 96) - 2; rx <= Math.floor(ox / 96) + 1; rx++)
      for (let layer = 0; layer < 2; layer++)
        for (const s of wildCavePlan(rx, rz, layer, seed)) {
          const bound = s.room ? s.r * Math.max(1, s.aspect) + 4 : s.r + 2;
          if (
            Math.max(s.a.x, s.b.x) + bound < ox ||
            Math.min(s.a.x, s.b.x) - bound > ox + 15 ||
            Math.max(s.a.z, s.b.z) + bound < oz ||
            Math.min(s.a.z, s.b.z) - bound > oz + 15
          )
            continue;
          const dx = s.b.x - s.a.x,
            dz = s.b.z - s.a.z,
            l2 = dx * dx + dz * dz;
          const ca = Math.cos(s.angle || 0),
            sa = Math.sin(s.angle || 0);
          for (let z = 0; z < 16; z++)
            for (let x = 0; x < 16; x++) {
              const wx = ox + x,
                wz = oz + z,
                ax = wx - s.a.x,
                az = wz - s.a.z;
              const u = l2 ? clamp((ax * dx + az * dz) / l2, 0, 1) : 0;
              const dist = s.room
                ? Math.hypot((ax * ca + az * sa) / s.aspect, -ax * sa + az * ca)
                : Math.hypot(ax - dx * u, az - dz * u);
              const rough =
                (noise2(wx / 11, wz / 11, seed + 14402) - 0.5) *
                (s.room ? 5 : 1.1);
              const radius = s.r + rough;
              if (dist >= radius) continue;
              const t = w.terrain(wx, wz);
              const endY =
                s.entrance && t.h > 66 && !t.village ? t.h + 2 : s.b.y;
              const mid =
                s.a.y +
                (endY - s.a.y) * u +
                (s.room
                  ? Math.sin(ax / 13 + s.phase) * Math.cos(az / 15) * 2.7
                  : 0);
              const vertical =
                s.r * s.tall * Math.sqrt(Math.max(0, 1 - (dist / radius) ** 2));
              const ceiling =
                s.entrance && t.h > 66 && !t.village
                  ? t.h + 1
                  : t.h - (t.village ? 16 : 8);
              const low = Math.max(MIN_Y + 5, Math.ceil(mid - vertical));
              const high = Math.min(ceiling, Math.floor(mid + vertical));
              // Sparse stone columns break up the larger rooms; tunnels cut through them.
              const pillar =
                s.room &&
                s.pillars &&
                dist > 5 &&
                noise2(wx / 6, wz / 6, seed + 14504) > 0.86;
              if (!pillar)
                for (let y = low; y <= high; y++) put(x, y, z, B.air);
              if (!s.room || pillar || high - low < 4) continue;
              if (s.type === "moss_grotto") put(x, low - 1, z, B.moss);
              if (s.type === "rift_cavern" && hash(wx, 8, wz, seed) > 0.65)
                put(x, low - 1, z, B.basalt);
              if (
                s.type === "dripstone_vault" &&
                wx % 4 === 0 &&
                wz % 4 === 0
              ) {
                const h =
                  1 +
                  Math.floor(
                    hash(wx, 9, wz, seed) * Math.min(6, (high - low) / 3),
                  );
                for (let i = 0; i < h; i++) {
                  put(x, low + i, z, B.dripstone);
                  put(x, high - i, z, B.dripstone);
                }
              }
            }
        }
}
export function cinderCaveVoid(x, y, z, seed) {
  const warp = (noise2(x / 100, z / 100, seed + 14801) - 0.5) * 16;
  const halls = noise3((x + warp) / 53, y / 31, (z - warp) / 53, seed + 42);
  const twist = Math.abs(noise3(x / 29, y / 23, z / 29, seed + 14807) - 0.5);
  return halls > 0.66 || (twist < 0.045 && halls > 0.42);
}
