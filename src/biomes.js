import { oceanTerrain, OCEAN_BIOMES } from "./ocean-generation.js";
import { noise2, fractal, hash } from "./random.js";
import { B, SEA } from "./data.js";
import { connectedTerrain } from "./connected-terrain.js";
import { continentalTerrain } from "./expedition-terrain.js";
export const BIOMES = {
  jungle: {
    name: "Emerald Jungle",
    tree: "jungle",
    density: 0.03,
    tint: [0.72, 1.05, 0.76],
  },
  woodland: {
    name: "Oak Woodland",
    tree: "oak",
    density: 0.025,
    tint: [0.93, 1, 0.88],
  },
  meadow: {
    name: "Flower Meadow",
    tree: "oak",
    density: 0.002,
    tint: [1, 1.03, 0.91],
  },
  desert: { name: "Desert Dunes", density: 0, tint: [1.08, 0.95, 0.75] },
  alpine: { name: "Snowy Highlands", density: 0, tint: [0.88, 1, 1] },
  pine_forest: {
    name: "Pine Forest",
    tree: "pine",
    density: 0.024,
    tint: [0.85, 0.99, 0.98],
  },
  birch_woodland: {
    name: "Birch Woodland",
    tree: "birch",
    density: 0.021,
    tint: [1.02, 1.04, 0.85],
  },
  savanna: {
    name: "Savanna",
    tree: "savanna",
    density: 0.005,
    tint: [1.15, 1.03, 0.72],
  },
  badlands: { name: "Badlands", density: 0, tint: [1.12, 0.89, 0.72] },
  marsh: {
    name: "Marsh",
    tree: "oak",
    density: 0.009,
    tint: [0.82, 0.92, 0.76],
  },
  snowy_taiga: {
    name: "Snowy Taiga",
    tree: "pine",
    density: 0.014,
    tint: [0.83, 0.97, 1.02],
  },
  stony_peaks: { name: "Stony Peaks", density: 0, tint: [0.92, 0.99, 1] },
  ocean: { name: "Ocean", density: 0, tint: [0.88, 1, 0.98] },
};
for (const biome of OCEAN_BIOMES)
  if (!BIOMES[biome])
    BIOMES[biome] = {
      name: biome.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      density: 0,
      tint: [0.88, 1, 0.98],
    };
