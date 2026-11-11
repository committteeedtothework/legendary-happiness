import { B, BLOCKS, ITEMS, MIN_Y, MAX_Y } from "./data.js";
import { hash } from "./random.js";
export const fluid = (id) => BLOCKS[id]?.fluid;
export const isWater = (id) => fluid(id)?.type === "water";
export const isLava = (id) => fluid(id)?.type === "lava";
export const fluidHeight = (id) => {
  const f = fluid(id);
  return f ? (f.falling ? 1 : (8 - f.level) / 9) : 0;
};
export function fluidSurfaceHeight(w, x, y, z, id = w.get(x, y, z)) {
  return fluid(id) &&
    fluid(w.get(x, Math.floor(y) + 1, z))?.type === fluid(id).type
    ? 1
    : fluidHeight(id);
}
const sides = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const neighbors = [...sides, [0, 1, 0], [0, -1, 0]];
const keyOf = (x, y, z) => `${x},${y},${z}`;
export const flammable = (id) =>
  /^(.*_log|log|.*leaves|planks|wool|hay_bale|bookshelf|bamboo|wild_grass|fern|crop|sugar_cane|oak_door.*)$/.test(
    BLOCKS[id]?.key || "",
  );
// Simulation never generates chunks. A suspended border resumes when it is loaded.
export function peek(w, x, y, z) {
  if (y <= MIN_Y) return B.bedrock;
  if (y > MAX_Y) return B.air;
  const cx = Math.floor(x / 16),
    cz = Math.floor(z / 16),
    c = w.chunks.get(`${cx},${cz}`);
  return c
    ? c.data[(y - MIN_Y) * 256 + (z - cz * 16) * 16 + x - cx * 16]
    : B.bedrock;
}
export function initDynamics(w) {
  w.fluidQueue = new Map();
  w.fluidBuckets = Array.from({ length: 64 }, () => []);
  w.blockTimers = {};
  w.dynamicBursts = [];
  w.dynamicDrops = [];
}
function delay(w, id) {
  return isLava(id) ? (w.dimension === "cinderwild" ? 10 : 30) : 5;
}
export function scheduleFluid(w, x, y, z, wait = 5) {
  if (y <= MIN_Y || y > MAX_Y) return;
  const key = keyOf(x, y, z),
    due = w.tick + Math.max(1, wait),
    old = w.fluidQueue.get(key);
  if (old !== undefined && old <= due) return;
  w.fluidQueue.set(key, due);
  w.fluidBuckets[due % 64].push([key, due]);
}
export function notifyDynamics(w, x, y, z, old, id) {
  const key = keyOf(x, y, z);
  if (fluid(old)?.type !== fluid(id)?.type) w.fluidQueue.delete(key);
  if (
    fluid(id) &&
    !fluid(old) &&
    !BLOCKS[old]?.solid &&
    (old === B.crop || ITEMS[BLOCKS[old]?.drop])
  ) {
    const drop = old === B.crop ? "seeds" : BLOCKS[old].drop;
    w.dynamicDrops.push({ id: drop, x: x + 0.5, y: y + 0.3, z: z + 0.5 });
    if (old === B.crop && w.cropTicks[key]?.age >= 7)
      w.dynamicDrops.push({ id: "wheat", x: x + 0.5, y: y + 0.3, z: z + 0.5 });
    delete w.cropTicks[key];
  }
  if (id !== B.fire && id !== B.primed_tnt) delete w.blockTimers[key];
  else
    w.blockTimers[key] ||= {
      kind: id === B.fire ? "fire" : "tnt",
      ticks: id === B.fire ? 0 : 80,
    };
  for (const [dx, dy, dz] of [[0, 0, 0], ...neighbors]) {
    const a = x + dx,
      b = y + dy,
      c = z + dz,
      next = peek(w, a, b, c);
    // Air also needs reevaluation after its upstream source is removed.
    if (fluid(next) || fluid(old) || fluid(id))
      scheduleFluid(
        w,
        a,
        b,
        c,
        delay(w, fluid(next) ? next : fluid(old) ? old : id),
      );
  }
}
export function restoreDynamics(w, timers = {}) {
  w.blockTimers = {};
  for (const [key, id] of w.edits) {
    const p = key.split(",").map(Number);
    if (p.length !== 3 || !p.every(Number.isInteger)) continue;

    if (id === B.fire || id === B.primed_tnt) {
      const t = timers[key];
      w.blockTimers[key] = {
        kind: id === B.fire ? "fire" : "tnt",
        ticks:
          id === B.fire
            ? Math.max(0, Math.min(600, Number(t?.ticks) || 0))
            : Math.max(1, Math.min(80, Number(t?.ticks) || 80)),
      };
    }
  }
}
// Only loaded chunks wake their saved changes. This avoids requeuing every
// mined cell in a large save and keeps far-away fluid updates suspended.
export function wakeDynamicsChunk(w, cx, cz) {
  for (const [dx, dz] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    if (!w.chunks.has(`${cx + dx},${cz + dz}`)) continue;
    for (const [x, y, z] of w.editChunks.get(`${cx + dx},${cz + dz}`) || []) {
      for (const [a, b, c] of [[0, 0, 0], ...neighbors]) {
        const id = peek(w, x + a, y + b, z + c);
        if (fluid(id)) scheduleFluid(w, x + a, y + b, z + c, delay(w, id));
      }
    }
  }
}
function replaceable(id) {
  return (
    id === B.air ||
    id === B.fire ||
    [
      B.wild_grass,
      B.fern,
      B.poppy,
      B.cornflower,
      B.crop,
      B.sugar_cane,
      B.bamboo,
      B.torch,
    ].includes(id)
  );
}
function state(type, level, falling = false) {
  return B[`${type}_flow_${falling ? 8 : level}`];
}
function blockedBelow(w, x, y, z, type) {
  const id = peek(w, x, y - 1, z),
    f = fluid(id);
  return !replaceable(id) && (!f || f.type !== type || f.source);
}
function cool(w, x, y, z, id) {
  const f = fluid(id);
  if (!f || f.type !== "lava") return false;
  if (isWater(peek(w, x, y - 1, z))) w.set(x, y - 1, z, B.stone);
  if (
    neighbors.some(([dx, dy, dz]) => isWater(peek(w, x + dx, y + dy, z + dz)))
  ) {
    // Water contacting a source makes obsidian; flowing lava makes cobblestone.
    w.set(x, y, z, f.source ? B.obsidian : B.cobble);
    return true;
  }
  return false;
}
function updateFluid(w, x, y, z) {
  let id = peek(w, x, y, z),
    f = fluid(id);
  if (!f) return;
  if (f.type === "water" && w.dimension === "cinderwild") {
    w.set(x, y, z, B.air);
    return;
  }
  if (cool(w, x, y, z, id)) return;
  if (f.type === "water")
    for (const [dx, dy, dz] of neighbors)
      cool(w, x + dx, y + dy, z + dz, peek(w, x + dx, y + dy, z + dz));
  const cost = f.type === "lava" && w.dimension !== "cinderwild" ? 2 : 1;
  if (!f.source) {
    let next = B.air;
    const above = fluid(peek(w, x, y + 1, z));
    if (above?.type === f.type) next = state(f.type, 0, true);
    else {
      let best = 8,
        sources = 0;
      for (const [dx, , dz] of sides) {
        const n = fluid(peek(w, x + dx, y, z + dz));
        if (n?.type !== f.type) continue;
        if (n.source) sources++;
        if (blockedBelow(w, x + dx, y, z + dz, f.type))
          best = Math.min(best, (n.falling ? 0 : n.level) + cost);
      }
      if (
        f.type === "water" &&
        sources >= 2 &&
        (BLOCKS[peek(w, x, y - 1, z)]?.solid ||
          fluid(peek(w, x, y - 1, z))?.source)
      )
        next = B.water;
      else if (best <= 7) next = state(f.type, best);
    }
    if (next !== id) {
      w.set(x, y, z, next);
      id = next;
      f = fluid(id);
    }
    if (!f) return;
  }
  const below = peek(w, x, y - 1, z);
  if (replaceable(below)) {
    w.set(x, y - 1, z, state(f.type, 0, true));
    return;
  }
  if (!blockedBelow(w, x, y, z, f.type)) return;
  const level = (f.falling ? 0 : f.level) + cost;
  if (level > 7) return;
  for (const [dx, , dz] of sides) {
    const a = x + dx,
      c = z + dz,
      n = peek(w, a, y, c),
      nf = fluid(n);
    if (replaceable(n)) w.set(a, y, c, state(f.type, level));
    else if (
      nf?.type === f.type &&
      !nf.source &&
      !nf.falling &&
      nf.level > level
    )
      w.set(a, y, c, state(f.type, level));
  }
}
function active(w, x, z, center, radius) {
  return (
    w.chunks.has(`${Math.floor(x / 16)},${Math.floor(z / 16)}`) &&
    (!center || Math.hypot(x - center.x, z - center.z) <= radius)
  );
}
export function primeTnt(w, x, y, z, fuse = 80) {
  if (peek(w, x, y, z) !== B.tnt) return false;
  w.set(x, y, z, B.primed_tnt);
  w.blockTimers[keyOf(x, y, z)] = { kind: "tnt", ticks: fuse };
  return true;
}
export function igniteBlock(w, x, y, z) {
  const id = peek(w, x, y, z);
  if (id === B.tnt) return primeTnt(w, x, y, z);
  if (!replaceable(id) || id === B.fire) return false;
  if (
    !BLOCKS[peek(w, x, y - 1, z)]?.solid &&
    !neighbors.some(([dx, dy, dz]) =>
      flammable(peek(w, x + dx, y + dy, z + dz)),
    )
  )
    return false;
  return w.set(x, y, z, B.fire);
}
export function extinguishBlock(w, x, y, z) {
  if (peek(w, x, y, z) !== B.fire) return false;
  return w.set(x, y, z, B.air);
}
export function simulateDynamics(w, center, radius = 96) {
  const bucket = w.fluidBuckets[w.tick % 64];
  w.fluidBuckets[w.tick % 64] = [];
  let budget = 400;
  for (const [key, due] of bucket) {
    if (w.fluidQueue.get(key) !== due) continue;
    if (due > w.tick) {
      w.fluidBuckets[due % 64].push([key, due]);
      continue;
    }
    w.fluidQueue.delete(key);
    const [x, y, z] = key.split(",").map(Number);
    if (!budget || !active(w, x, z, center, radius)) {
      scheduleFluid(w, x, y, z, 40);
      continue;
    }
    budget--;
    updateFluid(w, x, y, z);
  }
  // Wake exposed natural sources locally; untouched oceans are never flood-filled.
  if (center && w.tick % 40 === 0) {
    let count = 0;
    for (let dz = -8; dz <= 8 && count < 48; dz++)
      for (let dx = -8; dx <= 8 && count < 48; dx++)
        for (let dy = -8; dy <= 4 && count < 48; dy++) {
          const x = Math.floor(center.x) + dx,
            y = Math.floor(center.y) + dy,
            z = Math.floor(center.z) + dz,
            id = peek(w, x, y, z);
          if (
            fluid(id)?.source &&
            neighbors.some(
              ([a, b, c]) =>
                replaceable(peek(w, x + a, y + b, z + c)) ||
                (isLava(id) && isWater(peek(w, x + a, y + b, z + c))),
            )
          ) {
            scheduleFluid(w, x, y, z, delay(w, id));
            count++;
          }
        }
  }
  for (const [key, t] of Object.entries(w.blockTimers)) {
    const [x, y, z] = key.split(",").map(Number);
    if (!active(w, x, z, center, radius)) continue;
    const id = peek(w, x, y, z);
    if (t.kind === "tnt") {
      if (id !== B.primed_tnt) {
        delete w.blockTimers[key];
        continue;
      }
      if (--t.ticks <= 0) {
        w.set(x, y, z, B.air);
        w.dynamicBursts.push({
          x: x + 0.5,
          y: y + 0.5,
          z: z + 0.5,
          type: "tnt",
        });
      }
      continue;
    }
    if (id !== B.fire) {
      delete w.blockTimers[key];
      continue;
    }
    if (w.tick % 20 !== 0) continue;
    t.ticks += 20;
    const wet = neighbors.some(([a, b, c]) =>
        isWater(peek(w, x + a, y + b, z + c)),
      ),
      rainy =
        w.weather?.kind !== "clear" &&
        w.weather?.intensity > 0.4 &&
        w.dimension === "overworld" &&
        w.skyHeight(x, z) < y;
    if (
      wet ||
      rainy ||
      (peek(w, x, y - 1, z) !== B.cinderstone &&
        (t.ticks >= 300 ||
          (t.ticks > 40 && hash(x, w.tick, z, w.seedInt) > 0.82)))
    ) {
      w.set(x, y, z, B.air);
      continue;
    }
    for (const [dx, dy, dz] of neighbors) {
      const a = x + dx,
        b = y + dy,
        c = z + dz,
        n = peek(w, a, b, c);
      if (n === B.tnt) primeTnt(w, a, b, c, 20);
      if (!flammable(n)) continue;
      if (hash(a, w.tick, b + c, w.seedInt) > 0.65) {
        // Containers are deliberately excluded from flammables: never erase inventories.
        w.set(a, b, c, B.air);
        igniteBlock(w, a, b, c);
      }
      for (const [ex, ey, ez] of neighbors)
        if (hash(a + ex, w.tick + b + ey, c + ez, w.seedInt) > 0.88)
          igniteBlock(w, a + ex, b + ey, c + ez);
    }
  }
}
export function cactusContact(w, p, height = 1.8, width = 0.6) {
  const r = width / 2 + 0.035;
  for (let y = Math.floor(p.y - 0.035); y <= Math.floor(p.y + height); y++)
    for (let x = Math.floor(p.x - r); x <= Math.floor(p.x + r); x++)
      for (let z = Math.floor(p.z - r); z <= Math.floor(p.z + r); z++) {
        if (w.get(x, y, z) !== B.cactus) continue;
        if (
          p.x + r > x + 1 / 16 &&
          p.x - r < x + 15 / 16 &&
          p.z + r > z + 1 / 16 &&
          p.z - r < z + 15 / 16 &&
          p.y + height > y &&
          p.y < y + 1.035
        )
          return true;
      }
  return false;
}
export function fluidCurrent(w, x, y, z) {
  x = Math.floor(x);
  y = Math.floor(y);
  z = Math.floor(z);
  const f = fluid(w.get(x, y, z));
  if (!f) return [0, 0];
  let vx = 0,
    vz = 0;
  for (const [dx, , dz] of sides) {
    const n = fluid(w.get(x + dx, y, z + dz));
    if (n?.type === f.type) {
      const slope = (n.falling ? 8 : n.level) - f.level;
      vx += dx * slope;
      vz += dz * slope;
    }
  }
  const d = Math.hypot(vx, vz);
  return d ? [vx / d, vz / d] : [0, 0];
}
