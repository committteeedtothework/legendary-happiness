import { B, BLOCKS, ITEMS, MIN_Y, MAX_Y } from "./data.js";

// World-space lighting belongs to loaded terrain, never the camera or a lamp
// budget. Derived arrays are rebuilt from saved blocks; no save-format change.
const brightBlocks = new Set([
  B.glow_crystal,
  B.emberglass,
  B.lava,
  B.fire,
  B.portal,
]);
export function emittedLight(id) {
  const b = BLOCKS[id];
  if (!b) return 0;
  if (b.light) return Math.min(15, b.light);
  if (id === B.torch) return 14;
  if (b.key === "glow_lichen") return 7;
  if (b.key === "firefly_bush") return 2;
  if (brightBlocks.has(id)) return id === B.portal ? 11 : 15;
  if (b.fluid?.type === "lava") return 15;
  return 0;
}
export function itemLight(id) {
  return (
    emittedLight(ITEMS[id]?.block) ||
    (/^(glow_ink_sac|glow_berries|blaze_rod)$/.test(id) ? 7 : 0)
  );
}
const emission = Uint8Array.from(BLOCKS, (_, id) => emittedLight(id));
const opaque = Uint8Array.from(BLOCKS, (b) =>
  b.solid && !b.transparent ? 1 : 0,
);
export function chunkLightSources(c) {
  if (c.lightSources) return c.lightSources;
  const list = [];
  for (let i = 0; i < c.data.length; i++) {
    const level = emission[c.data[i]];
    if (level)
      list.push([
        c.cx * 16 + (i % 16),
        MIN_Y + Math.floor(i / 256),
        c.cz * 16 + Math.floor((i % 256) / 16),
        level,
      ]);
  }
  c.lightSources = list;
  return list;
}
export function dirtyLightRegion(world, x, z) {
  const cx = Math.floor(x / 16),
    cz = Math.floor(z / 16);
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const k = `${cx + dx},${cz + dz}`;
      // An in-flight mesh can exist before its chunk is loaded on the main
      // thread. Its revision must still change so stale lighting is rejected.
      world.revisions.set(k, (world.revisions.get(k) || 0) + 1);
      if (world.chunks.has(k)) world.dirty.add(k);
    }
}
export function nearbyBlockLight(world, x, y, z) {
  const cx = Math.floor(x / 16),
    cz = Math.floor(z / 16);
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const chunk = world.chunks.get(`${cx + dx},${cz + dz}`);
      // A cache not yet built is not evidence that a chunk has no lamps.
      if (
        chunk &&
        chunkLightSources(chunk).some(
          (p) =>
            Math.abs(p[0] - x) + Math.abs(p[1] - y) + Math.abs(p[2] - z) <
            p[3] + 1,
        )
      )
        return true;
    }
  return (world.itemLightSources || []).some(
    (p) =>
      Math.abs(p[0] - x) + Math.abs(p[1] - y) + Math.abs(p[2] - z) < p[3] + 1,
  );
}
// The 15-block halo fits exactly in the existing worker's 3x3 chunk snapshot.
// Strongest-first flood: each air cell is visited at most once per level. Solid
// walls stop propagation; water loses two levels. Never calls ensure()/get().
const neighbors = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
export function buildBlockLight(world, chunk) {
  if (!world.chunks) return () => 0;
  const minX = chunk.cx * 16 - 15,
    minZ = chunk.cz * 16 - 15,
    width = 46,
    plane = width * width,
    height = MAX_Y - MIN_Y + 1,
    sources = [],
    chunks = Array(9);
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const c = world.chunks.get(`${chunk.cx + dx},${chunk.cz + dz}`);
      if (c) {
        chunks[(dz + 1) * 3 + dx + 1] = c;
        for (const p of chunkLightSources(c)) sources.push(p);
      }
    }
  for (const p of world.itemLightSources || [])
    if (
      p[0] >= minX &&
      p[0] < minX + width &&
      p[2] >= minZ &&
      p[2] < minZ + width
    )
      sources.push(p);
  if (!sources.length) return () => 0;
  const levels = new Uint8Array(plane * height),
    buckets = Array.from({ length: 16 }, () => []);
  const at = (x, y, z) => (y - MIN_Y) * plane + (z - minZ) * width + x - minX;
  function cell(x, y, z) {
    const c =
      chunks[
        (Math.floor(z / 16) - chunk.cz + 1) * 3 +
          Math.floor(x / 16) -
          chunk.cx +
          1
      ];
    return c
      ? c.data[(y - MIN_Y) * 256 + (z - c.cz * 16) * 16 + x - c.cx * 16]
      : -1;
  }
  for (const [x, y, z, l] of sources)
    if (
      x >= minX &&
      x < minX + width &&
      z >= minZ &&
      z < minZ + width &&
      y >= MIN_Y &&
      y <= MAX_Y
    ) {
      const i = at(x, y, z),
        n = Math.max(0, Math.min(15, l | 0));
      if (n > levels[i]) {
        levels[i] = n;
        buckets[n].push(i);
      }
    }
  for (let l = 15; l > 1; l--)
    for (const i of buckets[l]) {
      if (levels[i] !== l) continue;
      const y = Math.floor(i / plane) + MIN_Y,
        z = Math.floor((i % plane) / width) + minZ,
        x = (i % width) + minX;
      for (const [dx, dy, dz] of neighbors) {
        const nx = x + dx,
          ny = y + dy,
          nz = z + dz;
        if (
          nx < minX ||
          nx >= minX + width ||
          nz < minZ ||
          nz >= minZ + width ||
          ny < MIN_Y ||
          ny > MAX_Y
        )
          continue;
        const id = cell(nx, ny, nz);
        if (id < 0 || opaque[id]) continue;
        const next =
            l - (id === B.water || BLOCKS[id]?.fluid?.type === "water" ? 2 : 1),
          j = at(nx, ny, nz);
        if (next > levels[j]) {
          levels[j] = next;
          buckets[next].push(j);
        }
      }
    }
  return (x, y, z) =>
    x < minX ||
    x >= minX + width ||
    z < minZ ||
    z >= minZ + width ||
    y < MIN_Y ||
    y > MAX_Y
      ? 0
      : levels[at(x, y, z)];
}
// Add the baked light after the normal Lambert illumination. A light continues
// to illuminate at night, offscreen, and with Fancy/local point lights disabled.
export function injectBlockLight(shader) {
  shader.vertexShader =
    "attribute float blockLight; varying float dcsmBlockLight;\n" +
    shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n dcsmBlockLight=blockLight;",
    );
  shader.fragmentShader =
    "varying float dcsmBlockLight;\n" +
    shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0,0.79,0.53) * dcsmBlockLight;",
    );
}
