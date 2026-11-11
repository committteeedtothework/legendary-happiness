import { B, SEA, makeStack } from "./data.js";
import { hash, noise2 } from "./random.js";
export const OCEAN_BIOMES = [
  "warm_ocean",
  "lukewarm_ocean",
  "ocean",
  "cold_ocean",
  "frozen_ocean",
  "deep_lukewarm_ocean",
  "deep_ocean",
  "deep_cold_ocean",
  "deep_frozen_ocean",
];
export function oceanTerrain(t, x, z, seed) {
  if (t.h >= SEA - 2) return t;
  const heat = noise2(x / 520, z / 520, seed + 76543),
    deep = t.h < SEA - 16;
  const climate =
    heat < 0.27
      ? "frozen"
      : heat < 0.42
        ? "cold"
        : heat > 0.73
          ? "warm"
          : heat > 0.58
            ? "lukewarm"
            : "";
  const biome =
    climate === "warm"
      ? "warm_ocean"
      : `${deep ? "deep_" : ""}${climate ? climate + "_" : ""}ocean`;
  return { ...t, biome, ocean: true, oceanTemperature: heat };
}
const siteCache = new WeakMap(),
  treasureCache = new WeakMap();
export function oceanSite(world, rx, rz) {
  if (!siteCache.has(world)) siteCache.set(world, new Map());
  const cache = siteCache.get(world),
    key = `${rx},${rz}`;
  if (cache.has(key)) return cache.get(key);
  const s = world.seedInt,
    x = rx * 768 + 224 + Math.floor(hash(rx, 51, rz, s) * 320),
    z = rz * 768 + 224 + Math.floor(hash(rx, 52, rz, s) * 320);
  const t = world.baseTerrain(x, z);
  if (t.h > SEA - 5 || t.h < 20) {
    cache.set(key, null);
    return null;
  }
  const site = {
    x,
    z,
    y: t.h + 1,
    kind: hash(rx, 53, rz, s) > 0.5 ? "wreck" : "ruins",
    axis: hash(rx, 54, rz, s) > 0.5,
    variant: Math.floor(hash(rx, 55, rz, s) * 3),
    biome: t.biome,
    key: `${rx},${rz}`,
  };
  cache.set(key, site);
  return site;
}
export function nearbyOceanSites(world, x, z, r = 900) {
  if (world.dimension !== "overworld" || world.generationVersion < 15)
    return [];
  const out = [];
  for (
    let rz = Math.floor((z - r) / 768);
    rz <= Math.floor((z + r) / 768);
    rz++
  )
    for (
      let rx = Math.floor((x - r) / 768);
      rx <= Math.floor((x + r) / 768);
      rx++
    ) {
      const q = oceanSite(world, rx, rz);
      if (q && Math.hypot(q.x - x, q.z - z) <= r) out.push(q);
    }
  return out.sort(
    (a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z),
  );
}
export function buriedTreasure(world, site) {
  if (!treasureCache.has(world)) treasureCache.set(world, new Map());
  const cache = treasureCache.get(world);
  if (cache.has(site.key)) return cache.get(site.key);
  // Deterministic shoreline search. The map always points to a real generated chest.
  let best = null,
    dist = Infinity;
  for (let dz = -160; dz <= 160; dz += 8)
    for (let dx = -160; dx <= 160; dx += 8) {
      const x = site.x + dx,
        z = site.z + dz,
        t = world.baseTerrain(x, z),
        d = dx * dx + dz * dz;
      if (t.h >= SEA - 1 && t.h <= SEA + 3 && d < dist) {
        best = { x, y: t.h - 2, z };
        dist = d;
      }
    }
  best ||= {
    x: site.x + 19,
    y: world.baseTerrain(site.x + 19, site.z + 19).h - 2,
    z: site.z + 19,
  };
  cache.set(site.key, best);
  return best;
}
function chest(world, put, c, x, y, z, items) {
  const lx = x - c.cx * 16,
    lz = z - c.cz * 16;
  if (lx < 0 || lx >= 16 || lz < 0 || lz >= 16) return;
  put(lx, y, lz, B.chest);
  const key = `${x},${y},${z}`;
  if (!world.containers[key] && !world.edits.has(key))
    world.containers[key] = {
      type: "chest",
      slots: Array.from({ length: 27 }, (_, i) => items[i] || null),
      progress: 0,
      burn: 0,
      xp: 0,
    };
}
export function generateOcean(world, c, put) {
  if (world.generationVersion < 15 || world.dimension !== "overworld") return;
  const s = world.seedInt,
    read = (x, y, z) => c.data[(y + 64) * 256 + z * 16 + x];
  for (let z = 0; z < 16; z++)
    for (let x = 0; x < 16; x++) {
      const wx = c.cx * 16 + x,
        wz = c.cz * 16 + z,
        t = world.terrain(wx, wz),
        h = t.h;
      if (h >= SEA - 2) continue;
      const n = hash(wx, 145, wz, s),
        warm = t.biome === "warm_ocean",
        cold = t.biome.includes("frozen");
      if (read(x, h + 1, z) !== B.water) continue;
      if (warm && noise2(wx / 22, wz / 22, s + 447) > 0.5) {
        const kind = ["tube", "brain", "bubble", "fire", "horn"][
          Math.floor(hash(Math.floor(wx / 3), 0, Math.floor(wz / 3), s) * 5)
        ];
        if (n < 0.32) {
          put(x, h, z, B[`${kind}_coral_block`]);
          put(x, h + 1, z, B[`${kind}_coral${n < 0.14 ? "_fan" : ""}`]);
        } else if (n < 0.4)
          put(
            x,
            h + 1,
            z,
            B[`sea_pickle_${1 + Math.floor(hash(wx, 68, wz, s) * 4)}`],
          );
      } else if (!cold && n < 0.075 && h < SEA - 5) {
        const height = Math.min(
          SEA - h - 2,
          2 + Math.floor(hash(wx, 146, wz, s) * 13),
        );
        for (let y = 1; y <= height; y++)
          if (read(x, h + y, z) === B.water) put(x, h + y, z, B.kelp);
      } else if (!cold && n < 0.27) put(x, h + 1, z, B.seagrass);
      if (n > 0.994 && h < SEA - 8)
        put(x, h, z, n > 0.997 ? B.soul_sand : B.magma_block);
      if (cold && noise2(wx / 19, wz / 19, s + 516) > 0.66) {
        const rise = Math.floor(
          (noise2(wx / 19, wz / 19, s + 516) - 0.66) * 60,
        );
        for (let y = SEA - 3; y <= SEA + rise; y++)
          put(x, y, z, y < SEA ? B.blue_ice : B.packed_ice);
      }
    }
  const sites = nearbyOceanSites(world, c.cx * 16 + 8, c.cz * 16 + 8, 260);
  for (const q of sites) {
    const treasure = buriedTreasure(world, q),
      warm = q.biome === "warm_ocean" || q.biome.includes("lukewarm");
    const set = (dx, dy, dz, id) => {
      const x = q.x + (q.axis ? dz : dx),
        z = q.z + (q.axis ? dx : dz);
      put(x - c.cx * 16, q.y + dy, z - c.cz * 16, id);
    };
    if (q.kind === "wreck") {
      const len = 6 + q.variant * 2;
      for (let dz = -len; dz <= len; dz++)
        for (let dx = -3; dx <= 3; dx++) {
          const edge = Math.abs(dx) === 3 || Math.abs(dz) === len;
          if (Math.abs(dx) + Math.max(0, Math.abs(dz) - len + 2) > 4) continue;
          set(dx, 0, dz, B.planks);
          if (edge)
            for (let dy = 1; dy <= 3; dy++)
              if (hash(q.x + dx, dy, q.z + dz, s) > 0.18)
                set(dx, dy, dz, dy === 3 ? B.log : B.planks);
          if (!edge && Math.abs(dz) < 3 && q.variant !== 1)
            set(dx, 3, dz, B.planks);
        }
      for (let dy = 1; dy <= 8; dy++) set(0, dy, 0, B.log);
      for (let dx = -3; dx <= 3; dx++) set(dx, 7, 0, B.log);
      for (let dy = 4; dy <= 6; dy++)
        for (let dx = 1; dx <= 3; dx++)
          if (hash(dx, dy, q.x, s) > 0.25) set(dx, dy, 0, B.wool);
    } else {
      const stone = warm ? B.sandstone : B.prismarine_bricks;
      for (let dz = -5; dz <= 5; dz++)
        for (let dx = -5; dx <= 5; dx++) {
          if (Math.abs(dx) === 5 || Math.abs(dz) === 5)
            for (let dy = 0; dy <= 2 + q.variant; dy++)
              if (hash(q.x + dx, dy, q.z + dz, s) > 0.3) set(dx, dy, dz, stone);
          if (hash(q.x + dx, 77, q.z + dz, s) > 0.23) set(dx, 0, dz, stone);
          if (Math.abs(dx) === 4 && Math.abs(dz) === 4)
            for (let dy = 1; dy <= 4; dy++)
              set(dx, dy, dz, dy === 4 ? B.sea_lantern : B.prismarine);
        }
    }
    chest(world, put, c, q.x, q.y + 1, q.z + 2, [
      makeStack("iron_ingot", 3 + q.variant),
      makeStack("prismarine_shard", 4),
      { ...makeStack("treasure_map"), mapTarget: treasure },
      makeStack("bread", 3),
    ]);
    chest(world, put, c, treasure.x, treasure.y, treasure.z, [
      makeStack("heart_of_the_sea"),
      makeStack("diamond", 1 + q.variant),
      makeStack("gold_ingot", 4),
      makeStack("prismarine_crystals", 6),
    ]);
  }
}