export function variedTerrain(x, z, s, version = 4) {
  if (version >= 15) return oceanTerrain(connectedTerrain(x, z, s), x, z, s);
  if (version >= 14) return connectedTerrain(x, z, s);
  if (version >= 13) return continentalTerrain(x, z, s);
  // Continental shapes, climate, erosion and ridges are smooth fields; a biome
  // boundary never directly changes elevation. This is original generation.
  const land = fractal(x / 350, z / 350, s),
    detail = fractal(x / 75, z / 75, s + 71),
    temp = noise2(x / 240, z / 240, s + 41),
    wet = noise2(x / 180, z / 180, s + 93),
    ridge = 1 - Math.abs(noise2(x / 145, z / 145, s + 623) * 2 - 1),
    erosion = noise2(x / 215, z / 215, s + 310),
    mountain = Math.max(0, detail - 0.49) * 2.3,
    river = Math.abs(noise2(x / 112, z / 112, s + 999) - 0.5);
  let h =
    45 + land * 47 + mountain * mountain * (28 + ridge * 48) * (0.35 + erosion);
  h += (noise2(x / 28, z / 28, s + 13) - 0.5) * 3;
  if (version >= 9) {
    const foothills = noise2(x / 190, z / 190, s + 9117);
    // Broad, smooth ridgelines add relief without introducing biome cliffs.
    h += Math.max(0, foothills - 0.48) ** 2 * 24 * (0.3 + erosion);
  }
  const valley = Math.max(0, 1 - river / 0.075);
  h = h * (1 - valley * 0.9) + (58 + river * 45) * valley * 0.9;
  const lake = noise2(x / 48, z / 48, s + 1013),
    wetland = Math.max(0, Math.min(1, (lake - 0.79) / 0.08));
  const depression = wetland * wetland * (3 - 2 * wetland);
  h = h * (1 - depression) + Math.min(h, 59) * depression;
  h = Math.max(40, Math.min(184, Math.floor(h)));
  let biome =
    h < SEA - 2
      ? "ocean"
      : h > 111
        ? temp < 0.4
          ? "alpine"
          : "stony_peaks"
        : temp < 0.27
          ? wet > 0.43
            ? "snowy_taiga"
            : "alpine"
          : temp < 0.4 && wet > 0.42
            ? "pine_forest"
            : temp > 0.67
              ? wet < 0.45
                ? "badlands"
                : "desert"
              : temp > 0.57 && wet < 0.49
                ? "savanna"
                : wet > 0.7 && h < 77
                  ? "marsh"
                  : wet > 0.58
                    ? "woodland"
                    : wet > 0.47
                      ? "birch_woodland"
                      : "meadow";
  if (
    version >= 7 &&
    h > SEA + 1 &&
    h < 105 &&
    temp > 0.44 &&
    temp < 0.68 &&
    wet > 0.6
  )
    biome = "jungle";
  return { h, biome, river, land };
}
export function surfaceBlock(t, y, s) {
  if (y > t.h) return t.biome === "snowy_taiga" && y === SEA ? B.ice : B.water;
  if (t.biome === "badlands")
    return y === t.h ? B.red_sand : y > t.h - 10 ? B.terracotta : B.stone;
  if (t.biome === "stony_peaks") return B.stone;
  if (["alpine", "snowy_taiga"].includes(t.biome) && y === t.h) return B.snow;
  if (t.biome === "marsh" && y === t.h) return B.moss;
  const sand = t.h <= SEA + 1 || t.biome === "desert" || t.biome === "ocean";
  return y === t.h
    ? sand
      ? B.sand
      : B.grass
    : y > t.h - 4
      ? sand
        ? B.sand
        : B.dirt
      : B.stone;
}
export function decorateTrees(world, chunk, put) {
  const { cx, cz } = chunk,
    s = world.seedInt;
  for (let az = -4; az < 20; az++)
    for (let ax = -4; ax < 20; ax++) {
      const x = cx * 16 + ax,
        z = cz * 16 + az,
        t = world.terrain(x, z),
        b = BIOMES[t.biome];
      if (
        !b?.tree ||
        t.village ||
        t.h <= SEA + 1 ||
        hash(x, 0, z, s + 291) > b.density
      )
        continue;
      const pine = b.tree === "pine",
        birch = b.tree === "birch",
        flat = b.tree === "savanna",
        h =
          (pine ? 7 : flat ? 4 : b.tree === "jungle" ? 10 : 5) +
          Math.floor(hash(x, 1, z, s) * 3),
        log = pine ? B.pine_log : birch ? B.birch_log : B.log,
        leaf = pine ? B.pine_leaves : birch ? B.birch_leaves : B.leaves;
      for (let dy = 1; dy <= h; dy++) put(ax, t.h + dy, az, log);
      for (let dy = pine ? 3 : flat ? h - 1 : h - 2; dy <= h + 1; dy++) {
        const radius = pine
          ? Math.min(3, Math.floor((h + 2 - dy) / 2))
          : flat || b.tree === "jungle"
            ? 3
            : 2;
        for (let dz = -radius; dz <= radius; dz++)
          for (let dx = -radius; dx <= radius; dx++) {
            if (
              (!pine && Math.abs(dx) + Math.abs(dz) > radius + 1) ||
              (dx === 0 && dz === 0 && dy <= h)
            )
              continue;
            // Pure anchor/shape evaluation and clipped writes preserve chunk order.
            const lx = ax + dx,
              lz = az + dz;
            if (
              lx >= 0 &&
              lx < 16 &&
              lz >= 0 &&
              lz < 16 &&
              chunk.data[(t.h + dy + 64) * 256 + lz * 16 + lx] !== B.air
            )
              continue;
            put(lx, t.h + dy, lz, leaf);
          }
      }
    }
}
