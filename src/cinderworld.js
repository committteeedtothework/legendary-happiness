import { B, MIN_Y, MAX_Y, makeStack } from "./data.js";
import { hash, noise2, noise3, fractal } from "./random.js";
import {
  infernalSite,
  nearbyInfernalSites,
  infernalTerrain,
  generateInfernalWorld,
} from "./infernal-world.js";

export const CINDER_BIOMES = {
  ash_wastes: { name: "Ash Wastes", surface: "ash" },
  emberwood: { name: "Emberwood Grove", surface: "cinderstone" },
  basalt_ridges: { name: "Basalt Ridges", surface: "basalt" },
  sulfur_basin: { name: "Sulfur Basin", surface: "cinderstone" },
  bloodlands: { name: "Bloodglass Caldera", surface: "cinderstone" },
  soul_vale: { name: "Valley of Souls", surface: "ash" },
};
export function cinderBase(x, z, seed) {
  const heat = noise2(x / 220, z / 220, seed + 301),
    ridges = 1 - Math.abs(noise2(x / 95, z / 95, seed + 73) * 2 - 1),
    basin = Math.abs(noise2(x / 150, z / 150, seed + 277) - 0.5);
  let h = 69 + fractal(x / 145, z / 145, seed) * 30 + ridges ** 4 * 25;
  if (basin < 0.052) h -= (1 - basin / 0.052) * 26;
  const biome =
    heat < 0.34
      ? "ash_wastes"
      : heat > 0.66
        ? "sulfur_basin"
        : ridges > 0.84
          ? "basalt_ridges"
          : "emberwood";
  return { h: Math.floor(h), biome, river: basin, land: heat };
}
export function cinderSite(world, rx, rz) {
  if (world.generationVersion >= 11) return infernalSite(world, rx, rz);
  if (world.dimension !== "cinderwild" || world.generationVersion < 7)
    return null;
  world.cinderPlans ||= new Map();
  const key = `${rx},${rz}`;
  if (world.cinderPlans.has(key)) return world.cinderPlans.get(key);
  let result = null;
  for (let attempt = 0; attempt < 7; attempt++) {
    const x =
        rx * 320 +
        96 +
        Math.floor(hash(rx, rz, attempt, world.seedInt + 51) * 128),
      z =
        rz * 320 +
        96 +
        Math.floor(hash(rz, rx, attempt, world.seedInt + 852) * 128),
      t = cinderBase(x, z, world.seedInt);
    if (
      t.h < 74 ||
      t.h > 121 ||
      Math.abs(cinderBase(x + 16, z + 16, world.seedInt).h - t.h) > 16
    )
      continue;
    result = {
      id: `cinder:${key}`,
      x,
      z,
      y: t.h,
      kind: ["bastion", "shrine", "waystation"][
        Math.floor(hash(rx, rz, 17, world.seedInt) * 3)
      ],
    };
    break;
  }
  if (world.cinderPlans.size > 512) world.cinderPlans.clear();
  world.cinderPlans.set(key, result);
  return result;
}
export function nearbyCinderSites(world, x, z, radius = 48) {
  if (world.generationVersion >= 11)
    return nearbyInfernalSites(world, x, z, radius);
  const found = [];
  for (
    let rz = Math.floor((z - radius - 20) / 320);
    rz <= Math.floor((z + radius + 20) / 320);
    rz++
  )
    for (
      let rx = Math.floor((x - radius - 20) / 320);
      rx <= Math.floor((x + radius + 20) / 320);
      rx++
    ) {
      const site = cinderSite(world, rx, rz);
      if (site && Math.hypot(site.x - x, site.z - z) <= radius + 24)
        found.push(site);
    }
  return found;
}
export function cinderTerrain(world, x, z) {
  if (world.generationVersion >= 11) return infernalTerrain(world, x, z);
  const t = cinderBase(x, z, world.seedInt);
  for (const site of nearbyCinderSites(world, x, z, 20)) {
    const d = Math.max(Math.abs(x - site.x), Math.abs(z - site.z));
    if (d <= 17) return { ...t, h: site.y, structure: site.id };
    if (d < 24) t.h = Math.round(site.y + (t.h - site.y) * ((d - 17) / 7));
  }
  return t;
}
// Sparse coherent veins, about 0.3% Hellfire and 0.5% brimstone in valid rock.
// Ore is exclusive to the new Cinderworld and requires diamond/iron respectively.
export function cinderOre(x, y, z, seed) {
  if (y < 15 || y > 70) return B.cinderstone;
  const gx = Math.floor(x / 12),
    gy = Math.floor(y / 12),
    gz = Math.floor(z / 12),
    r = hash(gx, gy, gz, seed + 924),
    cx = gx * 12 + 3 + Math.floor(hash(gx, gy, gz, seed + 925) * 6),
    cy = gy * 12 + 3 + Math.floor(hash(gx, gy, gz, seed + 926) * 6),
    cz = gz * 12 + 3 + Math.floor(hash(gx, gy, gz, seed + 927) * 6);
  return Math.abs(x - cx) + Math.abs(y - cy) + Math.abs(z - cz) <= 2
    ? r < 0.22
      ? B.hellfire_ore
      : r < 0.56
        ? B.brimstone_ore
        : B.cinderstone
    : B.cinderstone;
}
export function generateCinderworld(world, chunk) {
  if (world.generationVersion >= 11) return generateInfernalWorld(world, chunk);
  const { cx, cz, data, key } = chunk,
    seed = world.seedInt;
  const put = (x, y, z, id) => {
    if (x < 0 || x >= 16 || z < 0 || z >= 16 || y < MIN_Y || y > MAX_Y) return;
    data[(y - MIN_Y) * 256 + z * 16 + x] = id;
    chunk.maxY = Math.max(chunk.maxY, y);
    if (id === B.torch || id === B.glow_crystal)
      world.generatedLights.add(`${cx * 16 + x},${y},${cz * 16 + z}`);
  };
  for (let z = 0; z < 16; z++)
    for (let x = 0; x < 16; x++) {
      const wx = cx * 16 + x,
        wz = cz * 16 + z,
        t = world.terrain(wx, wz),
        surface = B[CINDER_BIOMES[t.biome].surface];
      for (
        let y = world.surfaceOnly ? Math.max(MIN_Y, t.h - 18) : MIN_Y;
        y <= Math.max(68, t.h);
        y++
      ) {
        let id =
          y === MIN_Y
            ? B.bedrock
            : y > t.h
              ? B.lava
              : y >= t.h - 2
                ? surface
                : B.cinderstone;
        if (
          y > MIN_Y + 4 &&
          y < t.h - 5 &&
          noise3(wx / 24, y / 16, wz / 24, seed + 42) > 0.69
        )
          id = y < 8 ? B.lava : B.air;
        if (id === B.cinderstone && y < t.h - 5)
          id = cinderOre(wx, y, wz, seed);
        put(x, y, z, id);
      }
      if (!t.structure && t.h > 70 && hash(wx, 1, wz, seed + 22) < 0.018)
        put(x, t.h + 1, z, B.glow_crystal);
    }
  // Pure anchor evaluation across borders avoids generation-order seams.
  for (let z = -3; z < 19; z++)
    for (let x = -3; x < 19; x++) {
      const wx = cx * 16 + x,
        wz = cz * 16 + z,
        t = world.terrain(wx, wz);
      if (t.h <= 71 || t.structure) continue;
      if (t.biome === "emberwood" && hash(wx, 2, wz, seed + 17) < 0.014) {
        const height = 5 + Math.floor(hash(wx, 3, wz, seed) * 4);
        for (let dy = 1; dy <= height; dy++) put(x, t.h + dy, z, B.ashen_log);
        for (let dz = -3; dz <= 3; dz++)
          for (let dx = -3; dx <= 3; dx++)
            if (dx * dx + dz * dz <= 10) {
              put(x + dx, t.h + height, z + dz, B.ember_leaves);
              if (Math.abs(dx) + Math.abs(dz) < 4)
                put(x + dx, t.h + height + 1, z + dz, B.ember_leaves);
            }
        put(x, t.h + height + 2, z, B.glow_crystal);
      } else if (
        t.biome === "basalt_ridges" &&
        hash(wx, 3, wz, seed + 19) < 0.018
      ) {
        const height = 4 + Math.floor(hash(wx, 4, wz, seed) * 8);
        for (let dy = 1; dy <= height; dy++)
          put(x, t.h + dy, z, dy === height ? B.glow_crystal : B.basalt);
      }
    }
  for (const site of nearbyCinderSites(world, cx * 16 + 8, cz * 16 + 8, 28))
    generateCinderStructure(world, chunk, put, site);
  for (const [x, y, z, id] of world.editChunks.get(key) || [])
    put(x - cx * 16, y, z - cz * 16, id);
  world.dirty.add(key);
  return chunk;
}
function generateCinderStructure(world, chunk, put, s) {
  const set = (x, y, z, id) =>
      put(s.x + x - chunk.cx * 16, s.y + y, s.z + z - chunk.cz * 16, id),
    r = s.kind === "bastion" ? 12 : s.kind === "shrine" ? 9 : 7;
  for (let z = -r; z <= r; z++)
    for (let x = -r; x <= r; x++) {
      set(x, 0, z, B.cinder_bricks);
      for (let y = 1; y <= 10; y++) set(x, y, z, B.air);
      if (
        s.kind === "bastion" &&
        (Math.abs(x) === r || Math.abs(z) === r) &&
        !(Math.abs(x) < 2 && z === r)
      )
        for (let y = 1; y <= ((x + z) % 3 === 0 ? 5 : 4); y++)
          set(x, y, z, B.cinder_bricks);
    }
  if (s.kind === "bastion") {
    for (const x of [-10, 10])
      for (const z of [-10, 10])
        for (let dy = 1; dy <= 9; dy++)
          for (let dx = -1; dx <= 1; dx++)
            for (let dz = -1; dz <= 1; dz++)
              if (Math.abs(dx) === 1 || Math.abs(dz) === 1 || dy === 9)
                set(x + dx, dy, z + dz, dy === 9 ? B.basalt : B.cinder_bricks);
    for (let x = -3; x <= 3; x++)
      for (let z = -4; z <= 1; z++) {
        set(x, 1, z, B.basalt);
        if (Math.abs(x) === 3 || z === -4)
          for (let y = 2; y <= 5; y++) set(x, y, z, B.cinder_bricks);
      }
  } else if (s.kind === "shrine") {
    for (let i = 0; i < 8; i++) {
      const x = Math.round(Math.cos((i * Math.PI) / 4) * 7),
        z = Math.round(Math.sin((i * Math.PI) / 4) * 7);
      for (let y = 1; y <= 6; y++) set(x, y, z, B.basalt);
      set(x, 7, z, B.glow_crystal);
    }
    for (let y = 1; y <= 3; y++)
      for (let x = -3 + y; x <= 3 - y; x++)
        for (let z = -3 + y; z <= 3 - y; z++) set(x, y, z, B.runestone);
    set(0, 4, 0, B.glow_crystal);
  } else {
    for (let x = -5; x <= 5; x++)
      for (let z = -5; z <= 5; z++) {
        if (
          (Math.abs(x) === 5 || Math.abs(z) === 5) &&
          !(z === 5 && Math.abs(x) < 2)
        )
          for (let y = 1; y <= 4; y++) set(x, y, z, B.cinder_bricks);
        if (x < 0 || z < 0) set(x, 5, z, B.basalt);
      }
    set(-3, 1, -3, B.furnace);
    set(3, 1, -3, B.crafting_table);
  }
  for (const x of [-r + 2, r - 2]) {
    set(x, 1, r - 2, B.basalt);
    set(x, 2, r - 2, B.torch);
  }
  const lx = s.kind === "bastion" ? 0 : 3,
    lz = s.kind === "bastion" ? -2 : 0,
    ly = s.kind === "bastion" ? 2 : 1,
    key = `${s.x + lx},${s.y + ly},${s.z + lz}`;
  set(lx, ly, lz, B.chest);
  if (
    Math.floor((s.x + lx) / 16) === chunk.cx &&
    Math.floor((s.z + lz) / 16) === chunk.cz &&
    !world.containers[key] &&
    !world.edits.has(key)
  ) {
    const slots = Array(27).fill(null);
    const loot =
      s.kind === "bastion"
        ? [
            ["hellfire_ingot", 3],
            ["brimstone", 3],
            ["cooked_meat", 5],
            ["emerald", 4],
          ]
        : s.kind === "shrine"
          ? [
              ["brimstone", 4],
              ["raw_hellfire", 2],
              ["lapis_lazuli", 6],
              ["glow_crystal", 3],
            ]
          : [
              ["bread", 5],
              ["charcoal", 6],
              ["iron_ingot", 3],
              ["brimstone", 2],
            ];
    loot.forEach(([id, count], i) => (slots[i] = makeStack(id, count)));
    world.containers[key] = { type: "chest", slots };
  }
}
