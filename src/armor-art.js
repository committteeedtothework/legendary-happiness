import { ITEMS } from "./data.js";
import { faceTexture, pixelShade } from "./pixel-surfaces.js";
const cache = new Map();
export const ARMOR_IDS = Object.keys(ITEMS).filter(
  (id) => ITEMS[id].armorSlot !== undefined,
);
export function armorPalette(id) {
  const item = ITEMS[id];
  if (item?.armorSlot === undefined) return null;
  const family = id.startsWith("turtle_") ? "turtle" : id.split("_")[0],
    base = family === "turtle" ? "#6a9c72" : item.color;
  return {
    family,
    base,
    light: pixelShade(base, 1.22),
    shade: pixelShade(base, 0.7),
    edge: pixelShade(base, 0.45),
    accent:
      family === "hellfire"
        ? "#ffe5a0"
        : family === "leather"
          ? "#dfbc82"
          : family === "dirt"
            ? "#b1a16a"
            : family === "turtle"
              ? "#c1d59a"
              : pixelShade(base, 1.38),
  };
}
export function armorPixel(id, part, face, x, y, w, h) {
  const p = armorPalette(id);
  if (!p) return null;
  const front = face === 5,
    vertical = face !== 2 && face !== 3;
  // The face opening and collar are alpha cutouts, not skin-coloured plates.
  if (part === "head") {
    if (face === 3) return null;
    if (
      vertical &&
      (front ? (y > 2 && x > 0 && x < w - 1) || y === h - 1 : y > h - 3)
    )
      return null;
  }
  if (part === "body" && front && y < 2 && x >= 3 && x <= 4) return null;
  if (
    p.family === "chainmail" &&
    vertical &&
    x > 0 &&
    x < w - 1 &&
    y > 0 &&
    y < h - 1 &&
    (x + y) % 2 === 1
  )
    return null;
  let c = p.base;
  if (x === 0 || x === w - 1) c = p.shade;
  if (y === 0) c = p.light;
  if (y === h - 1) c = p.edge;
  if (
    p.family === "leather" &&
    vertical &&
    (x === 1 || x === w - 2) &&
    y % 3 === 1
  )
    c = p.accent;
  if (p.family === "dirt" && (x + Math.floor(y / 3)) % 4 === 1 && y % 3 === 1)
    c = p.shade;
  if (p.family === "turtle" && vertical && (y % 3 === 2 || x % 4 === 0))
    c = p.shade;
  if (p.family === "chainmail" && vertical && c === p.base)
    c = (x + y) % 2 === 0 ? p.light : p.shade;
  if (front && part === "body" && y >= 3 && y <= 6 && (x === 3 || x === 4))
    c =
      p.family === "hellfire"
        ? x === 3
          ? p.accent
          : p.edge
        : y === 4
          ? p.accent
          : p.shade;
  if (vertical && part === "arm" && y >= 7 && y <= 8)
    c = y === 7 ? p.edge : p.accent;
  if (vertical && part === "leg" && y === 8) c = p.accent;
  if (
    p.family === "hellfire" &&
    part === "head" &&
    front &&
    y === 2 &&
    x > 1 &&
    x < w - 2
  )
    c = p.accent;
  if (front && part === "leg" && y >= 10) c = y === 11 ? p.edge : p.shade;
  return c;
}
export function armorTexture(id, part) {
  if (!armorPalette(id)) return null;
  const key = id + ":" + part;
  if (cache.has(key)) return cache.get(key);
  const dims = {
    head: [8, 8, 8],
    body: [8, 12, 4],
    arm: [4, 12, 4],
    leg: [4, 12, 4],
    belt: [8, 2, 4],
  }[part];
  const map = faceTexture(
    dims,
    (face, x, y, w, h) => armorPixel(id, part, face, x, y, w, h),
    { armor: id, part, palette: armorPalette(id) },
  );
  cache.set(key, map);
  return map;
}
export function paintArmorIcon(ctx, id) {
  const item = ITEMS[id],
    p = armorPalette(id);
  if (!p) return false;
  const grid = Array.from({ length: 16 }, () => Array(16).fill(".")),
    r = (x, y, w, h, c) => {
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++) grid[j][i] = c;
    };
  if (item.armorSlot === 0) {
    r(4, 3, 8, 2, "l");
    r(3, 5, 10, 4, "b");
    r(3, 9, 2, 4, "b");
    r(11, 9, 2, 4, "b");
    r(5, 8, 6, 2, ".");
    r(4, 5, 8, 1, "a");
  }
  if (item.armorSlot === 1) {
    r(3, 3, 3, 4, "l");
    r(10, 3, 3, 4, "l");
    r(2, 4, 3, 5, "b");
    r(11, 4, 3, 5, "b");
    r(5, 5, 6, 9, "b");
    r(6, 6, 4, 1, "l");
    r(7, 8, 2, 3, "a");
    r(5, 13, 6, 1, "d");
  }
  if (item.armorSlot === 2) {
    r(4, 3, 8, 3, "l");
    r(4, 6, 3, 8, "b");
    r(9, 6, 3, 8, "b");
    r(4, 12, 3, 1, "a");
    r(9, 12, 3, 1, "a");
  }
  if (item.armorSlot === 3) {
    r(3, 5, 3, 7, "b");
    r(10, 5, 3, 7, "b");
    r(2, 11, 4, 3, "b");
    r(9, 11, 4, 3, "b");
    r(3, 5, 3, 1, "a");
    r(10, 5, 3, 1, "a");
    r(2, 13, 4, 1, "d");
    r(9, 13, 4, 1, "d");
  }
  const original = grid.map((row) => [...row]);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if (
        original[y][x] === "." &&
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(
          ([dx, dy]) =>
            original[y + dy]?.[x + dx] && original[y + dy][x + dx] !== ".",
        )
      )
        grid[y][x] = "o";
  const colors = { b: p.base, l: p.light, d: p.shade, o: p.edge, a: p.accent };
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (p.family === "chainmail" && grid[y][x] === "b" && (x + y) % 2 === 1)
        continue;
      const c = colors[grid[y][x]];
      if (c) {
        ctx.fillStyle = c;
        ctx.fillRect(x * 2, y * 2, 2, 2);
      }
    }
  return true;
}
