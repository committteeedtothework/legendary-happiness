import { buildBlockLight, emittedLight } from "./block-light.js";
import { blockParts, shapeSurfaces } from "./block-shapes.js";
import { worldVisualKind } from "./world-interactions.js";
import { fluid, fluidHeight } from "./block-dynamics.js";
import { BIOMES } from "./biomes.js";
import {
  B,
  BLOCKS,
  ATLAS_COLS,
  ATLAS_ROWS,
  MIN_Y,
  MAX_Y,
  SEA,
} from "./data.js";
import { index } from "./world.js";
import { blockBounds } from "./doors.js";
import { blockArtUV } from "./block-art.js";
const bSnow = (id) => !!BLOCKS[id]?.snowLayers;
const COLS = ATLAS_COLS,
  ROWS = ATLAS_ROWS;
export const FACES = [
  {
    n: [1, 0, 0],
    v: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    shade: 0.78,
    t: 1,
  },
  {
    n: [-1, 0, 0],
    v: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    shade: 0.7,
    t: 1,
  },
  {
    n: [0, 1, 0],
    v: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    shade: 1,
    t: 0,
  },
  {
    n: [0, -1, 0],
    v: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    shade: 0.5,
    t: 2,
  },
  {
    n: [0, 0, 1],
    v: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    shade: 0.86,
    t: 1,
  },
  {
    n: [0, 0, -1],
    v: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    shade: 0.76,
    t: 1,
  },
];
export function meshChunk(
  world,
  c,
  {
    surfaceOnly = false,
    ambientOcclusion = true,
    biomeColors = true,
    biomeBlend = 0,
    texturePack = "renewed",
    interactiveModels = false,
  } = {},
) {
  c.worldVisuals = [];
  const groups = [
    { p: [], n: [], uv: [], col: [], light: [], i: [] },
    { p: [], n: [], uv: [], col: [], light: [], i: [] },
  ];
  const blockLight = buildBlockLight(world, c);
  const get = (x, y, z) =>
    y < MIN_Y
      ? world.dimension==="end"?B.air:B.bedrock
      : y > MAX_Y
        ? B.air
        : x >= 0 && x < 16 && z >= 0 && z < 16
          ? c.data[index(x, y, z)]
          : world.get(c.cx * 16 + x, y, c.cz * 16 + z);
  const tints = new Map();
  const columnTint = (x, z) => {
    const key = x + z * 16;
    if (tints.has(key)) return tints.get(key);
    const wx = c.cx * 16 + x,
      wz = c.cz * 16 + z,
      r = Math.max(0, Math.min(4, biomeBlend || 0));
    const points = r
      ? [
          [0, 0],
          [-r, 0],
          [r, 0],
          [0, -r],
          [0, r],
        ]
      : [[0, 0]];
    const tint = [0, 0, 0];
    for (const [dx, dz] of points) {
      const color = BIOMES[world.terrain(wx + dx, wz + dz).biome]?.tint || [
        1, 1, 1,
      ];
      for (let i = 0; i < 3; i++) tint[i] += color[i] / points.length;
    }
    tints.set(key, tint);
    return tint;
  };
  const face = (out, id, f, x, y, z, bounds) => {
    const start = out.p.length / 3,
      tile =
        (bSnow(id)
          ? B.snow
          : fluid(id) && !BLOCKS[id]?.aquaticWater
            ? B[fluid(id).type]
            : id) *
          3 +
        f.t,
      tx = tile % COLS,
      ty = Math.floor(tile / COLS),
      uvs = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
    for (let i = 0; i < 4; i++) {
      const v = f.v[i],
        px = x + (bounds ? bounds[0] + v[0] * (bounds[3] - bounds[0]) : v[0]),
        py = y + (bounds ? bounds[1] + v[1] * (bounds[4] - bounds[1]) : v[1]),
        pz = z + (bounds ? bounds[2] + v[2] * (bounds[5] - bounds[2]) : v[2]);
      out.p.push(px, py, pz);
      out.n.push(...f.n);
      const level = Math.max(
        emittedLight(id),
        blockLight(c.cx * 16 + x + f.n[0], y + f.n[1], c.cz * 16 + z + f.n[2]),
      );
      out.light.push(Math.pow(level / 15, 2) * 1.5);
      if (id === B.torch || texturePack === "supplied" || (BLOCKS[id]?.edition||BLOCKS[id]?.endContent))
        out.uv.push(
          ...blockArtUV(
            fluid(id) && !BLOCKS[id]?.aquaticWater ? B[fluid(id).type] : id,
            FACES.indexOf(f),
            ...uvs[i],
            texturePack,
          ),
        );
      else
        out.uv.push(
          (tx + 0.015 + uvs[i][0] * 0.97) / COLS,
          1 - (ty + 1 - 0.015 - uvs[i][1] * 0.97) / ROWS,
        );
      const shade =
        fluid(id)?.type === "lava" || id === B.fire
          ? 1.7
          : [B.torch, B.portal, B.emberglass, B.lava, B.glow_crystal].includes(
                id,
              )
            ? 1.7
            : f.shade;
      let ao = 1;
      if (
        ambientOcclusion &&
        !bounds &&
        ![B.water, B.portal, B.lava, B.emberglass, B.torch].includes(id)
      ) {
        const axes = [0, 1, 2].filter((a) => f.n[a] === 0),
          base = [x + f.n[0], y + f.n[1], z + f.n[2]];
        const offset = axes.map((a) => (v[a] === 0 ? -1 : 1));
        const opaque = (a, b) => {
          const p = [...base];
          p[axes[0]] += a;
          p[axes[1]] += b;
          const block = BLOCKS[get(...p)];
          return block.solid && !block.transparent ? 1 : 0;
        };
        const side1 = opaque(offset[0], 0),
          side2 = opaque(0, offset[1]),
          corner = opaque(offset[0], offset[1]);
        ao = side1 && side2 ? 0.52 : 1 - (side1 + side2 + corner) * 0.14;
      }
      const tint =
        biomeColors &&
        ((id === B.grass && f.t === 0) ||
          id === B.leaves ||
          BLOCKS[id].foliage ||
          id === B.wild_grass ||
          id === B.fern)
          ? columnTint(x, z)
          : [1, 1, 1];
      out.col.push(...tint.map((t) => shade * ao * t));
    }
    out.i.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };
  const heights = new Map();
  const surface = (x, z) => {
    const key = x + "," + z;
    if (heights.has(key)) return heights.get(key);
    const h = world.terrain(c.cx * 16 + x, c.cz * 16 + z).h;
    const y = Math.min(h, SEA);
    heights.set(key, y);
    return y;
  };
  for (
    let y = surfaceOnly
      ? Math.max(
          MIN_Y,
          Math.min(
            ...Array.from({ length: 256 }, (_, i) =>
              surface(i % 16, Math.floor(i / 16)),
            ),
          ) - 18,
        )
      : MIN_Y;
    y <= c.maxY;
    y++
  )
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        if (
          surfaceOnly &&
          y <
            Math.min(
              surface(x, z),
              surface(x - 1, z),
              surface(x + 1, z),
              surface(x, z - 1),
              surface(x, z + 1),
            )
        )
          continue;
        const id = c.data[index(x, y, z)];
        if (!id) continue;
        const b = BLOCKS[id],
          out =
            groups[
              (fluid(id)?.type === "water") ||
              [B.glass, B.ice, B.portal].includes(id) ||
              (b.edition && /glass/.test(b.key))
                ? 1
                : 0
            ];
        if (interactiveModels && !surfaceOnly) {
          const kind = worldVisualKind(id);
          if (kind && !b.door?.upper && c.worldVisuals.length < 64) {
            c.worldVisuals.push({
              x: c.cx * 16 + x,
              y,
              z: c.cz * 16 + z,
              id,
              ...(kind === "chest"
                ? {
                    facing:
                      world.containers[`${c.cx * 16 + x},${y},${c.cz * 16 + z}`]
                        ?.facing ?? 0,
                  }
                : {}),
            });

            if (kind === "chest") continue;
          }
        }
        if (
          [
            B.fire,
            B.crop,
            B.wild_grass,
            B.poppy,
            B.cornflower,
            B.sugar_cane,
            B.fern,
            B.bamboo,
            B.cobweb,
          ].includes(id) ||
          b.plant
        ) {
          const plantHeight = b.bounds
            ? b.bounds[4]
            : [B.bamboo, B.sugar_cane, B.cobweb].includes(id)
              ? 1
              : 0.9;
          for (const f of [FACES[4], FACES[5], FACES[0], FACES[1]])
            face(
              out,
              id,
              f,
              x,
              y,
              z,
              f.n[2]
                ? [0, 0, 0.5, 1, plantHeight, 0.5]
                : [0.5, 0, 0, 0.5, plantHeight, 1],
            );
          continue;
        }
        if (id === B.mine_rail) {
          for (const f of [FACES[2], FACES[3]])
            face(out, id, f, x, y, z, [0, 0.025, 0, 1, 0.035, 1]);
          continue;
        }
        if (id === B.conduit || id === B.brewing_stand || b.pickles || b.eggs) {
          const parts =
            id === B.conduit
              ? [
                  [0.3, 0.3, 0.3, 0.7, 0.7, 0.7],
                  [0.15, 0.45, 0.15, 0.85, 0.55, 0.85],
                ]
              : id === B.brewing_stand
                ? [
                    [0.1, 0, 0.1, 0.9, 0.12, 0.9],
                    [0.46, 0.12, 0.46, 0.54, 0.9, 0.54],
                    [0.2, 0.3, 0.46, 0.8, 0.38, 0.54],
                    ...[0.22, 0.48, 0.74].map((x) => [
                      x,
                      0.12,
                      0.25,
                      x + 0.1,
                      0.38,
                      0.4,
                    ]),
                  ]
                : Array.from({ length: b.pickles || b.eggs }, (_, i) => [
                    0.15 + (i % 2) * 0.4,
                    0,
                    0.15 + Math.floor(i / 2) * 0.4,
                    0.35 + (i % 2) * 0.4,
                    b.eggs ? 0.4 : 0.38,
                    0.35 + Math.floor(i / 2) * 0.4,
                  ]);
          for (const part of parts)
            for (const f of FACES) face(out, id, f, x, y, z, part);
          continue;
        }
        if (b.edition && !b.plant && b.shape !== "cube") {
          const proxy = {
            get: (wx, wy, wz) => get(wx - c.cx * 16, wy, wz - c.cz * 16),
          };
          for (const q of shapeSurfaces(
            blockParts(id, proxy, c.cx * 16 + x, y, c.cz * 16 + z),
          )) {
            const f = FACES[q.face],
              a = f.n.findIndex((v) => v !== 0),
              plane = q.bounds[a];
            if ((plane === 0 && f.n[a] < 0) || (plane === 1 && f.n[a] > 0)) {
              const other = BLOCKS[get(x + f.n[0], y + f.n[1], z + f.n[2])];
              if (other?.solid && !other.transparent) continue;
            }
            face(out, id, f, x, y, z, q.bounds);
          }
          continue;
        }
        if (b.relic) {
          // The planted blade uses the same detailed display model as the held
          // weapon. Its voxel state, target bounds and extraction remain intact.
          if (b.relic === "blade") continue;
          const parts =
            b.relic === "base"
              ? [
                  [0.1, 0, 0.1, 0.9, 0.6, 0.9],
                  [0.44, 0.6, 0.46, 0.56, 1, 0.54],
                ]
              : [
                  [0.46, 0, 0.45, 0.54, 0.12, 0.55],
                  [0.42, 0.12, 0.44, 0.58, 0.68, 0.56],
                  [0.46, 0.52, 0.45, 0.54, 0.68, 0.55],
                  [0.37, 0.2, 0.43, 0.4, 0.38, 0.57],
                  [0.6, 0.2, 0.43, 0.63, 0.38, 0.57],
                  [0.2, 0.68, 0.42, 0.8, 0.77, 0.58],
                  [0.46, 0.77, 0.46, 0.54, 1, 0.54],
                ];
          for (const part of parts)
            for (const f of FACES) face(out, id, f, x, y, z, part);
          continue;
        }
        if (b.snowLayers) {
          for (const f of FACES) {
            const other = get(x + f.n[0], y + f.n[1], z + f.n[2]);
            if (f.n[1] === -1 && !BLOCKS[other].transparent) continue;
            if (!f.n[1] && (BLOCKS[other].snowLayers || 0) >= b.snowLayers)
              continue;
            face(out, id, f, x, y, z, blockBounds(id));
          }
          continue;
        }
        if (b.door || id === B.cactus) {
          for (const f of FACES) face(out, id, f, x, y, z, blockBounds(id));
          continue;
        }
        for (const f of FACES) {
          const adjacent = get(x + f.n[0], y + f.n[1], z + f.n[2]),
            ab = BLOCKS[adjacent];
          const liquid = b.aquaticWater ? null : fluid(id),
            ownHeight =
              liquid && fluid(get(x, y + 1, z))?.type === liquid.type
                ? 1
                : fluidHeight(id),
            otherLiquid = fluid(adjacent);
          if (liquid && otherLiquid?.type === liquid.type) {
            if (
              f.n[1] ||
              (fluid(get(x + f.n[0], y + 1, z + f.n[2]))?.type ===
              otherLiquid.type
                ? 1
                : fluidHeight(adjacent)) >= ownHeight
            )
              continue;
          } else if (
            id !== B.torch &&
            (adjacent === id || (!ab.transparent && ab.solid && adjacent !== B.chest))
          )
            continue;
          const portalZ =
            id === B.portal &&
            Object.values(world.portals || {}).some(
              (f) =>
                f.axis === "z" &&
                f.x === c.cx * 16 + x &&
                z + c.cz * 16 > f.z &&
                z + c.cz * 16 < f.z + 3 &&
                y > f.y &&
                y < f.y + 4,
            );
          const bounds =
            id === B.portal
              ? portalZ
                ? [0.45, 0, 0, 0.55, 1, 1]
                : [0, 0, 0.45, 1, 1, 0.55]
              : id === B.torch
                ? [0.4375, 0, 0.4375, 0.5625, 0.625, 0.5625]
                : liquid
                  ? [0, 0, 0, 1, ownHeight, 1]
                  : id === B.chest
                    ? blockBounds(id)
                    : b.bounds || null;
          face(out, id, f, x, y, z, bounds);
        }
      }
  return groups.map((g) =>
    g.p.length
      ? {
          position: new Float32Array(g.p),
          normal: new Float32Array(g.n),
          blockLight: new Float32Array(g.light),
          uv: new Float32Array(g.uv),
          color: new Float32Array(g.col),
          indices: new Uint32Array(g.i),
        }
      : null,
  );
}
