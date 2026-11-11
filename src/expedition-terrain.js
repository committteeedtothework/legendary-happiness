import { noise2, fractal, hash } from "./random.js";
import { SEA } from "./data.js";

export const CONTINENT_SPACING = 4096;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
const plans = new Map();
export function continentAt(seed, rx, rz) {
  const key = `${seed}:${rx},${rz}`;
  if (plans.has(key)) return plans.get(key);
  const plan = {
    x: rx * CONTINENT_SPACING + (hash(rx, 7, rz, seed) - 0.5) * 512,
    z: rz * CONTINENT_SPACING + (hash(rx, 8, rz, seed) - 0.5) * 512,
    radius:
      rx === 0 && rz === 0
        ? 1280 + hash(rx, 9, rz, seed) * 110
        : 960 + hash(rx, 9, rz, seed) * 430,
    empty: (rx !== 0 || rz !== 0) && hash(rx, 10, rz, seed) < 0.12,
    phase: hash(rx, 11, rz, seed) * Math.PI * 2,
    aspect: 0.8 + hash(rx, 12, rz, seed) * 0.2,
  };
  if (plans.size >= 2048) plans.clear();
  plans.set(key, plan);
  return plan;
}
// Bounded islands have an ocean corridor even between their longest coasts.
// All fields are pure and continuous; chunks and horizon meshes share them.
export function continentality(x, z, seed) {
  const rx = Math.round(x / CONTINENT_SPACING),
    rz = Math.round(z / CONTINENT_SPACING);
  let shore = -5000;
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const c = continentAt(seed, rx + dx, rz + dz);
      if (!c.empty) {
        const dx = x - c.x,
          dz = (z - c.z) / c.aspect;
        const a = Math.atan2(dz, dx);
        const radius =
          c.radius *
          (0.85 +
            0.15 * Math.cos(a * 3 + c.phase) * Math.sin(a + c.phase * 0.7));
        shore = Math.max(shore, radius - Math.hypot(dx, dz));
      }
    }
  return shore + (noise2(x / 280, z / 280, seed + 1907) - 0.5) * 180;
}
export function continentalTerrain(x, z, seed) {
  const shore = continentality(x, z, seed);
  const coast = smooth((shore + 90) / 240);
  const relief = fractal(x / 420, z / 420, seed + 71);
  const erosion = noise2(x / 690, z / 690, seed + 310);
  const ridge = 1 - Math.abs(noise2(x / 250, z / 250, seed + 623) * 2 - 1);
  const floor = 27 + noise2(x / 510, z / 510, seed + 111) * 18;
  const mountains = Math.max(0, relief - 0.5) ** 2 * 850 * ridge;
  let h =
    floor * (1 - coast) + (72 + relief * 32 + mountains * erosion) * coast;
  h += (noise2(x / 36, z / 36, seed + 13) - 0.5) * 4 * coast;
  const river = Math.abs(noise2(x / 410, z / 410, seed + 999) - 0.5);
  const valley = smooth(1 - river / 0.035) * coast;
  h = h * (1 - valley) + (SEA - 2) * valley;
  const lake =
    smooth((noise2(x / 170, z / 170, seed + 1013) - 0.84) / 0.1) * coast;
  h = h * (1 - lake) + Math.min(h, SEA - 2) * lake;
  h = Math.floor(clamp(h, 22, 220));
  const temp = noise2(x / 1100, z / 1100, seed + 41);
  const wet = noise2(x / 880, z / 880, seed + 93);
  const variant = noise2(x / 650, z / 650, seed + 1941);
  let biome =
    h < SEA - 2
      ? "ocean"
      : h > 132
        ? temp < 0.5
          ? "alpine"
          : "stony_peaks"
        : temp < 0.3
          ? wet > 0.43
            ? "snowy_taiga"
            : "alpine"
          : temp < 0.43
            ? wet > 0.4
              ? "pine_forest"
              : "meadow"
            : temp > 0.68
              ? wet < 0.44
                ? variant > 0.55
                  ? "badlands"
                  : "desert"
                : "savanna"
              : wet > 0.66
                ? temp > 0.48
                  ? "jungle"
                  : "woodland"
                : wet > 0.59 && h < 85
                  ? "marsh"
                  : wet > 0.51
                    ? variant > 0.5
                      ? "woodland"
                      : "birch_woodland"
                    : temp > 0.58 && wet < 0.42
                      ? "savanna"
                      : "meadow";
  return { h, biome, river, land: coast, shore };
}
export function expeditionCinderBase(x, z, seed) {
  const shore = continentality(x, z, seed);
  const coast = smooth((shore + 70) / 210);
  const heat = noise2(x / 1050, z / 1050, seed + 301);
  const ridge = 1 - Math.abs(noise2(x / 250, z / 250, seed + 73) * 2 - 1);
  const fault = Math.abs(noise2(x / 440, z / 440, seed + 277) - 0.5);
  let h =
    (39 + noise2(x / 380, z / 380, seed) * 16) * (1 - coast) +
    (87 + fractal(x / 410, z / 410, seed) * 43 + ridge ** 8 * 65) * coast;
  if (fault < 0.045) h -= (1 - fault / 0.045) * 42 * coast;
  const biome =
    heat < 0.23
      ? "soul_vale"
      : heat > 0.76
        ? "bloodlands"
        : heat < 0.4
          ? "ash_wastes"
          : heat > 0.61
            ? "sulfur_basin"
            : ridge > 0.8
              ? "basalt_ridges"
              : "emberwood";
  return {
    h: Math.floor(clamp(h, 30, 230)),
    biome,
    river: fault,
    land: coast,
    shore,
  };
}
