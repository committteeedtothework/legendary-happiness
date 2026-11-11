import { ITEMS } from "./data.js";
// Original 16px silhouettes replace the old food rectangles and generic blobs.
// Existing dedicated native art, equipment and supplied textures stay intact.
const KEPT_FOOD = new Set([
  "apple",
  "raw_meat",
  "cooked_meat",
  "bread",
  "rotten_flesh",
]);
export const REFINED_RESOURCES = new Set([
  "arrow",
  "beetroot_seeds",
  "bowl",
  "breeze_rod",
  "cocoa_beans",
  "ghast_tear",
  "glow_ink_sac",
  "honeycomb",
  "melon_seeds",
  "netherite_scrap",
  "netherite_upgrade_smithing_template",
  "pumpkin_seeds",
  "rabbit_foot",
  "rabbit_hide",
  "resin_brick",
  "shears",
  "spyglass",
]);
export const REFINED_ITEM_IDS = Object.keys(ITEMS).filter(
  (id) => (ITEMS[id].food && !KEPT_FOOD.has(id)) || REFINED_RESOURCES.has(id),
);
const shade = (hex, f) =>
  "#" +
  [1, 3, 5]
    .map((i) =>
      Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
export function refinedItemPixels(id) {
  if (!REFINED_ITEM_IDS.includes(id)) return null;
  const g = Array.from({ length: 16 }, () => Array(16).fill(".")),
    pal = {
      b: "#bd7d4b",
      l: "#e8bc7d",
      d: "#75432e",
      o: "#3c3030",
      w: "#e9dfbe",
      g: "#557d3a",
      G: "#9bb963",
      r: "#b84e56",
      s: "#6c343c",
      k: "#39353d",
      a: "#d09d54",
    };
  const P = (x, y, c) => {
      if (g[y]?.[x] !== undefined) g[y][x] = c;
    },
    R = (x, y, w, h, c) => {
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++) P(i, j, c);
    },
    L = (x, y, X, Y, c) => {
      let n = Math.max(Math.abs(X - x), Math.abs(Y - y));
      for (let i = 0; i <= n; i++)
        P(
          Math.round(x + ((X - x) * i) / (n || 1)),
          Math.round(y + ((Y - y) * i) / (n || 1)),
          c,
        );
    };
  const oval = (x, y, w, h, c) => {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++)
        if (
          ((i + 0.5 - w / 2) / (w / 2)) ** 2 +
            ((j + 0.5 - h / 2) / (h / 2)) ** 2 <=
          1
        )
          P(x + i, y + j, c);
  };
  const cooked = id.startsWith("cooked_"),
    meat = /chicken|mutton|porkchop|rabbit$/.test(id) && !id.includes("stew");
  if (meat) {
    Object.assign(pal, {
      b: cooked ? "#a46736" : "#dc8a85",
      l: cooked ? "#dda35b" : "#f3b4a3",
      d: cooked ? "#6f3c2b" : "#b65d68",
      w: "#f1dec0",
    });
    if (id.includes("chicken")) {
      oval(4, 3, 8, 8, "b");
      R(3, 6, 2, 4, "d");
      R(11, 6, 2, 4, "d");
      L(5, 10, 4, 13, "b");
      L(10, 10, 11, 13, "b");
      R(3, 13, 3, 1, "w");
      R(10, 13, 3, 1, "w");
      R(6, 4, 3, 2, "l");
      R(6, 8, 4, 2, "l");
    } else if (id.endsWith("rabbit")) {
      oval(5, 4, 6, 7, "b");
      L(6, 9, 3, 12, "b");
      L(9, 9, 12, 12, "b");
      R(2, 12, 3, 1, "w");
      R(11, 12, 3, 1, "w");
      L(6, 4, 4, 2, "b");
      L(9, 4, 11, 2, "b");
      R(6, 5, 2, 2, "l");
    } else if (id.includes("mutton")) {
      oval(3, 2, 9, 8, "b");
      oval(4, 3, 5, 5, "l");
      oval(5, 4, 3, 3, "d");
      L(9, 9, 12, 13, "w");
      R(11, 12, 3, 2, "w");
      P(4, 8, "l");
    } else {
      oval(2, 4, 12, 8, "b");
      R(3, 10, 10, 2, "w");
      L(3, 5, 10, 5, "l");
      P(11, 6, "l");
      L(6, 7, 9, 8, "d");
    }
  } else if (/cod|salmon|tropical_fish|pufferfish/.test(id)) {
    if (id === "pufferfish") {
      Object.assign(pal, { b: "#d7b951", l: "#f2db83", d: "#9d793a" });
      oval(3, 3, 10, 10, "b");
      for (const [x, y] of [
        [3, 2],
        [7, 1],
        [12, 3],
        [14, 7],
        [12, 12],
        [7, 14],
        [2, 11],
        [1, 6],
      ])
        P(x, y, "d");
      R(5, 4, 3, 2, "l");
      P(10, 6, "k");
      P(6, 10, "d");
      P(4, 8, "d");
    } else {
      Object.assign(pal, {
        b: id.includes("salmon")
          ? cooked
            ? "#c3845b"
            : "#b65c58"
          : id === "tropical_fish"
            ? "#e6ad51"
            : cooked
              ? "#bd9660"
              : "#b9b18d",
        l: "#e0d3a5",
        d: id.includes("salmon") ? "#536e5b" : "#786d57",
      });
      oval(5, 5, 9, 6, "b");
      L(1, 4, 4, 7, "d");
      L(1, 11, 4, 8, "d");
      R(1, 5, 2, 6, "b");
      L(7, 5, 9, 3, "d");
      L(7, 10, 9, 12, "d");
      R(6, 9, 6, 1, "l");
      P(12, 6, "k");
      if (id === "tropical_fish") {
        pal.a = "#3d9bba";
        R(7, 5, 2, 5, "a");
        R(11, 6, 1, 3, "w");
      }
    }
  } else if (/stew|soup/.test(id) || id === "bowl") {
    oval(2, 6, 12, 7, "d");
    R(3, 9, 10, 3, "b");
    R(5, 12, 6, 1, "d");
    oval(2, 4, 12, 6, "l");
    oval(3, 5, 10, 4, "d");
    if (id !== "bowl") {
      const topping =
        id === "beetroot_soup"
          ? "r"
          : id === "rabbit_stew"
            ? "b"
            : id === "suspicious_stew"
              ? "g"
              : "w";
      R(4, 6, 8, 2, topping);
      P(5, 5, "g");
      P(9, 6, "g");
      P(7, 7, id === "mushroom_stew" ? "r" : "l");
    }
  } else if (/carrot/.test(id)) {
    Object.assign(pal, {
      b: id === "golden_carrot" ? "#e5b736" : "#d87832",
      l: id === "golden_carrot" ? "#fff18a" : "#f3b052",
      d: "#93602d",
    });
    for (let y = 4; y < 14; y++) {
      const width = Math.max(1, Math.floor((14 - y) / 2));
      R(8 - Math.floor(width / 2), y, width, 1, "b");
      if (y < 10) P(7, y, "l");
    }
    L(7, 4, 4, 1, "g");
    L(8, 4, 9, 1, "G");
    L(8, 4, 12, 3, "g");
    P(8, 7, "d");
    P(7, 10, "d");
  } else if (/potato/.test(id)) {
    oval(3, 3, 10, 10, "b");
    oval(4, 4, 6, 6, "l");
    P(5, 6, "d");
    P(10, 8, "d");
    P(7, 10, "d");
    if (id === "baked_potato") {
      L(5, 5, 11, 10, "w");
      L(5, 6, 10, 10, "w");
    }
    if (id === "poisonous_potato") {
      R(7, 3, 4, 3, "g");
      R(3, 8, 3, 2, "g");
      P(8, 4, "G");
    }
  } else if (id === "beetroot") {
    pal.b = "#a94863";
    pal.l = "#d37b81";
    pal.d = "#66364f";
    oval(4, 5, 8, 7, "b");
    L(7, 11, 9, 14, "d");
    L(7, 5, 4, 2, "g");
    L(8, 5, 9, 1, "G");
    L(8, 4, 12, 3, "g");
    R(5, 6, 2, 2, "l");
  } else if (/berries/.test(id)) {
    pal.r = id === "glow_berries" ? "#e8aa42" : "#bb425c";
    pal.l = id === "glow_berries" ? "#ffe59a" : "#f09a91";
    for (const [x, y] of [
      [3, 7],
      [8, 5],
      [7, 10],
      [11, 9],
    ]) {
      oval(x, y, 4, 4, "r");
      P(x + 1, y + 1, "l");
    }
    L(4, 6, 11, 3, "g");
    R(6, 3, 3, 2, "G");
  } else if (/golden_apple/.test(id)) {
    pal.b = "#dfae39";
    pal.l = "#fff1a0";
    pal.d = "#9c6e2d";
    oval(3, 5, 10, 9, "b");
    R(5, 5, 2, 3, "l");
    P(7, 3, "d");
    P(7, 4, "d");
    R(9, 2, 3, 2, "g");
    if (id === "enchanted_golden_apple") {
      pal.a = "#bb6ad9";
      P(3, 4, "a");
      P(12, 11, "a");
      P(8, 7, "a");
    }
  } else if (id === "melon_slice") {
    for (let y = 4; y < 13; y++)
      R(
        2 + Math.floor((y - 4) / 2),
        y,
        12 - (y - 4),
        1,
        y > 10 ? "g" : y === 10 ? "w" : "r",
      );
    P(4, 5, "k");
    P(8, 6, "k");
    P(6, 8, "k");
  } else if (id === "cookie" || id === "pumpkin_pie") {
    oval(2, 3, 12, 11, "b");
    oval(3, 3, 10, 8, "l");
    if (id === "cookie") {
      for (const [x, y] of [
        [5, 5],
        [10, 6],
        [7, 9],
        [4, 10],
        [10, 11],
      ])
        P(x, y, "d");
    } else {
      pal.l = "#dc9444";
      L(4, 10, 10, 5, "d");
      L(5, 11, 11, 6, "d");
      R(4, 12, 8, 1, "b");
    }
  } else if (id === "honey_bottle") {
    pal.b = "#d8a137";
    pal.l = "#f6da82";
    pal.d = "#8b6232";
    R(6, 1, 4, 2, "d");
    R(6, 3, 4, 3, "w");
    R(4, 6, 8, 7, "w");
    R(5, 7, 6, 5, "b");
    R(5, 7, 1, 4, "l");
    R(6, 13, 4, 1, "d");
  } else if (id === "dried_kelp") {
    pal.b = "#426745";
    pal.l = "#8a9b58";
    pal.d = "#2d483b";
    R(4, 3, 8, 10, "b");
    R(3, 5, 1, 6, "d");
    R(6, 4, 2, 8, "l");
    R(9, 5, 2, 6, "d");
    P(5, 12, "d");
    P(11, 3, "d");
  } else if (id === "spider_eye") {
    oval(3, 4, 10, 8, "s");
    oval(5, 5, 6, 6, "r");
    R(7, 6, 2, 4, "k");
    P(6, 6, "l");
  } else if (id === "arrow") {
    L(3, 13, 12, 4, "b");
    L(4, 13, 13, 4, "l");
    R(11, 2, 3, 3, "w");
    P(14, 1, "w");
    P(12, 5, "d");
    L(2, 9, 5, 12, "w");
    L(3, 10, 6, 13, "w");
  } else if (id.endsWith("_seeds") || id === "cocoa_beans") {
    pal.b =
      id === "beetroot_seeds"
        ? "#995448"
        : id === "cocoa_beans"
          ? "#825332"
          : "#c0a75c";
    pal.l =
      id === "melon_seeds"
        ? "#e1d3ad"
        : id === "cocoa_beans"
          ? "#b17c45"
          : "#e3cf7d";
    for (const [x, y] of [
      [3, 5],
      [8, 3],
      [10, 9],
      [4, 11],
    ]) {
      R(x, y, 3, 2, "b");
      P(x, y, "l");
      P(x + 2, y + 2, "d");
    }
  } else if (id === "honeycomb") {
    pal.b = "#d2a03a";
    pal.l = "#ffe18b";
    pal.d = "#92612c";
    for (const [x, y] of [
      [5, 2],
      [2, 7],
      [8, 7],
    ]) {
      R(x, y, 5, 5, "b");
      R(x + 1, y + 1, 3, 2, "d");
      L(x, y, x + 3, y, "l");
    }
  } else if (id === "shears") {
    pal.b = "#9dabad";
    pal.l = "#e3e5d9";
    pal.d = "#6c4b32";
    L(4, 2, 9, 9, "b");
    L(11, 2, 6, 9, "l");
    R(3, 10, 4, 4, "d");
    R(9, 10, 4, 4, "d");
    R(4, 11, 2, 2, ".");
    R(10, 11, 2, 2, ".");
    P(7, 8, "l");
  } else if (id === "spyglass" || id === "breeze_rod") {
    pal.b = id === "spyglass" ? "#b48a42" : "#78b2b3";
    pal.l = id === "spyglass" ? "#f0cf7a" : "#c6e5d9";
    pal.d = id === "spyglass" ? "#765634" : "#4b718f";
    for (let i = 0; i < 10; i++) {
      R(3 + i, 12 - i, 2, 2, "b");
      P(3 + i, 12 - i, "l");
    }
    if (id === "spyglass") {
      pal.a = "#7bc5d2";
      R(10, 2, 4, 3, "l");
      P(12, 2, "a");
    } else {
      P(2, 11, "l");
      P(13, 4, "l");
    }
  } else if (id === "rabbit_foot") {
    oval(5, 5, 5, 8, "b");
    R(5, 3, 2, 4, "w");
    R(4, 10, 7, 3, "l");
    P(5, 12, "d");
    P(8, 12, "d");
  } else if (id === "rabbit_hide") {
    R(5, 5, 6, 6, "b");
    R(4, 2, 2, 5, "l");
    R(10, 2, 2, 5, "l");
    R(3, 6, 2, 3, "b");
    R(11, 6, 2, 3, "b");
    R(4, 10, 3, 3, "d");
    R(9, 10, 3, 3, "d");
    R(6, 6, 3, 3, "l");
  } else if (id === "ghast_tear" || id === "glow_ink_sac") {
    pal.b = id === "ghast_tear" ? "#c3d9dc" : "#386e78";
    pal.l = id === "ghast_tear" ? "#f1f0e0" : "#8ee3cd";
    pal.d = "#385363";
    for (let y = 2; y < 12; y++) {
      const half = Math.min(4, Math.floor((y - 1) / 2));
      R(8 - half, y, Math.max(1, half * 2), 1, "b");
    }
    R(6, 6, 2, 4, "l");
    R(6, 12, 4, 1, "d");
  } else if (id === "netherite_upgrade_smithing_template") {
    pal.b = "#6e586a";
    pal.l = "#b48d91";
    pal.d = "#352f3f";
    R(4, 2, 8, 12, "b");
    R(5, 3, 6, 10, "d");
    L(8, 4, 8, 10, "l");
    L(6, 6, 8, 4, "l");
    L(8, 4, 10, 6, "l");
  } else if (id === "resin_brick" || id === "netherite_scrap") {
    pal.b = id === "resin_brick" ? "#b96530" : "#5b4b4b";
    pal.l = id === "resin_brick" ? "#eca757" : "#99807e";
    pal.d = id === "resin_brick" ? "#743a27" : "#302b35";
    R(3, 5, 10, 7, "b");
    R(4, 4, 8, 2, "l");
    L(4, 10, 11, 10, "d");
    if (id === "resin_brick") R(7, 6, 1, 4, "d");
    else {
      R(3, 5, 2, 2, ".");
      P(12, 11, ".");
      R(7, 6, 3, 2, "d");
    }
  } else throw Error("Missing refined item artwork: " + id);
  const src = g.map((r) => [...r]),
    outside = new Set(),
    pending = [];
  const add = (x, y) => {
    const key = y * 16 + x;
    if (
      x >= 0 &&
      x < 16 &&
      y >= 0 &&
      y < 16 &&
      src[y][x] === "." &&
      !outside.has(key)
    ) {
      outside.add(key);
      pending.push([x, y]);
    }
  };
  for (let i = 0; i < 16; i++) {
    add(i, 0);
    add(i, 15);
    add(0, i);
    add(15, i);
  }
  while (pending.length) {
    const [x, y] = pending.pop();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      add(x + dx, y + dy);
  }
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if (
        outside.has(y * 16 + x) &&
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(
          ([dx, dy]) => src[y + dy]?.[x + dx] && src[y + dy][x + dx] !== ".",
        )
      )
        g[y][x] = "o";
  return { id, width: 16, height: 16, grid: g, palette: pal };
}
export function paintRefinedItem(c, id) {
  const p = refinedItemPixels(id);
  if (!p) return false;
  c.imageSmoothingEnabled = false;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const color = p.palette[p.grid[y][x]];
      if (color) {
        c.fillStyle = color;
        c.fillRect(x * 2, y * 2, 2, 2);
      }
    }
  return true;
}

