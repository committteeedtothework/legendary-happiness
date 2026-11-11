import { B, MIN_Y, MAX_Y } from "./data.js";
import { hash, noise2 } from "./random.js";

export const PALM_RADIUS = 88;
const FINGERS = [
  [-23, 2, -45, -16, 6, 29],
  [-18, -17, -31, -53, 6, 41],
  [-4, -23, -5, -66, 7, 54],
  [10, -21, 21, -57, 6, 44],
  [23, -11, 39, -42, 5, 31],
];
export function palmLocal(site, x, z) {
  const a = site.angle || 0,
    c = Math.cos(a),
    s = Math.sin(a),
    dx = x - site.x,
    dz = z - site.z;
  return [dx * c + dz * s, -dx * s + dz * c];
}
export function palmContains(site, p, padding = 0) {
  if (!site || site.phase !== "active") return false;
  return (
    Math.hypot(p.x - site.x, p.z - site.z) < 70 + padding &&
    p.y > site.y - 24 &&
    p.y < site.y + 72
  );
}
export function palmColumn(site, x, z, baseHeight, seed = 0) {
  if (Math.abs(x - site.x) > PALM_RADIUS || Math.abs(z - site.z) > PALM_RADIUS)
    return null;
  const [u, v] = palmLocal(site, x, z),
    edge = (noise2(x / 8, z / 8, seed + 509) - 0.5) * 0.13;
  const r = Math.sqrt((u / 34) ** 2 + (v / 30) ** 2),
    wrist = Math.abs(u) < 13 && v > 15 && v < 43;
  let h = null,
    rock = false;
  if (r < 1 + edge || wrist) {
    const depth =
      Math.max(0, 1 - r) * 9 + Math.max(0, 1 - Math.hypot(u, v) / 13) * 5;
    const blend = Math.min(1, Math.max(0, (1.08 - r) * 5));
    h = Math.round(baseHeight * (1 - blend) + (site.y - depth) * blend);
  }
  for (const [ax, az, bx, bz, width, height] of FINGERS) {
    const dx = bx - ax,
      dz = bz - az,
      t = Math.max(
        0,
        Math.min(1, ((u - ax) * dx + (v - az) * dz) / (dx * dx + dz * dz)),
      );
    const d = Math.hypot(u - ax - t * dx, v - az - t * dz),
      radius =
        width * (1 - 0.5 * t) + (noise2(x / 4, z / 4, seed + 775) - 0.5) * 2;
    if (d < radius) {
      const top =
        site.y +
        Math.floor(
          5 +
            height * Math.sin(t * Math.PI * 0.55) +
            (1 - d / radius) * 8 +
            hash(x, 1, z, seed) * 4,
        );
      h = Math.max(h ?? baseHeight, top);
      rock = true;
    }
  }
  return h === null ? null : { h, rock, u, v };
}
export function nearbyPalmSites(world, x, z) {
  const state = world.palm;
  if (!state) return [];
  if (
    world.palmIndexState !== state ||
    world.palmIndexRevision !== state.revision
  ) {
    world.palmIndex = new Map();
    world.palmIndexState = state;
    world.palmIndexRevision = state.revision;
    for (const site of state.sites || [])
      for (
        let cz = Math.floor((site.z - PALM_RADIUS) / 256);
        cz <= Math.floor((site.z + PALM_RADIUS) / 256);
        cz++
      )
        for (
          let cx = Math.floor((site.x - PALM_RADIUS) / 256);
          cx <= Math.floor((site.x + PALM_RADIUS) / 256);
          cx++
        ) {
          const key = cx + "," + cz;
          if (!world.palmIndex.has(key)) world.palmIndex.set(key, []);
          world.palmIndex.get(key).push(site);
        }
  }
  return (
    world.palmIndex.get(Math.floor(x / 256) + "," + Math.floor(z / 256)) || []
  );
}
export function generatePalm(world, chunk, put) {
  if (world.dimension !== "overworld") return;
  for (const site of nearbyPalmSites(
    world,
    chunk.cx * 16 + 8,
    chunk.cz * 16 + 8,
  )) {
    if (
      Math.abs(chunk.cx * 16 + 8 - site.x) > PALM_RADIUS + 8 ||
      Math.abs(chunk.cz * 16 + 8 - site.z) > PALM_RADIUS + 8
    )
      continue;
    const emit = (x, y, z, id) => {
      if (y > MIN_Y && y <= MAX_Y)
        put(x - chunk.cx * 16, y, z - chunk.cz * 16, id);
    };
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const wx = chunk.cx * 16 + x,
          wz = chunk.cz * 16 + z,
          t = world.terrain(wx, wz),
          col = palmColumn(site, wx, wz, t.h, world.seedInt);
        if (!col) continue;
        const low = Math.max(MIN_Y + 1, Math.min(t.h - 4, site.y - 17)),
          high = Math.min(MAX_Y, Math.max(t.h + 15, col.h + 1));
        for (let y = low; y <= high; y++) {
          let id = B.air;
          if (y <= col.h) {
            const n = hash(wx, y, wz, world.seedInt + 771);
            id = col.rock
              ? y % 9 < 2
                ? B.terracotta
                : n < 0.13
                  ? B.cracked_stone_bricks
                  : B.sandstone
              : y === col.h
                ? n < 0.2
                  ? B.gravel
                  : n < 0.43
                    ? B.terracotta
                    : B.red_sand
                : B.sandstone;
          }
          emit(wx, y, wz, id);
        }
        if (!col.rock && hash(wx, 3, wz, site.seed) < 0.012) {
          // Sun-bleached voxel ribs and a broken spine, made of normal mineable blocks.
          emit(wx, col.h + 1, wz, B.diorite);
          if (hash(wx, 5, wz, site.seed) < 0.45) {
            emit(wx, col.h + 1, wz + 1, B.diorite);
            emit(wx + 1, col.h + 1, wz + 1, B.diorite);
          } else emit(wx, col.h + 2, wz, B.ashen_log);
        }
      }
    // A collapsed circular shrine around the buried crater, with an open approach.
    for (let dz = -12; dz <= 12; dz++)
      for (let dx = -12; dx <= 12; dx++) {
        const d = Math.hypot(dx, dz),
          x = site.x + dx,
          z = site.z + dz;
        if (d > 10 && d < 12 && dz < 6)
          for (let h = 0; h < (hash(x, 6, z, site.seed) > 0.5 ? 4 : 2); h++)
            emit(
              x,
              site.y - 7 + h,
              z,
              h ? B.cracked_stone_bricks : B.sandstone,
            );
      }
    // Partly buried chamber: solid roof, navigable interior, stairwell and real chest.
    const cx = site.x + 16,
      cz = site.z + 8,
      cy = site.y - 14;
    for (let dz = -4; dz <= 4; dz++)
      for (let dx = -4; dx <= 4; dx++)
        for (let dy = 0; dy <= 5; dy++) {
          const wall =
            Math.abs(dx) === 4 || Math.abs(dz) === 4 || dy === 0 || dy === 5;
          emit(
            cx + dx,
            cy + dy,
            cz + dz,
            wall ? B.cracked_stone_bricks : B.air,
          );
        }
    for (let i = 0; i < 9; i++)
      for (let a = -1; a <= 1; a++) {
        const x = cx + a,
          z = cz + 4 + i,
          y = cy + i;
        emit(x, y, z, B.sandstone);
        for (let d = 1; d <= 3; d++) emit(x, y + d, z, B.air);
      }
    emit(cx, cy + 1, cz, B.chest);
    if (
      cx >= chunk.cx * 16 &&
      cx < chunk.cx * 16 + 16 &&
      cz >= chunk.cz * 16 &&
      cz < chunk.cz * 16 + 16
    ) {
      const key = `${cx},${cy + 1},${cz}`;
      if (!site.chamberInitialized) {
        site.chamberInitialized = true;
        world.containers[key] ||= {
          type: "chest",
          slots: Array.from({ length: 27 }, (_, i) =>
            i === 0
              ? { id: "palm_tablet", count: 1 }
              : i === 1
                ? { id: "gold_ingot", count: 2 }
                : null,
          ),
          palmSite: site.id,
        };
      }
    }
  }
}
export function invalidatePalm(world, sites) {
  world.skyCache?.clear();
  world.caveLightCache?.clear();
  for (const site of sites)
    for (
      let cz = Math.floor((site.z - PALM_RADIUS) / 16) - 1;
      cz <= Math.floor((site.z + PALM_RADIUS) / 16) + 1;
      cz++
    )
      for (
        let cx = Math.floor((site.x - PALM_RADIUS) / 16) - 1;
        cx <= Math.floor((site.x + PALM_RADIUS) / 16) + 1;
        cx++
      ) {
        const key = `${cx},${cz}`;
        world.chunks.delete(key);
        world.dirty.add(key);
        world.revisions.set(key, (world.revisions.get(key) || 0) + 1);
      }
}
export function installPalm(world, state) {
  const before = world.palm;
  world.palm = state || null;
  if ((before?.revision || 0) !== (state?.revision || 0))
    invalidatePalm(world, [...(before?.sites || []), ...(state?.sites || [])]);
}
