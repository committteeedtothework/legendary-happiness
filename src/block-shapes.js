import { BLOCKS } from "./data.js";
import { blockBounds } from "./doors.js";
const cube = [0, 0, 0, 1, 1, 1],
  cache = new Map();
const rotate = (b, facing) => {
  let r = b;
  for (let i = 0; i < facing; i++)
    r = [1 - r[5], r[1], r[0], 1 - r[2], r[4], r[3]];
  return r;
};
export function blockParts(id, world, x = 0, y = 0, z = 0, collision = false) {
  const b = BLOCKS[id];
  if (!b) return [];
  if (!b.edition) return [blockBounds(id)];
  const s = b.state || {},
    f = s.facing || 0;
  const at = (dx, dz) => world?.get(x + dx, y, z + dz) || 0;
  const connects = (dx, dz) => {
    const other = BLOCKS[at(dx, dz)];
    return (
      other?.solid &&
      (!other.transparent ||
        ["fence", "wall", "gate", "pane"].includes(other.shape))
    );
  };
  let mask = 0;
  if (["fence", "wall", "pane"].includes(b.shape))
    for (const [i, [dx, dz]] of [
      [0, [0, -1]],
      [1, [1, 0]],
      [2, [0, 1]],
      [3, [-1, 0]],
    ])
      if (connects(dx, dz)) mask |= 1 << i;
  let corner = 0;
  if (b.shape === "stairs" && world) {
    const dirs = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ],
      d = dirs[f],
      front = BLOCKS[at(d[0], d[1])],
      back = BLOCKS[at(-d[0], -d[1])];
    if (
      front?.shape === "stairs" &&
      front.state.half === s.half &&
      front.state.facing % 2 !== f % 2
    )
      corner = front.state.facing === (f + 1) % 4 ? 1 : 2;
    else if (
      back?.shape === "stairs" &&
      back.state.half === s.half &&
      back.state.facing % 2 !== f % 2
    )
      corner = back.state.facing === (f + 1) % 4 ? 3 : 4;
  }
  const key = [id, mask, corner, collision].join(":");
  if (cache.has(key)) return cache.get(key);
  let p;
  switch (b.shape) {
    case "slab":
      p = [
        s.half === "double"
          ? cube
          : s.half === "top"
            ? [0, 0.5, 0, 1, 1, 1]
            : [0, 0, 0, 1, 0.5, 1],
      ];
      break;
    case "stairs": {
      const bottom = s.half !== "top",
        y0 = bottom ? 0.5 : 0,
        y1 = bottom ? 1 : 0.5;
      let top = [[0, y0, 0, 1, y1, 0.5]];
      if (corner === 1) top = [[0.5, y0, 0, 1, y1, 0.5]];
      if (corner === 2) top = [[0, y0, 0, 0.5, y1, 0.5]];
      if (corner === 3) top.push([0.5, y0, 0.5, 1, y1, 1]);
      if (corner === 4) top.push([0, y0, 0.5, 0.5, y1, 1]);
      p = [
        [0, bottom ? 0 : 0.5, 0, 1, bottom ? 0.5 : 1, 1],
        ...top.map((v) => rotate(v, f)),
      ];
      break;
    }
    case "fence":
    case "wall": {
      const wall = b.shape === "wall",
        a = wall ? 0.25 : 0.375,
        c = 1 - a,
        h = collision ? 1.5 : 1;
      p = [[a, 0, a, c, h, c]];
      for (let i = 0; i < 4; i++)
        if (mask & (1 << i)) {
          const rails = wall
            ? [[0.3125, 0, 0, 0.6875, collision ? 1.5 : 0.8125, 0.5]]
            : [
                [0.4375, 0.375, 0, 0.5625, 0.5625, 0.5],
                [0.4375, 0.75, 0, 0.5625, 0.9375, 0.5],
              ];
          p.push(
            ...rails.map((v) =>
              rotate(
                collision && !wall ? [v[0], 0, v[2], v[3], 1.5, v[5]] : v,
                i,
              ),
            ),
          );
        }
      break;
    }
    case "pane":
      p = [[0.4375, 0, 0.4375, 0.5625, 1, 0.5625]];
      for (let i = 0; i < 4; i++)
        if (mask & (1 << i)) p.push(rotate([0.4375, 0, 0, 0.5625, 1, 0.5], i));
      break;
    case "gate":
      p = s.open
        ? [
            [0, 0, 0.375, 0.125, 1, 0.625],
            [0.875, 0, 0.375, 1, 1, 0.625],
          ]
        : [
            [0, 0, 0.375, 0.125, 1, 0.625],
            [0.875, 0, 0.375, 1, 1, 0.625],
            [0.125, 0.375, 0.4375, 0.875, 0.5625, 0.5625],
            [0.125, 0.75, 0.4375, 0.875, 0.9375, 0.5625],
          ];
      p = p.map((v) =>
        rotate(collision && !s.open ? [v[0], 0, v[2], v[3], 1.5, v[5]] : v, f),
      );
      break;
    case "trapdoor":
      p = [
        s.open
          ? rotate([0, 0, 0, 1, 1, 0.1875], f)
          : s.half === "top"
            ? [0, 0.8125, 0, 1, 1, 1]
            : [0, 0, 0, 1, 0.1875, 1],
      ];
      break;
    case "door":
      p = [blockBounds(id)];
      break;
    case "ladder":
      p = [rotate([0, 0, 0, 1, 1, 0.125], f)];
      break;
    case "carpet":
      p = [[0, 0, 0, 1, 0.0625, 1]];
      break;
    case "core":
      p = [[0.25, 0, 0.25, 0.75, 0.5, 0.75]];
      break;
    case "chain":
      p = [[0.4375, 0, 0.4375, 0.5625, 1, 0.5625]];
      break;
    case "lantern":
      p = [
        [0.3125, 0.0625, 0.3125, 0.6875, 0.5625, 0.6875],
        [0.375, 0.5625, 0.375, 0.625, 0.6875, 0.625],
        [0.4375, 0.6875, 0.4375, 0.5625, 0.875, 0.5625],
      ];
      break;
    case "pot":
      p = [
        [0.3125, 0, 0.3125, 0.6875, 0.375, 0.375],
        [0.3125, 0, 0.625, 0.6875, 0.375, 0.6875],
        [0.3125, 0, 0.375, 0.375, 0.375, 0.625],
        [0.625, 0, 0.375, 0.6875, 0.375, 0.625],
        [0.375, 0, 0.375, 0.625, 0.0625, 0.625],
      ];
      break;
    case "workstation":
      p =
        b.key === "stonecutter"
          ? [
              [0, 0, 0, 1, 0.5625, 1],
              [0.4375, 0.5625, 0.125, 0.5625, 0.9375, 0.875],
            ]
          : [cube];
      break;
    case "plant":
      p = [
        [
          0.1,
          0,
          0.1,
          0.9,
          b.crop?.age === 0
            ? 0.25
            : b.crop?.age === 1
              ? 0.45
              : b.crop?.age === 2
                ? 0.65
                : 0.9,
          0.9,
        ],
      ];
      break;
    default:
      p = [cube];
  }
  cache.set(key, p);
  return p;
}
// Exterior surfaces of a union of boxes. Used for world, held and dropped geometry.
// Cached by shape, so no per-frame topology allocation is needed.
const surfaceCache = new Map();
export function shapeSurfaces(parts) {
  const key = JSON.stringify(parts);
  if (surfaceCache.has(key)) return surfaceCache.get(key);
  const axes = [0, 1, 2].map((a) =>
    [...new Set(parts.flatMap((p) => [p[a], p[a + 3]]))].sort((a, b) => a - b),
  );
  const inside = (p) =>
    parts.some((b) =>
      p.every((v, a) => v > b[a] - 1e-7 && v < b[a + 3] + 1e-7),
    );
  const result = [],
    faces = [
      [0, 1, 0],
      [0, -1, 1],
      [1, 1, 2],
      [1, -1, 3],
      [2, 1, 4],
      [2, -1, 5],
    ];
  for (const [a, sign, face] of faces) {
    const others = [0, 1, 2].filter((v) => v !== a),
      [u, v] = others;
    for (const plane of axes[a])
      for (let i = 0; i < axes[u].length - 1; i++)
        for (let j = 0; j < axes[v].length - 1; j++) {
          const center = [0, 0, 0];
          center[a] = plane - sign * 1e-5;
          center[u] = (axes[u][i] + axes[u][i + 1]) / 2;
          center[v] = (axes[v][j] + axes[v][j + 1]) / 2;
          if (!inside(center)) continue;
          center[a] += sign * 2e-5;
          if (inside(center)) continue;
          const bounds = [0, 0, 0, 0, 0, 0];
          bounds[a] = bounds[a + 3] = plane;
          bounds[u] = axes[u][i];
          bounds[u + 3] = axes[u][i + 1];
          bounds[v] = axes[v][j];
          bounds[v + 3] = axes[v][j + 1];
          result.push({ face, bounds });
        }
  }
  surfaceCache.set(key, result);
  return result;
}
export function editionStateId(id, patch) {
  const b = BLOCKS[id];
  if (!b?.edition) return id;
  const base = b.editionBase ?? id,
    state = { ...b.state, ...patch };
  for (let i = base; i < base + (b.variants || 1); i++)
    if (Object.entries(state).every(([k, v]) => BLOCKS[i].state[k] === v))
      return i;
  return id;
}