// These older generic registry colors made all dye piles/nuggets look gray.
const COLORS = {
  white_dye: "#e6e5d8",
  orange_dye: "#df8236",
  magenta_dye: "#b95aa3",
  light_blue_dye: "#6cafd0",
  yellow_dye: "#e8c64b",
  lime_dye: "#8eb44b",
  pink_dye: "#df9baf",
  gray_dye: "#5c6266",
  light_gray_dye: "#b5bab5",
  cyan_dye: "#3d9299",
  purple_dye: "#8252a1",
  blue_dye: "#425fb1",
  brown_dye: "#785338",
  green_dye: "#546c36",
  red_dye: "#ad3b46",
  black_dye: "#30313b",
  amethyst_shard: "#aa8ccc",
  quartz: "#e4ddd0",
  gold_nugget: "#e2bb57",
  iron_nugget: "#c5cfca",
  copper_nugget: "#c3815a",
  glowstone_dust: "#d7b763",
  magma_cream: "#dc893f",
  netherite_ingot: "#584b52",
};
export const REFINED_COLOR_IDS = Object.keys(COLORS).filter((id) => ITEMS[id]);
export function visualInventoryItem(id) {
  const item = ITEMS[id];
  return item && COLORS[id] ? { ...item, color: COLORS[id] } : item;
}
