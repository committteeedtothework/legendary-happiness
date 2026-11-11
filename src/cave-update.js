import { B, MIN_Y, makeStack } from "./data.js";
import { hash, noise2 } from "./random.js";
const at = (x, y, z) => (y - MIN_Y) * 256 + z * 16 + x;
export const CAVE_REGIONS = [
  "hollow_halls",
  "dripstone_vault",
  "moss_grotto",
  "rift_cavern",
];
export function deepCaveNode(rx, rz, layer, seed) {
  const type = CAVE_REGIONS[Math.floor(hash(rx, layer + 71, rz, seed) * 4)];
  return {
    x: rx * 96 + 24 + hash(rx, layer + 11, rz, seed) * 48,
    z: rz * 96 + 24 + hash(rx, layer + 12, rz, seed) * 48,
    y:
      layer === 0
        ? -46 + hash(rx, 13, rz, seed) * 22
        : 4 + hash(rx, 14, rz, seed) * 28,
    radius: 12 + hash(rx, layer + 15, rz, seed) * 11,
    type,
  };
}
export function carveDeepCaves(w, c, put) {
  const ox = c.cx * 16,
    oz = c.cz * 16,
    seed = w.seedInt;
  const carve = (a, b, r, room = false, entrance = false) => {
    const bound = room && a.type === "rift_cavern" ? r * 1.4 + 3 : r + 3;
    if (
      Math.max(a.x, b.x) + bound < ox ||
      Math.min(a.x, b.x) - bound > ox + 15 ||
      Math.max(a.z, b.z) + bound < oz ||
      Math.min(a.z, b.z) - bound > oz + 15
    )
      return;
    const dx = b.x - a.x,
      dz = b.z - a.z,
      l2 = dx * dx + dz * dz;
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const wx = ox + x,
          wz = oz + z,
          t = w.terrain(wx, wz),
          u = l2
            ? Math.max(0, Math.min(1, ((wx - a.x) * dx + (wz - a.z) * dz) / l2))
            : 0;
        let distance = Math.hypot(wx - a.x - dx * u, wz - a.z - dz * u);
        if (room && a.type === "rift_cavern")
          distance = Math.hypot((wx - a.x) * 1.6, (wz - a.z) * 0.73);
        const rough = room ? (noise2(wx / 9, wz / 9, seed + 402) - 0.5) * 2 : 0;
        if (distance >= r + rough) continue;
        const mid = a.y + (b.y - a.y) * u,
          vertical =
            (room
              ? r *
                (a.type === "rift_cavern"
                  ? 0.95
                  : a.type === "moss_grotto"
                    ? 0.44
                    : 0.68)
              : r * 0.85) *
            Math.sqrt(Math.max(0, 1 - (distance / (r + rough)) ** 2));
        const ceiling =
          entrance && t.h > 66 && !t.village
            ? t.h + 1
            : t.h - (t.village ? 15 : 8);
        const low = Math.max(MIN_Y + 5, Math.ceil(mid - vertical)),
          high = Math.min(ceiling, Math.floor(mid + vertical));
        for (let y = low; y <= high; y++) put(x, y, z, B.air);
        if (room && high - low > 3) {
          if (a.type === "moss_grotto") {
            put(x, low - 1, z, B.moss);
            if (hash(wx, low, wz, seed + 400) > 0.985) put(x, low, z, B.water);
          } else if (
            a.type === "dripstone_vault" &&
            hash(Math.floor(wx / 3), 2, Math.floor(wz / 3), seed) > 0.77
          ) {
            const h =
              1 +
              Math.floor(hash(wx, 1, wz, seed) * Math.min(5, (high - low) / 3));
            if (wx % 3 === 0 && wz % 3 === 0)
              for (let k = 0; k < h; k++) put(x, low + k, z, B.dripstone);
            if (wx % 3 === 1 && wz % 3 === 1)
              for (let k = 0; k < h; k++) put(x, high - k, z, B.dripstone);
          } else if (a.type === "rift_cavern" && hash(wx, 8, wz, seed) > 0.7)
            put(x, low - 1, z, B.basalt);
        }
      }
  };
  const rx0 = Math.floor(ox / 96),
    rz0 = Math.floor(oz / 96);
  for (let rz = rz0 - 1; rz <= rz0 + 1; rz++)
    for (let rx = rx0 - 1; rx <= rx0 + 1; rx++)
      for (let layer = 0; layer < 2; layer++) {
        const a = deepCaveNode(rx, rz, layer, seed);
        carve(a, a, a.radius, true);
        for (const [dx, dz] of [
          [1, 0],
          [0, 1],
        ]) {
          const b = deepCaveNode(rx + dx, rz + dz, layer, seed),
            mid = {
              x: (a.x + b.x) / 2 + (dz ? 9 : 0),
              z: (a.z + b.z) / 2 + (dx ? 9 : 0),
              y:
                (a.y + b.y) / 2 +
                Math.sin(hash(rx, layer + 5, rz, seed) * 6.28) * 5,
            };
          const radius = 2.5 + hash(rx, layer + dx + 19, rz + dz, seed) * 1.8;
          carve(a, mid, radius);
          carve(mid, b, radius);
        }
        if (layer === 0 && hash(rx, 50, rz, seed) > 0.45)
          carve(a, deepCaveNode(rx + 1, rz, 1, seed), 3.2);
        if (layer === 1 && hash(rx, 51, rz, seed) > 0.5) {
          const x = a.x + 72,
            z = a.z - 16,
            t = w.terrain(x, z);
          if (t.h > 66 && !t.village)
            carve(a, { x, z, y: t.h + 2 }, 3.6, false, true);
        }
      }
}
// One seeded vein per separated 3D cell. Neighbouring chunks evaluate identical
// anchors, so vein/structure geometry does not depend on generation order.
export const ORE_VEINS = [
  {
    key: "coal_ore",
    grid: 20,
    step: 32,
    min: 0,
    max: 128,
    chance: 0.9,
    r: 2.15,
  },
  {
    key: "iron_ore",
    grid: 24,
    step: 28,
    min: -56,
    max: 64,
    chance: 0.9,
    r: 2.0,
  },
  {
    key: "copper_ore",
    grid: 24,
    step: 32,
    min: -16,
    max: 96,
    chance: 0.8,
    r: 2.15,
  },
  {
    key: "gold_ore",
    grid: 32,
    step: 32,
    min: -56,
    max: 32,
    chance: 0.7,
    r: 1.8,
  },
  {
    key: "lapis_ore",
    grid: 32,
    step: 32,
    min: -32,
    max: 32,
    chance: 0.65,
    r: 1.7,
  },
  {
    key: "diamond_ore",
    grid: 32,
    step: 16,
    min: -56,
    max: 8,
    chance: 0.72,
    r: 1.55,
  },
  {
    key: "emerald_ore",
    grid: 48,
    step: 32,
    min: -16,
    max: 112,
    chance: 0.5,
    r: 1.4,
  },
];
export function generateSpacedOres(w, c, put) {
  const ox = c.cx * 16,
    oz = c.cz * 16;
  for (const [type, o] of ORE_VEINS.entries())
    for (
      let rz = Math.floor((oz - 4) / o.grid);
      rz <= Math.floor((oz + 19) / o.grid);
      rz++
    )
      for (
        let rx = Math.floor((ox - 4) / o.grid);
        rx <= Math.floor((ox + 19) / o.grid);
        rx++
      )
        for (
          let layer = 0;
          layer < Math.ceil((o.max - o.min) / o.step);
          layer++
        ) {
          const seed = w.seedInt + 19871 + type * 411;
          const chance =
            o.key === "diamond_ore" ? o.chance * (1 - layer * 0.13) : o.chance;
          if (hash(rx, layer, rz, seed) > chance) continue;
          const x = Math.floor(
              rx * o.grid +
                o.grid * (0.25 + hash(rx, layer + 11, rz, seed) * 0.5),
            ),
            z = Math.floor(
              rz * o.grid +
                o.grid * (0.25 + hash(rx, layer + 12, rz, seed) * 0.5),
            ),
            y = Math.floor(
              o.min +
                layer * o.step +
                3 +
                hash(rx, layer + 13, rz, seed) * (o.step - 6),
            );
          if (o.key === "emerald_ore" && w.terrain(x, z).h < 85) continue;
          const r = o.r,
            ry = r * 0.75;
          for (let dz = -3; dz <= 3; dz++)
            for (let dx = -3; dx <= 3; dx++)
              for (let dy = -2; dy <= 2; dy++) {
                const lx = x + dx - ox,
                  lz = z + dz - oz,
                  wy = y + dy;
                if (
                  lx < 0 ||
                  lx >= 16 ||
                  lz < 0 ||
                  lz >= 16 ||
                  wy < o.min ||
                  wy > o.max
                )
                  continue;
                if (
                  (dx / r) ** 2 + (dy / ry) ** 2 + (dz / r) ** 2 > 1 ||
                  hash(x + dx, wy, z + dz, seed + 7) < 0.12
                )
                  continue;
                if (c.data[at(lx, wy, lz)] === B.stone)
                  put(lx, wy, lz, B[o.key]);
              }
        }
}
export function mineshaftSite(w, rx, rz) {
  if (
    w.dimension !== "overworld" ||
    w.generationVersion < 12 ||
    hash(rx, 88, rz, w.seedInt) > 0.52
  )
    return null;
  const a = deepCaveNode(
    rx * 2 + (hash(rx, 89, rz, w.seedInt) > 0.5 ? 1 : 0),
    rz * 2,
    hash(rx, 90, rz, w.seedInt) > 0.5 ? 1 : 0,
    w.seedInt,
  );
  return {
    id: `mineshaft:${rx}:${rz}`,
    x: Math.floor(a.x),
    y: Math.floor(a.y - 2),
    z: Math.floor(a.z),
    type: a.type,
  };
}
export function mineshaftLoot(w, s, index) {
  const loot = [
    makeStack("planks", 8),
    makeStack("coal", 4 + index * 2),
    makeStack("iron_ingot", 2),
    makeStack("bread", 3),
    makeStack("string", 3),
  ];
  if (hash(s.x, index, s.z, w.seedInt + 71) < 0.2)
    loot.push(makeStack("diamond"));
  else loot.push(makeStack("lapis_lazuli", 3));
  return loot;
}
export function generateMineshafts(w, c, put) {
  const ox = c.cx * 16,
    oz = c.cz * 16;
  for (
    let rz = Math.floor((oz - 42) / 192);
    rz <= Math.floor((oz + 57) / 192);
    rz++
  )
    for (
      let rx = Math.floor((ox - 42) / 192);
      rx <= Math.floor((ox + 57) / 192);
      rx++
    ) {
      // The linked node may lie anywhere in its 192-block cell.
      const s = mineshaftSite(w, rx, rz);
      if (!s || Math.abs(s.x - ox - 8) > 48 || Math.abs(s.z - oz - 8) > 48)
        continue;
      const set = (dx, dy, dz, id) =>
        put(s.x + dx - ox, s.y + dy, s.z + dz - oz, id);
      const corridor = (axis, start, end, offset = 0) => {
        for (let a = start; a <= end; a++)
          for (let b = -2; b <= 2; b++) {
            const x = axis === "x" ? a : offset + b,
              z = axis === "x" ? offset + b : a;
            set(x, -1, z, B.planks);
            for (let y = 0; y < 4; y++) set(x, y, z, B.air);
          }
        for (let a = start + 2; a < end; a += 6) {
          for (const b of [-2, 2])
            for (let y = 0; y < 3; y++)
              set(
                axis === "x" ? a : offset + b,
                y,
                axis === "x" ? offset + b : a,
                B.log,
              );
          for (let b = -2; b <= 2; b++)
            set(
              axis === "x" ? a : offset + b,
              3,
              axis === "x" ? offset + b : a,
              B.planks,
            );
          if (hash(a, offset, s.x, w.seedInt) > 0.45)
            set(
              axis === "x" ? a + 1 : offset + 1,
              2,
              axis === "x" ? offset + 1 : a + 1,
              B.cobweb,
            );
        }
        for (let a = start; a <= end; a++)
          set(
            axis === "x" ? a : offset,
            0,
            axis === "x" ? offset : a,
            B.mine_rail,
          );
      };
      corridor("x", -28, 28);
      corridor("z", -22, 22);
      corridor("z", -13, 16, 18);
      for (const [i, [dx, dz]] of [
        [12, 1],
        [-1, -18],
      ].entries()) {
        set(dx, 0, dz, B.chest);
        const x = s.x + dx,
          z = s.z + dz,
          key = `${x},${s.y},${z}`;
        if (
          Math.floor(x / 16) === c.cx &&
          Math.floor(z / 16) === c.cz &&
          !w.containers[key] &&
          !w.edits.has(key)
        ) {
          const slots = Array(27).fill(null);
          mineshaftLoot(w, s, i).forEach((v, n) => (slots[n] = v));
          w.containers[key] = { type: "chest", slots, mineshaft: s.id };
        }
      }
    }
}

export function caveRegionAt(w, p) {
  let nearest = null,
    best = Infinity;
  for (let rz = Math.floor(p.z / 96) - 1; rz <= Math.floor(p.z / 96) + 1; rz++)
    for (
      let rx = Math.floor(p.x / 96) - 1;
      rx <= Math.floor(p.x / 96) + 1;
      rx++
    )
      for (let layer = 0; layer < 2; layer++) {
        const a = deepCaveNode(rx, rz, layer, w.seedInt),
          d = Math.hypot(p.x - a.x, (p.y - a.y) * 0.8, p.z - a.z);
        if (d < best) {
          best = d;
          nearest = a.type;
        }
      }
  return nearest;
}
