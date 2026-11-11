import { generateEdition } from "./edition-generation.js";
// Generator 11 is additive: the older volcanic generator remains untouched.
import { B, MIN_Y, MAX_Y, makeStack } from "./data.js";
import { hash, noise2, noise3, fractal } from "./random.js";
import { cinderCaveVoid } from "./wild-caves.js";
import { connectedCinderBase } from "./connected-terrain.js";
import { expeditionCinderBase } from "./expedition-terrain.js";
import {
  siteOffset,
  generateExpeditionStructure,
} from "./expedition-structures.js";
export const infernalSpacing = (world) =>
  world.generationVersion >= 13 ? 1536 : 384;

export const INFERNAL_KINDS = {
  citadel: { name: "Citadel of the Damned", radius: 30, height: 54 },
  cathedral: { name: "Cathedral of Souls", radius: 30, height: 64 },
  foundry: { name: "Hellfire Crucible", radius: 26, height: 44 },
};
export function infernalBase(x, z, seed) {
  const heat = noise2(x / 310, z / 310, seed + 301);
  const ridge = 1 - Math.abs(noise2(x / 105, z / 105, seed + 73) * 2 - 1);
  const fault = Math.abs(noise2(x / 190, z / 190, seed + 277) - 0.5);
  const biome =
    heat < 0.28
      ? "soul_vale"
      : heat > 0.72
        ? "bloodlands"
        : heat < 0.4
          ? "ash_wastes"
          : heat > 0.6
            ? "sulfur_basin"
            : ridge > 0.78
              ? "basalt_ridges"
              : "emberwood";
  let h = 77 + fractal(x / 180, z / 180, seed) * 52 + ridge ** 7 * 65;
  if (fault < 0.095) h -= (1 - fault / 0.095) ** 0.65 * 72;
  if (biome === "bloodlands") h += Math.sin(x / 23) * Math.sin(z / 23) * 9;
  return { h: Math.floor(h), biome, river: fault, land: heat };
}
export function infernalSite(world, rx, rz) {
  if (world.dimension !== "cinderwild") return null;
  world.cinderPlans ||= new Map();
  const key = `${rx},${rz}`;
  if (world.cinderPlans.has(key)) return world.cinderPlans.get(key);
  const modern = world.generationVersion >= 13,
    spacing = infernalSpacing(world);
  const x =
    rx * spacing +
    (modern ? 512 : 144) +
    Math.floor(hash(rx, rz, 1, world.seedInt + 51) * (modern ? 512 : 96));
  const z =
    rz * spacing +
    (modern ? 512 : 144) +
    Math.floor(hash(rz, rx, 1, world.seedInt + 852) * (modern ? 512 : 96));
  // A rock island foundation makes every site accessible even across lava seas.
  const y = Math.max(
    82,
    Math.min(
      150,
      (world.generationVersion >= 14
        ? connectedCinderBase
        : modern
          ? expeditionCinderBase
          : infernalBase)(x, z, world.seedInt).h,
    ),
  );
  const kind =
    Object.keys(INFERNAL_KINDS)[
      Math.floor(hash(rx, rz, 17, world.seedInt) * 3)
    ];
  const result = {
    id: `infernal:${key}`,
    x,
    y,
    z,
    kind,
    ...INFERNAL_KINDS[kind],
    ...(modern
      ? {
          rotation: Math.floor(hash(rx, 20, rz, world.seedInt) * 4),
          variant: Math.floor(hash(rx, 21, rz, world.seedInt) * 65536),
          palette: hash(rx, 22, rz, world.seedInt) > 0.5,
          height:
            INFERNAL_KINDS[kind].height +
            Math.floor(hash(rx, 23, rz, world.seedInt) * 12),
          radius: 28 + Math.floor(hash(rx, 24, rz, world.seedInt) * 6),
        }
      : {}),
  };
  if (world.cinderPlans.size > 512) world.cinderPlans.clear();
  world.cinderPlans.set(key, result);
  return result;
}
export function nearbyInfernalSites(world, x, z, radius = 48) {
  const found = [],
    spacing = infernalSpacing(world);
  for (
    let rz = Math.floor((z - radius - 48) / spacing);
    rz <= Math.floor((z + radius + 48) / spacing);
    rz++
  )
    for (
      let rx = Math.floor((x - radius - 48) / spacing);
      rx <= Math.floor((x + radius + 48) / spacing);
      rx++
    ) {
      const site = infernalSite(world, rx, rz);
      if (Math.hypot(site.x - x, site.z - z) <= radius + 48) found.push(site);
    }
  return found;
}
export function infernalTerrain(world, x, z) {
  const t = (
    world.generationVersion >= 14
      ? connectedCinderBase
      : world.generationVersion >= 13
        ? expeditionCinderBase
        : infernalBase
  )(x, z, world.seedInt);
  for (const s of nearbyInfernalSites(world, x, z, 0)) {
    const d = Math.max(Math.abs(x - s.x), Math.abs(z - s.z));
    if (d <= s.radius + 2) return { ...t, h: s.y, structure: s.id };
    if (d < s.radius + 12)
      t.h = Math.round(s.y + ((t.h - s.y) * (d - s.radius - 2)) / 10);
  }
  return t;
}
export function infernalGuards(site) {
  const guards = [
    [-17, 15, "dread_knight"],
    [17, 15, "magma_maw"],
    [-16, -4, "soul_reaver"],
    [16, -4, "dread_knight"],
    [0, 4, "magma_maw"],
    [0, -4, "soul_reaver"],
  ];
  return guards.map(([x, z, type]) => [...siteOffset(site, x, z), type]);
}
export function infernalLoot(site) {
  const gear = makeStack(
    site.kind === "foundry"
      ? "hellfire_pickaxe"
      : site.kind === "cathedral"
        ? "hellfire_chestplate"
        : "hellfire_sword",
  );
  gear.enchantments =
    site.kind === "cathedral"
      ? { protection: 3, unbreaking: 3 }
      : site.kind === "foundry"
        ? { efficiency: 4, unbreaking: 3 }
        : { sharpness: 4, unbreaking: 3 };
  return [
    makeStack("cinder_sigil"),
    gear,
    makeStack("hellfire_alloy", 6),
    makeStack("diamond", 4),
    makeStack("brimstone", 8),
    makeStack("cooked_meat", 12),
    makeStack("lapis_lazuli", 12),
  ];
}
export function generateInfernalWorld(world, chunk) {
  const { cx, cz, data, key } = chunk,
    seed = world.seedInt;
  const put = (x, y, z, id) => {
    if (x < 0 || x >= 16 || z < 0 || z >= 16 || y < MIN_Y || y > MAX_Y) return;
    data[(y - MIN_Y) * 256 + z * 16 + x] = id;
    if (id !== B.air) chunk.maxY = Math.max(chunk.maxY, y);
    if (id === B.glow_crystal || id === B.torch)
      world.generatedLights.add(`${cx * 16 + x},${y},${cz * 16 + z}`);
  };
  const surface = {
    ash_wastes: B.ash,
    soul_vale: B.ash,
    basalt_ridges: B.basalt,
  };
  for (let z = 0; z < 16; z++)
    for (let x = 0; x < 16; x++) {
      const wx = cx * 16 + x,
        wz = cz * 16 + z,
        t = world.terrain(wx, wz);
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
                ? surface[t.biome] || B.cinderstone
                : B.cinderstone;
        if (
          !t.structure &&
          y > 8 &&
          y < t.h - 8 &&
          (world.generationVersion >= 14
            ? cinderCaveVoid(wx, y, wz, seed)
            : noise3(wx / 42, y / 28, wz / 42, seed + 42) > 0.6)
        )
          id = y < 22 ? B.lava : B.air;
        if (id === B.cinderstone && y >= 15 && y <= 70) {
          const gx = Math.floor(wx / 12),
            gy = Math.floor(y / 12),
            gz = Math.floor(wz / 12);
          const center = [
            gx * 12 + 3 + Math.floor(hash(gx, gy, gz, seed + 925) * 6),
            gy * 12 + 3 + Math.floor(hash(gx, gy, gz, seed + 926) * 6),
            gz * 12 + 3 + Math.floor(hash(gx, gy, gz, seed + 927) * 6),
          ];
          if (
            Math.abs(wx - center[0]) +
              Math.abs(y - center[1]) +
              Math.abs(wz - center[2]) <=
            2
          ) {
            const r = hash(gx, gy, gz, seed + 924);
            id = r < 0.22 ? B.hellfire_ore : r < 0.56 ? B.brimstone_ore : id;
          }
        }
        put(x, y, z, id);
      }
      if (t.h > 70 && !t.structure && hash(wx, 1, wz, seed + 22) < 0.012)
        put(x, t.h + 1, z, B.glow_crystal);
    }
  // Evaluate anchors outside chunk boundaries so decorations do not depend on load order.
  for (let z = -3; z < 19; z++)
    for (let x = -3; x < 19; x++) {
      const wx = cx * 16 + x,
        wz = cz * 16 + z,
        t = world.terrain(wx, wz);
      if (t.structure || t.h <= 72) continue;
      const r = hash(wx, 2, wz, seed + 17);
      if (t.biome === "emberwood" && r < 0.01) {
        const height = 7 + Math.floor(hash(wx, 3, wz, seed) * 7);
        for (let dy = 1; dy <= height; dy++) put(x, t.h + dy, z, B.ashen_log);
        for (let side of [-1, 1])
          for (let i = 1; i <= 3; i++) {
            put(x + side * i, t.h + height - 3 + i, z, B.ashen_log);
            put(x + side * i, t.h + height - 2 + i, z, B.ember_leaves);
          }
        put(x, t.h + height + 1, z, B.glow_crystal);
      } else if (
        ["basalt_ridges", "bloodlands", "soul_vale"].includes(t.biome) &&
        r < 0.014
      ) {
        const height = 9 + Math.floor(hash(wx, 4, wz, seed) * 15);
        for (let dy = 1; dy <= height; dy++) {
          const width = dy < height / 3 ? 1 : 0;
          for (let dz = -width; dz <= width; dz++)
            for (let dx = -width; dx <= width; dx++)
              put(x + dx, t.h + dy, z + dz, B.basalt);
        }
        put(
          x,
          t.h + height + 1,
          z,
          t.biome === "soul_vale" ? B.glow_crystal : B.emberglass,
        );
      }
    }
  for (const s of nearbyInfernalSites(world, cx * 16 + 8, cz * 16 + 8, 16))
    (world.generationVersion >= 13
      ? generateExpeditionStructure
      : generateInfernalStructure)(world, chunk, put, s);
  if (world.generationVersion >= 15)
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const wx = cx * 16 + x,
          wz = cz * 16 + z,
          t = world.terrain(wx, wz);
        if (
          !t.structure &&
          t.h > 70 &&
          !nearbyInfernalSites(world, wx, wz, 80).length &&
          hash(Math.floor(wx / 4), 754, Math.floor(wz / 4), seed) < 0.04
        ) {
          put(x, t.h, z, B.soul_sand);
          put(x, t.h + 1, z, B.nether_wart_3);
        }
      }
  generateEdition(world, chunk, put);
  for (const [x, y, z, id] of world.editChunks.get(key) || [])
    put(x - cx * 16, y, z - cz * 16, id);
  world.dirty.add(key);
  return chunk;
}
function generateInfernalStructure(world, chunk, put, s) {
  const set = (x, y, z, id) =>
    put(s.x + x - chunk.cx * 16, s.y + y, s.z + z - chunk.cz * 16, id);
  for (let lz = 0; lz < 16; lz++)
    for (let lx = 0; lx < 16; lx++) {
      const x = chunk.cx * 16 + lx - s.x,
        z = chunk.cz * 16 + lz - s.z;
      if (Math.abs(x) > s.radius || Math.abs(z) > s.radius) continue;
      const edge = Math.max(Math.abs(x), Math.abs(z));
      for (let y = -3; y <= s.height + 2; y++)
        set(x, y, z, y <= 0 ? B.cinder_bricks : B.air);
      set(x, 0, z, x % 6 === 0 || z % 6 === 0 ? B.basalt : B.cinder_bricks);
      if (edge === s.radius && !(z === s.radius && Math.abs(x) <= 3)) {
        for (let y = 1; y <= 13; y++)
          set(x, y, z, y % 5 === 0 ? B.basalt : B.cinder_bricks);
        if ((x + z) % 3 === 0) set(x, 14, z, B.basalt);
      }
      // Buttresses and soaring pointed roof ribs leave a walkable central nave.
      if (
        (Math.abs(x) === 21 || Math.abs(x) === 22) &&
        z % 8 >= -1 &&
        z % 8 <= 1
      )
        for (let y = 1; y <= 28; y++) set(x, y, z, B.basalt);
      if (Math.abs(x) <= 22 && Math.abs(z) <= 23 && z % 8 === 0) {
        const roofY = 37 - Math.floor(Math.abs(x) * 0.55);
        set(x, roofY, z, x % 5 === 0 ? B.glow_crystal : B.cinder_bricks);
        set(x, roofY + 1, z, B.basalt);
      }
      // Four enormous hollow towers; ground-level arches let entities pass.
      for (const tx of [-s.radius + 4, s.radius - 4])
        for (const tz of [-s.radius + 4, s.radius - 4]) {
          const d = Math.max(Math.abs(x - tx), Math.abs(z - tz));
          if (d > 3) continue;
          if (d === 3)
            for (let y = 1; y < s.height - 6; y++)
              if (y > 4 || Math.abs(x - tx) > 1)
                set(x, y, z, y % 7 === 0 ? B.basalt : B.cinder_bricks);
          const crown = s.height - 6 + Math.max(0, 3 - d);
          set(x, crown, z, d ? B.basalt : B.glow_crystal);
          if (d === 0)
            for (let y = crown + 1; y <= s.height; y++)
              set(x, y, z, y === s.height ? B.glow_crystal : B.basalt);
        }
      // Lava channels beside the entrance; a seven-block-wide bridge stays safe.
      if (Math.abs(x) >= 5 && Math.abs(x) <= 12 && z >= 11 && z <= 20) {
        set(x, 0, z, B.lava);
        set(x, -1, z, B.basalt);
      }
      // Sealed vault at the far end of the nave.
      if (Math.abs(x) <= 7 && z >= -21 && z <= -8) {
        if (Math.abs(x) === 7 || z === -21 || z === -8)
          for (let y = 1; y <= 8; y++) set(x, y, z, B.basalt);
        set(x, 9, z, B.cinder_bricks);
        if (z === -8 && Math.abs(x) <= 1)
          for (let y = 1; y <= 4; y++) set(x, y, z, B.infernal_seal);
      }
      if (Math.abs(x) === 18 && z % 8 === 4) {
        set(x, 1, z, B.basalt);
        set(x, 2, z, B.glow_crystal);
      }
    }
  const x = s.x,
    y = s.y + 1,
    z = s.z - 15,
    key = `${x},${y},${z}`;
  set(0, 1, -15, B.chest);
  if (
    Math.floor(x / 16) === chunk.cx &&
    Math.floor(z / 16) === chunk.cz &&
    !world.containers[key] &&
    !world.edits.has(key)
  ) {
    const slots = Array(27).fill(null);
    infernalLoot(s).forEach((stack, i) => (slots[i] = stack));
    world.containers[key] = {
      type: "chest",
      slots,
      encounter: s.id,
      guarded: 6,
    };
  }
}
