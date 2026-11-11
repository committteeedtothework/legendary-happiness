export function hashSeed(value) {
  let h = 2166136261;
  for (const c of String(value)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function hash(x, y, z, seed = 0) {
  let h =
    Math.imul(x | 0, 374761393) ^
    Math.imul(y | 0, 668265263) ^
    Math.imul(z | 0, 2147483647) ^
    seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t),
  mix = (a, b, t) => a + (b - a) * t;
export function noise2(x, z, seed) {
  const ix = Math.floor(x),
    iz = Math.floor(z),
    u = fade(x - ix),
    v = fade(z - iz);
  return mix(
    mix(hash(ix, 0, iz, seed), hash(ix + 1, 0, iz, seed), u),
    mix(hash(ix, 0, iz + 1, seed), hash(ix + 1, 0, iz + 1, seed), u),
    v,
  );
}
export function noise3(x, y, z, seed) {
  const iy = Math.floor(y),
    t = fade(y - iy);
  const a = noise2(x, z, seed ^ Math.imul(iy, 73471)),
    b = noise2(x, z, seed ^ Math.imul(iy + 1, 73471));
  return mix(a, b, t);
}
export function fractal(x, z, seed) {
  return (
    noise2(x, z, seed) * 0.57 +
    noise2(x * 2, z * 2, seed + 1) * 0.28 +
    noise2(x * 4, z * 4, seed + 2) * 0.15
  );
}
