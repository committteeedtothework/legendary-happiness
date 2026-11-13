import { B, MIN_Y, MAX_Y, makeStack } from "./data.js";
import { hash, hashSeed, noise2 } from "./random.js";
const seedOf = (w) => hashSeed(w.seed);
export function strongholds(world) {
  const s = seedOf(world),
    start = hash(1, 8, 2, s) * Math.PI * 2;
  return Array.from({ length: 3 }, (_, i) => {
    const a = start + (i * Math.PI * 2) / 3,
      r = 1056 + Math.floor(hash(i, 2, 8, s) * 608);
    return {
      id: `stronghold:${i}`,
      x: Math.round(Math.cos(a) * r),
      y: 26,
      z: Math.round(Math.sin(a) * r),
    };
  });
}
export function nearestStronghold(world, p) {
  return strongholds(world).sort(
    (a, b) =>
      Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
  )[0];
}
export function portalFrames(site) {
  const out = [];
  for (let i = -1; i <= 1; i++)
    for (const [x, z] of [
      [i, -2],
      [i, 2],
      [-2, i],
      [2, i],
    ])
      out.push({ x: site.x + x, y: site.y + 1, z: site.z + z });
  return out;
}
export const END_PILLARS = Object.freeze(
  Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5;
    return {
      id: i,
      x: Math.round(Math.cos(a) * 43),
      z: Math.round(Math.sin(a) * 43),
      top: 78 + (i % 5) * 7,
      r: 2 + (i % 3 === 0 ? 1 : 0),
      caged: i === 2 || i === 7,
    };
  }),
);
export function endTerrain(world, x, z) {
  const s = seedOf(world),
    r = Math.hypot(x, z),
    edge = 80 + noise2(x / 27, z / 27, s) * 10;
  let h =
    r < edge
      ? Math.floor(
          57 + noise2(x / 23, z / 23, s + 14) * 9 - Math.max(0, r - 72) * 0.2,
        )
      : MIN_Y - 4;
  if (r < 20) h = 60;
  if (r > 700) {
    const gx = Math.round(x / 180),
      gz = Math.round(z / 180),
      cx = gx * 180 + (hash(gx, 5, gz, s) - 0.5) * 60,
      cz = gz * 180 + (hash(gx, 6, gz, s) - 0.5) * 60,
      d = Math.hypot(x - cx, z - cz);
    if (hash(gx, 7, gz, s) > 0.24 && d < 42 + hash(gx, 8, gz, s) * 24)
      h = Math.floor(54 + noise2(x / 20, z / 20, s) * 13 - d * 0.09);
  }
  return {
    h,
    biome: "the_end",
    river: 1,
    land: h > MIN_Y ? 1 : 0,
    void: h < MIN_Y,
  };
}
export function generateStronghold(w, c, put) {
  const sites = strongholds(w),
    ox = c.cx * 16,
    oz = c.cz * 16;
  for (const site of sites) {
    if (
      ox + 16 < site.x - 30 ||
      ox > site.x + 30 ||
      oz + 16 < site.z - 25 ||
      oz > site.z + 25
    )
      continue;
    const frames = portalFrames(site),
      s = seedOf(w);
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const wx = ox + x,
          wz = oz + z,
          dx = wx - site.x,
          dz = wz - site.z;
        const room = Math.abs(dx) <= 7 && Math.abs(dz) <= 8,
          library = Math.abs(dx + 20) <= 7 && Math.abs(dz) <= 7,
          corridor = dx >= -20 && dx <= 0 && Math.abs(dz) <= 2,
          stairs = Math.abs(dx) <= 2 && dz >= 8 && dz <= 25;
        if (!room && !library && !corridor && !stairs) continue;
        const floor = site.y + (stairs ? Math.floor((dz - 8) * 0.65) : 0),
          wall = room
            ? Math.abs(dx) === 7 || Math.abs(dz) === 8
            : library
              ? Math.abs(dx + 20) === 7 || Math.abs(dz) === 7
              : stairs
                ? Math.abs(dx) === 2
                : Math.abs(dz) === 2;
        for (let y = floor; y <= floor + 6; y++) {
          let id =
            y === floor || y === floor + 6 || wall
              ? (B.stone_bricks ?? B.cobble)
              : B.air;
          if (wall && Math.abs(dz) <= 1 && dx >= -28 && dx <= 7)
            id = y <= floor + 3 && y > floor ? B.air : id;
          if (
            library &&
            Math.abs(dx + 20) === 6 &&
            Math.abs(dz) > 2 &&
            y > floor &&
            y < floor + 4
          )
            id = B.bookshelf;
          if (room && Math.abs(dx) <= 1 && dz === -6 && y === floor + 1)
            id = B.lava;
          if ((dx === -6 || dx === -26) && dz === 0 && y === floor + 3)
            id = B.torch;
          put(x, y, z, id);
        }
        const frame = frames.find((p) => p.x === wx && p.z === wz);
        if (frame)
          put(
            x,
            frame.y,
            z,
            hash(wx, 12, wz, s) > 0.91
              ? B.end_portal_frame_filled
              : B.end_portal_frame,
          );
        if (dx === -20 && dz === 4) {
          put(x, floor + 1, z, B.chest);
          const key = `${wx},${floor + 1},${wz}`;
          w.containers[key] ||= {
            type: "chest",
            facing: 0,
            slots: [
              makeStack("ender_pearl", 2),
              makeStack("iron_ingot", 3),
              makeStack("bread", 4),
              ...Array(24).fill(null),
            ],
          };
        }
        c.maxY = Math.max(c.maxY, floor + 6);
      }
  }
}
export function generateEnd(w, c) {
  const { data, cx, cz, key } = c,
    put = (x, y, z, id) => {
      if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > MIN_Y && y <= MAX_Y) {
        data[(y - MIN_Y) * 256 + z * 16 + x] = id;
        c.maxY = Math.max(c.maxY, y);
      }
    };
  c.maxY = MIN_Y + 1;
  for (let z = 0; z < 16; z++)
    for (let x = 0; x < 16; x++) {
      const wx = cx * 16 + x,
        wz = cz * 16 + z,
        t = endTerrain(w, wx, wz);
      if (!t.void) {
        const bottom = Math.max(
          18,
          t.h - 18 - Math.floor(noise2(wx / 14, wz / 14, seedOf(w)) * 15),
        );
        for (let y = bottom; y <= t.h; y++) put(x, y, z, B.end_stone);
        if (Math.hypot(wx, wz) > 700 && hash(wx, 7, wz, seedOf(w)) > 0.985) {
          const height = 3 + Math.floor(hash(wx, 9, wz, seedOf(w)) * 4);
          for (let y = 1; y <= height; y++) put(x, t.h + y, z, B.chorus_plant);
          put(x, t.h + height + 1, z, B.chorus_flower);
        }
      }
      for (const p of END_PILLARS) {
        if ((wx - p.x) ** 2 + (wz - p.z) ** 2 <= p.r * p.r)
          for (let y = 50; y <= p.top; y++) put(x, y, z, B.obsidian);
        if (wx === p.x && wz === p.z) put(x, p.top + 1, z, B.bedrock);
        if (p.caged && Math.abs(wx - p.x) <= 2 && Math.abs(wz - p.z) <= 2)
          for (let y = p.top + 2; y <= p.top + 5; y++)
            if (
              Math.abs(wx - p.x) === 2 ||
              Math.abs(wz - p.z) === 2 ||
              y === p.top + 5
            )
              put(x, y, z, B.iron_bars ?? B.cobble);
      }
      if (Math.abs(wx - 96) <= 2 && Math.abs(wz) <= 2) {
        put(x, 50, z, B.obsidian);
        for (let y = 51; y <= 54; y++) put(x, y, z, B.air);
      }
      if (Math.hypot(wx, wz) < 4) {
        const r = Math.hypot(wx, wz);
        put(x, 60, z, r > 2 ? B.bedrock : B.end_stone);
        if (wx === 0 && wz === 0)
          for (let y = 61; y <= 64; y++) put(x, y, z, B.bedrock);
      }
    }
  for (const [x, y, z, id] of w.editChunks.get(key) || [])
    put(x - cx * 16, y, z - cz * 16, id);
  w.dirty.add(key);
  return c;
}
