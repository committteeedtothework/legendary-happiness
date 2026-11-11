import { ITEMS } from "./data.js";

// Original, integer-pixel source art. Icons and every world/view model share
// these pixels; no supplied pack, gradient, image resampler or copied skin.
export const WEAPON_FAMILIES = new Set([
  "sword",
  "spear",
  "trident",
  "mace",
  "axe",
  "pickaxe",
  "shovel",
  "hoe",
]);
export const isWeapon = (id) =>
  !!ITEMS[id] &&
  (WEAPON_FAMILIES.has(ITEMS[id].tool) ||
    ["bow", "crossbow", "shield", "matthew_dual_pistols"].includes(id));
export const WEAPON_IDS = Object.keys(ITEMS).filter(isWeapon);
const MATERIALS = {
  dirt: ["#493329", "#846043", "#b39565", "#302a25"],
  wooden: ["#49331f", "#90633b", "#c49b5a", "#30271c"],
  stone: ["#45494c", "#83898c", "#b6bcb8", "#2d3335"],
  copper: ["#6c3628", "#bd7049", "#edaa6d", "#422b27"],
  iron: ["#687677", "#bdc9c4", "#edf1d7", "#384747"],
  golden: ["#8d5d20", "#e4b63e", "#fff18c", "#513d22"],
  diamond: ["#12665f", "#3abcb7", "#a1f1dc", "#163c40"],
  netherite: ["#35303e", "#605362", "#97868d", "#231f2b"],
  hellfire: ["#762b30", "#d55335", "#ffc273", "#352635"],
};
export function weaponPalette(id) {
  const material = id.split("_")[0],
    p = MATERIALS[material] || MATERIALS.iron;
  return {
    o: p[3],
    d: p[0],
    b: p[1],
    l: p[2],
    h: "#78502e",
    H: "#b38b50",
    g: p[0],
    G: "#cfab62",
    r: "#d9ffff",
    s: "#e4ddbc",
    w: "#ae7c44",
    W: "#e1b976",
    m: "#555d61",
    M: "#b9c4c4",
    k: "#292d34",
    ...(id === "trident"
      ? { b: "#40998f", l: "#a1d7ba", d: "#2d6d68", h: "#30776e", H: "#64b3a0" }
      : {}),
    ...(id === "devin_sword"
      ? {
          o: "#194d5d",
          b: "#38c9d4",
          l: "#a6f8ed",
          d: "#217f9e",
          h: "#e0ae36",
          H: "#ffe494",
          g: "#f0c957",
          G: "#9e7026",
        }
      : {}),
    ...(id === "mace"
      ? { b: "#737d8c", l: "#b1c7c7", d: "#444c67", h: "#684636", H: "#ba9567" }
      : {}),
  };
}
function canvas(width, height, anchor, unit = 1 / 16) {
  const grid = Array.from({ length: height }, () => Array(width).fill("."));
  const put = (x, y, c) => {
    if (grid[y]?.[x] !== undefined) grid[y][x] = c;
  };
  const rect = (x, y, w, h, c) => {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) put(i, j, c);
  };
  const line = (x, y, X, Y, c) => {
    const n = Math.max(Math.abs(X - x), Math.abs(Y - y));
    for (let i = 0; i <= n; i++)
      put(
        Math.round(x + ((X - x) * i) / (n || 1)),
        Math.round(y + ((Y - y) * i) / (n || 1)),
        c,
      );
  };
  return { width, height, anchor, unit, grid, put, rect, line };
}
function outlined(p) {
  const a = p.grid.map((r) => [...r]);
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++)
      if (
        a[y][x] === "." &&
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => a[y + dy]?.[x + dx] && a[y + dy][x + dx] !== ".")
      )
        p.grid[y][x] = "o";
  return p;
}
export function weaponPixels(id, stage = 0) {
  if (!isWeapon(id) || id === "matthew_dual_pistols") return null;
  const item = ITEMS[id],
    kind = item.tool || id,
    long = ["spear", "trident"].includes(kind),
    legendary = id === "devin_sword";
  const p = canvas(
      legendary ? 24 : 16,
      long ? 32 : legendary ? 32 : 16,
      long ? [7.5, 24.5] : legendary ? [11.5, 25.5] : [4.5, 12.5],
      long ? 0.0375 : legendary ? 0.03125 : 1 / 16,
    ),
    { rect: R, line: L, put: P } = p;
  if (legendary) {
    R(10, 21, 3, 9, "h");
    R(10, 29, 3, 1, "g");
    for (let y = 23; y < 29; y += 2) R(10, y, 3, 1, "G");
    R(3, 20, 17, 2, "g");
    R(2, 19, 3, 2, "g");
    R(18, 19, 3, 2, "g");
    R(9, 19, 5, 4, "g");
    R(10, 20, 3, 2, "r");
    R(8, 9, 7, 10, "b");
    R(9, 5, 5, 4, "b");
    R(10, 2, 3, 3, "l");
    P(11, 1, "r");
    L(9, 9, 9, 18, "l");
    L(13, 9, 13, 18, "d");
    L(11, 5, 11, 18, "r");
    for (let y = 10; y < 18; y += 3) {
      P(10, y, "l");
      P(12, y + 1, "d");
    }
  } else if (long) {
    R(7, kind === "trident" ? 10 : 9, 2, 22, "h");
    L(7, 12, 7, 29, "H");
    if (kind === "trident") {
      R(3, 8, 10, 3, "b");
      for (const x of [3, 7, 11]) {
        R(x, 2, 2, 7, "b");
        P(x, 1, "l");
        L(x, 3, x, 8, "l");
      }
      R(7, 9, 2, 4, "d");
    } else {
      R(6, 4, 4, 5, "b");
      R(7, 2, 2, 2, "l");
      P(7, 1, "l");
      L(6, 5, 6, 8, "l");
      R(6, 9, 4, 2, "g");
      R(7, 12, 2, 1, "G");
    }
  } else if (kind === "bow") {
    p.anchor = [12.5, 8];
    const bend = Math.min(3, stage),
      x = 8 - bend;
    L(x, 1, x + 3, 4, "W");
    L(x + 3, 4, x + 4, 7, "w");
    L(x + 4, 7, x + 4, 9, "h");
    L(x + 4, 9, x + 3, 12, "w");
    L(x + 3, 12, x, 15, "W");
    L(x, 2, 4 - bend, 8, "s");
    L(4 - bend, 8, x, 14, "s");
    if (stage) {
      L(3 - bend, 8, 14, 8, "H");
      P(14, 7, "M");
      P(15, 8, "M");
      P(14, 9, "M");
    }
  } else if (kind === "crossbow") {
    p.anchor = [7.5, 11.5];
    L(4, 14, 11, 4, "w");
    L(5, 14, 12, 4, "W");
    L(2, 4, 5, 7, "w");
    L(5, 7, 8, 8, "W");
    L(8, 8, 11, 8, "w");
    L(11, 8, 14, 5, "W");
    L(2, 5, 8, 11 - stage, "s");
    L(8, 11 - stage, 14, 6, "s");
    R(7, 8, 3, 2, "m");
    if (stage >= 2) {
      L(6, 13, 13, 3, "M");
      P(13, 2, "l");
    }
  } else if (kind === "shield") {
    const q = canvas(12, 22, [6, 11], 1 / 32);
    q.rect(0, 0, 12, 20, "m");
    q.rect(1, 1, 10, 18, "w");
    q.rect(2, 2, 8, 16, "W");
    for (const x of [4, 8]) q.rect(x, 2, 1, 16, "w");
    for (const y of [2, 17]) for (const x of [1, 10]) q.put(x, y, "M");
    q.rect(1, 20, 10, 1, "m");
    q.rect(2, 21, 8, 1, "m");
    return {
      ...q,
      id,
      kind,
      depth: 0.045,
      palette: weaponPalette(id),
      legendary: false,
    };
  } else {
    // An asymmetric diagonal handle/head, drawn on the same 16px grid as icons.
    L(2, 14, 9, 7, "h");
    L(3, 14, 9, 8, "H");
    if (kind === "sword") {
      L(6, 9, 13, 2, "b");
      L(7, 9, 14, 2, "b");
      L(6, 8, 12, 2, "l");
      L(8, 9, 14, 3, "d");
      P(14, 1, "l");
      L(4, 6, 9, 11, "g");
      L(4, 7, 8, 11, "b");
      P(2, 14, "g");
    } else if (kind === "pickaxe" || kind === "hoe") {
      L(4, 2, 10, 2, "l");
      L(5, 3, 12, 4, "b");
      L(11, 4, 14, 7, "b");
      L(13, 6, 13, 10, "d");
      P(14, 10, "b");
      if (kind === "pickaxe") {
        P(3, 3, "b");
        P(3, 4, "d");
        P(4, 4, "b");
      } else {
        L(4, 3, 4, 6, "b");
      }
    } else if (kind === "axe") {
      R(7, 2, 4, 3, "b");
      R(10, 4, 4, 4, "b");
      R(9, 3, 4, 4, "b");
      L(7, 2, 10, 2, "l");
      L(12, 4, 13, 5, "l");
      L(10, 8, 13, 8, "d");
      P(13, 7, "d");
    } else if (kind === "mace") {
      R(8, 2, 5, 6, "b");
      R(6, 3, 8, 4, "b");
      R(8, 1, 4, 1, "d");
      R(7, 3, 2, 3, "l");
      R(12, 3, 2, 4, "d");
      R(9, 4, 2, 2, "m");
      L(5, 10, 8, 7, "G");
    } else {
      R(10, 2, 3, 4, "b");
      R(9, 3, 5, 2, "b");
      L(10, 2, 12, 2, "l");
      L(13, 3, 13, 5, "d");
      P(9, 6, "d");
    }
  }
  outlined(p);
  return {
    ...p,
    id,
    kind,
    depth: legendary ? 0.04 : 1 / 16,
    palette: weaponPalette(id),
    legendary,
  };
}
export function pistolPixels(dark = false, part = "all") {
  const p = canvas(24, 16, [5.5, 10.5], 0.01875),
    { rect: R, put: P } = p;
  if (part === "all" || part === "body") {
    R(3, 7, 4, 8, "h");
    R(2, 13, 4, 2, "h");
    R(2, 15, 5, 1, "o");
    R(3, 7, 19, 2, "b");
    R(7, 9, 1, 3, "d");
    R(7, 12, 5, 1, "b");
    R(11, 9, 1, 3, "b");
    R(9, 9, 1, 2, "G");
    R(4, 9, 2, 4, "H");
    P(4, 9, "l");
    P(4, 13, "l");
    P(5, 11, "G");
    R(11, 8, 11, 1, "d");
  }
  if (part === "all" || part === "slide") {
    R(2, 3, 21, 4, "b");
    R(3, 3, 19, 1, "l");
    R(2, 6, 21, 1, "d");
    R(21, 2, 1, 1, "o");
    R(3, 2, 2, 1, "o");
    for (let x = 4; x < 10; x += 2) R(x, 4, 1, 2, "d");
    R(12, 4, 3, 1, "G");
    R(17, 4, 4, 1, "l");
    R(22, 4, 1, 2, "o");
  }
  if (part === "all" || part === "hammer") {
    R(1, 5, 1, 3, "d");
    P(0, 5, "G");
  }
  return {
    ...p,
    id: "matthew_dual_pistols",
    kind: "pistols",
    depth: 0.075,
    palette: {
      o: "#1e2631",
      d: dark ? "#282e3a" : "#687980",
      b: dark ? "#475363" : "#b3c7cf",
      l: dark ? "#7b909d" : "#e0f0ee",
      h: "#70452f",
      H: "#aa7549",
      G: "#d4b769",
    },
  };
}
export function paintWeaponIcon(ctx, id) {
  if (!isWeapon(id)) return false;
  ctx.imageSmoothingEnabled = false;
  const paint = (p, x, y, scale) => {
    for (let j = 0; j < p.height; j++)
      for (let i = 0; i < p.width; i++) {
        const c = p.palette[p.grid[j][i]];
        if (c) {
          ctx.fillStyle = c;
          ctx.fillRect(x + i * scale, y + j * scale, scale, scale);
        }
      }
  };
  if (id === "matthew_dual_pistols") {
    paint(pistolPixels(false), 0, 0, 1);
    paint(pistolPixels(true), 8, 16, 1);
  } else {
    const p = weaponPixels(id),
      scale = Math.max(1, Math.floor(32 / Math.max(p.width, p.height)));
    paint(
      p,
      Math.floor((32 - p.width * scale) / 2),
      Math.floor((32 - p.height * scale) / 2),
      scale,
    );
  }
  return true;
}
