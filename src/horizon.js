import { palmColumn, nearbyPalmSites } from "./palm-terrain.js";
import { CINDER_BIOMES, nearbyCinderSites } from "./cinderworld.js";
import { relicSite } from "./relic.js";
import { B, BLOCKS, ATLAS_COLS, ATLAS_ROWS, SEA, MIN_Y } from "./data.js";
import { BIOMES, surfaceBlock } from "./biomes.js";
import { VILLAGE_STYLES } from "./village-styles.js";
import { hash } from "./random.js";
import { FACES } from "./mesher.js";
import { blockArtUV } from "./block-art.js";
// Far tiles sample height fields directly: no 98,304-byte voxel chunk allocations,
// cave simulation or container generation. Two batched meshes cover a 64×64 tile.
export function meshHorizon(
  world,
  cx,
  cz,
  { span = 4, step = 4, biomeColors = true, texturePack = "renewed" } = {},
) {
  const ox = cx * 16,
    oz = cz * 16,
    width = span * 16,
    groups = [
      { p: [], n: [], uv: [], color: [], i: [] },
      { p: [], n: [], uv: [], color: [], i: [] },
    ],
    heights = new Map();
  const sample = (x, z) => {
    const key = x + "," + z;
    if (heights.has(key)) return heights.get(key);
    let t = world.terrain(ox + x, oz + z);
    for (const site of nearbyPalmSites(world, ox + x, oz + z)) {
      const col = palmColumn(site, ox + x, oz + z, t.h, world.seedInt);
      if (col)
        t = { ...t, h: col.h, palm: true, biome: "badlands", village: null };
    }
    heights.set(key, t);
    return t;
  };
  function face(id, f, x, y, z, w, h, d, tint = [1, 1, 1]) {
    const out = groups[id === B.water || id === B.lava ? 1 : 0],
      start = out.p.length / 3,
      tile = id * 3 + f.t,
      uv = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
    for (let i = 0; i < 4; i++) {
      const v = f.v[i];
      out.p.push(x + v[0] * w, y + v[1] * h, z + v[2] * d);
      out.n.push(...f.n);
      if (texturePack === "supplied" || BLOCKS[id]?.edition)
        out.uv.push(...blockArtUV(id, FACES.indexOf(f), ...uv[i], texturePack));
      else
        out.uv.push(
          ((tile % ATLAS_COLS) + 0.015 + uv[i][0] * 0.97) / ATLAS_COLS,
          1 -
            (Math.floor(tile / ATLAS_COLS) + 0.985 - uv[i][1] * 0.97) /
              ATLAS_ROWS,
        );
      out.color.push(...tint.map((c) => c * f.shade));
    }
    out.i.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  function box(wx, y, wz, w, h, d, id) {
    const x = wx - ox,
      z = wz - oz,
      x0 = Math.max(0, x),
      x1 = Math.min(width, x + w),
      z0 = Math.max(0, z),
      z1 = Math.min(width, z + d);
    if (x0 >= x1 || z0 >= z1 || h <= 0) return;
    const tint =
      biomeColors && (BLOCKS[id]?.foliage || id === B.leaves)
        ? BIOMES[world.terrain(wx, wz).biome]?.tint || [1, 1, 1]
        : [1, 1, 1];
    for (const f of FACES) {
      if (f.n[0] && (f.n[0] > 0 ? x + w > width : x < 0)) continue;
      if (f.n[2] && (f.n[2] > 0 ? z + d > width : z < 0)) continue;
      face(id, f, x0, y, z0, x1 - x0, h, z1 - z0, tint);
    }
  }
  for (let z = 0; z < width; z += step)
    for (let x = 0; x < width; x += step) {
      const t = sample(x, z),
        h = t.h,
        id =
          world.dimension === "cinderwild"
            ? B[CINDER_BIOMES[t.biome]?.surface || "cinderstone"]
            : world.generationVersion >= 4
              ? surfaceBlock(t, h, world.seedInt)
              : t.biome === "desert" || h <= SEA + 1
                ? B.sand
                : t.biome === "alpine"
                  ? B.snow
                  : B.grass;
      const tint =
        biomeColors && id === B.grass
          ? BIOMES[t.biome]?.tint || [1, 1, 1]
          : [1, 1, 1];
      face(id, FACES[2], x, h, z, step, 1, step, tint);
      for (const [f, dx, dz] of [
        [FACES[0], step, 0],
        [FACES[1], -step, 0],
        [FACES[4], 0, step],
        [FACES[5], 0, -step],
      ]) {
        const neighbor = sample(x + dx, z + dz).h;
        const edge = dx ? x + (dx > 0 ? step : 0) : z + (dz > 0 ? step : 0);
        // A fine neighbor may be much lower than this sampled height. Keep a
        // solid skirt on chunk grid lines; ownership clipping removes its hidden
        // half, without opening a vertical crack at LOD boundaries.
        const low = edge % 16 === 0 ? Math.min(neighbor, MIN_Y) : neighbor;
        if (low < h) face(id, f, x, low + 1, z, step, h - low, step);
      }
      const level = world.dimension === "cinderwild" ? 68 : SEA;
      if (h < level && !t.palm)
        face(
          world.dimension === "cinderwild" ? B.lava : B.water,
          FACES[2],
          x,
          level - 0.09,
          z,
          step,
          1,
          step,
        );
      if (
        world.dimension === "overworld" &&
        !t.village &&
        h > SEA + 1 &&
        BIOMES[t.biome]?.tree &&
        hash((ox + x) / step, 1, (oz + z) / step, world.seedInt) <
          Math.min(0.48, (BIOMES[t.biome].density || 0) * step * step)
      ) {
        const pine = ["pine_forest", "snowy_taiga"].includes(t.biome),
          leaves = pine
            ? B.pine_leaves
            : t.biome === "birch_woodland"
              ? B.birch_leaves
              : B.leaves,
          wx = ox + x + 1,
          wz = oz + z + 1;
        if (pine)
          for (let tier = 0; tier < 3; tier++)
            box(
              wx + tier * 0.5,
              h + 3 + tier * 2,
              wz + tier * 0.5,
              4 - tier,
              2,
              4 - tier,
              leaves,
            );
        else box(wx - 1, h + 4, wz - 1, 4, 3, 4, leaves);
      }
    }
  for (const v of world.nearbyVillages(
    ox + width / 2,
    oz + width / 2,
    width / 2 + 45,
  )) {
    const palette = VILLAGE_STYLES[v.style] || {
      wall: v.biome === "desert" ? B.sandstone : B.planks,
      frame: B.log,
      roof: B.planks,
      shape: v.biome === "desert" ? "terrace" : "gable",
    };
    for (const h of v.houses) {
      const floor = h.floor ?? v.y;
      box(h.x, floor + 1, h.z, 7, 4, 7, palette.wall);
      if (["terrace", "canopy"].includes(palette.shape))
        box(h.x - 1, floor + 5, h.z - 1, 9, 1, 9, palette.roof);
      else
        for (let tier = 0; tier < 4; tier++)
          box(
            h.x - 1 + tier,
            floor + 5 + tier,
            h.z - 1,
            9 - tier * 2,
            1,
            9,
            palette.roof,
          );
    }
  }
  if (world.dimension === "cinderwild" && world.generationVersion >= 7) {
    for (const s of nearbyCinderSites(
      world,
      ox + width / 2,
      oz + width / 2,
      width / 2 + 24,
    )) {
      const r = s.radius || (s.kind === "bastion" ? 12 : 8);
      box(s.x - r, s.y, s.z - r, r * 2 + 1, 1, r * 2 + 1, B.cinder_bricks);
      for (const dx of [-r, r])
        for (const dz of [-r, r])
          box(
            s.x + dx,
            s.y + 1,
            s.z + dz,
            s.radius ? 5 : 2,
            s.height || (s.kind === "bastion" ? 9 : 6),
            s.radius ? 5 : 2,
            B.basalt,
          );
      if (s.radius)
        for (const side of [-1, 1])
          box(s.x + side * 21, s.y + 1, s.z - 23, 2, 28, 47, B.cinder_bricks);
    }
  }
  const temple = relicSite(world);
  if (temple?.temple && world.generationVersion >= 10) {
    box(temple.x - 34, temple.y - 1, temple.z - 34, 69, 1, 69, B.stone_bricks);
    for (const dx of [-30, 30])
      for (const dz of [-30, 30]) {
        box(
          temple.x + dx - 2,
          temple.y,
          temple.z + dz - 2,
          5,
          29,
          5,
          B.stone_bricks,
        );
        box(
          temple.x + dx - 4,
          temple.y + 29,
          temple.z + dz - 4,
          9,
          4,
          9,
          B.runestone,
        );
        box(
          temple.x + dx - 1,
          temple.y + 33,
          temple.z + dz - 1,
          3,
          4,
          3,
          B.glow_crystal,
        );
      }
    box(temple.x - 7, temple.y, temple.z - 7, 15, 9, 15, B.stone_bricks);
    box(temple.x - 7, temple.y + 23, temple.z - 7, 15, 3, 15, B.runestone);
  } else if (temple?.temple) {
    box(temple.x - 14, temple.y - 1, temple.z - 14, 29, 1, 29, B.runestone);
    for (const dx of [-11, 11])
      for (const dz of [-11, -3, 5, 11])
        box(temple.x + dx, temple.y, temple.z + dz, 2, 9, 2, B.runestone);
  }
  for (let dz = 0; dz < span; dz++)
    for (let dx = 0; dx < span; dx++)
      for (const [x, y, z, id] of world.editChunks.get(
        `${cx + dx},${cz + dz}`,
      ) || [])
        if (id && BLOCKS[id]?.solid && y >= world.terrain(x, z).h)
          box(x, y, z, 1, 1, 1, id);
  return groups.map((g) =>
    g.p.length
      ? {
          position: new Float32Array(g.p),
          normal: new Float32Array(g.n),
          uv: new Float32Array(g.uv),
          color: new Float32Array(g.color),
          indices: new Uint32Array(g.i),
        }
      : null,
  );
}
export function terrainPlan(cx, cz, radius) {
  const entries = [],
    near = Math.min(8, radius);
  for (let dz = -near; dz <= near; dz++)
    for (let dx = -near; dx <= near; dx++)
      if (dx * dx + dz * dz <= (near + 0.4) ** 2)
        entries.push({
          cx: cx + dx,
          cz: cz + dz,
          key: `${cx + dx},${cz + dz}`,
          distance: Math.hypot(dx, dz),
          span: 1,
        });
  if (radius >= 1)
    for (
      let mz = Math.floor((cz - radius) / 4);
      mz <= Math.floor((cz + radius) / 4);
      mz++
    )
      for (
        let mx = Math.floor((cx - radius) / 4);
        mx <= Math.floor((cx + radius) / 4);
        mx++
      ) {
        const tx = mx * 4,
          tz = mz * 4,
          d = Math.hypot(tx + 1.5 - cx, tz + 1.5 - cz);
        if (d > radius + 2.8) continue;
        entries.push({
          cx: tx,
          cz: tz,
          key: `${tx},${tz},h4`,
          distance: d,
          span: 4,
          horizon: true,
        });
      }
  // Establish the first horizon after nearby collision geometry, before spending
  // time on every middle-distance cave/structure mesh.
  return entries.sort(
    (a, b) =>
      (a.horizon ? Math.min(3, radius * 0.5) + a.distance / 100 : a.distance) -
      (b.horizon ? Math.min(3, radius * 0.5) + b.distance / 100 : b.distance),
  );
}
