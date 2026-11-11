import { noise2, fractal } from "./random.js";
import { SEA } from "./data.js";
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (v) => {
  v = clamp(v);
  return v * v * (3 - 2 * v);
};

// Generator 14 uses a continuous land field rather than isolated regional discs.
// Climate is independent of coasts, so adjacent biomes share the same landmass.
export function connectedLand(x, z, seed) {
  const warpX = (noise2(x / 510, z / 510, seed + 1903) - 0.5) * 115;
  const warpZ = (noise2(x / 510, z / 510, seed + 1904) - 0.5) * 115;
  const value =
    fractal((x + warpX) / 850, (z + warpZ) / 850, seed + 1907) * 0.78 +
    noise2(x / 240, z / 240, seed + 1981) * 0.22;
  // A small, blended starting shore avoids seeds whose origin is open ocean.
  return Math.max(value, 0.58 - Math.hypot(x, z) / 1100);
}
export function connectedTerrain(x, z, seed) {
  const field = connectedLand(x, z, seed);
  const coast = smooth((field - 0.33) / 0.14);
  const relief = fractal(x / 270, z / 270, seed + 71);
  const ridge = 1 - Math.abs(noise2(x / 185, z / 185, seed + 623) * 2 - 1);
  const mountains = Math.max(0, relief - 0.48) ** 2 * 900 * ridge;
  const floor = 29 + noise2(x / 300, z / 300, seed + 111) * 19;
  let h = floor * (1 - coast) + (74 + relief * 26 + mountains) * coast;
  h += (noise2(x / 37, z / 37, seed + 13) - 0.5) * 5 * coast;
  const river = Math.abs(noise2(x / 350, z / 350, seed + 999) - 0.5);
  const valley = smooth(1 - river / 0.027) * coast;
  h = h * (1 - valley) + (SEA - 2) * valley;
  const lake =
    smooth((noise2(x / 140, z / 140, seed + 1013) - 0.85) / 0.1) * coast;
  h = h * (1 - lake) + Math.min(h, SEA - 2) * lake;
  h = Math.floor(clamp(h, 24, 220));
  const temp = noise2(x / 650, z / 650, seed + 41);
  const wet = noise2(x / 580, z / 580, seed + 93);
  const variant = noise2(x / 430, z / 430, seed + 1941);
  const biome =
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
  return { h, biome, river, land: coast, shore: (field - 0.4) * 1000 };
}
export function connectedCinderBase(x, z, seed) {
  const field = connectedLand(x, z, seed);
  const coast = smooth((field - 0.33) / 0.14);
  const heat = noise2(x / 620, z / 620, seed + 301);
  const ridge = 1 - Math.abs(noise2(x / 190, z / 190, seed + 73) * 2 - 1);
  const fault = Math.abs(noise2(x / 330, z / 330, seed + 277) - 0.5);
  let h =
    (43 + noise2(x / 270, z / 270, seed) * 14) * (1 - coast) +
    (86 + fractal(x / 280, z / 280, seed) * 39 + ridge ** 9 * 48) * coast;
  if (fault < 0.03) h -= (1 - fault / 0.03) * 36 * coast;
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
    h: Math.floor(clamp(h, 34, 225)),
    biome,
    river: fault,
    land: coast,
    shore: (field - 0.4) * 1000,
  };
}
