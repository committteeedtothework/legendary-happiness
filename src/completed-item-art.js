// Remaining older utility/aquatic silhouettes. All previously refined sprites,
// weapons, armor, eggs and supplied native images retain their artwork.
export const COMPLETED_ITEM_IDS = [
  "cinder_sigil",
  "fishing_rod",
  "scute",
  "nautilus_shell",
  "heart_of_the_sea",
  "prismarine_crystals",
  "ink_sac",
  "nether_wart",
  "blaze_rod",
  "cod_bucket",
  "salmon_bucket",
  "tropical_fish_bucket",
  "pufferfish_bucket",
  "treasure_map",
  "glass_bottle",
  "water_bottle",
  "awkward_potion",
  "turtle_master_potion",
];
export function completedItemPixels(id) {
  if (!COMPLETED_ITEM_IDS.includes(id)) return null;
  const grid = Array.from({ length: 16 }, () => Array(16).fill(".")),
    palette = {
      d: "#303b43",
      s: "#687e85",
      m: "#a9c2c4",
      l: "#e0e4d5",
      w: "#eee8ce",
      a: "#976b43",
      A: "#d6ad6d",
      b: "#467ba9",
      c: "#71bdbb",
      g: "#608453",
      G: "#a3bc78",
      r: "#c36a5c",
      o: "#ebbd59",
      p: "#a18fbd",
    },
    put = (x, y, c) => {
      if (grid[y]?.[x] !== undefined) grid[y][x] = c;
    },
    rect = (x, y, w, h, c) => {
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++) put(i, j, c);
    };
  if (id === "fishing_rod") {
    for (let n = 0; n < 12; n++) {
      put(2 + n, 14 - n, "d");
      put(2 + n, 13 - n, n < 5 ? "a" : "A");
    }
    for (let y = 3; y < 12; y++) put(13, y, "l");
    put(12, 12, "s");
    put(11, 12, "l");
    put(10, 11, "l");
    rect(2, 12, 2, 2, "a");
  } else if (id.endsWith("_bucket")) {
    rect(3, 4, 10, 2, "d");
    rect(3, 6, 10, 5, "s");
    rect(4, 10, 8, 3, "s");
    rect(5, 13, 6, 1, "d");
    rect(4, 6, 8, 4, "b");
    rect(4, 10, 1, 2, "l");
    rect(5, 12, 6, 1, "m");
    rect(4, 4, 8, 1, "l");
    const fish =
      id === "salmon_bucket"
        ? "r"
        : id === "pufferfish_bucket"
          ? "o"
          : id === "tropical_fish_bucket"
            ? "o"
            : "A";
    rect(6, 7, 5, 2, fish);
    put(5, 7, fish);
    put(5, 9, fish);
    put(10, 7, "d");
    if (id === "tropical_fish_bucket") rect(7, 7, 1, 2, "c");
    if (id === "pufferfish_bucket") {
      put(7, 6, "o");
      put(8, 9, "o");
    }
  } else if (/bottle|potion/.test(id)) {
    rect(6, 1, 4, 2, "a");
    rect(6, 3, 4, 4, "s");
    rect(5, 6, 6, 1, "s");
    rect(4, 7, 8, 7, "s");
    rect(5, 14, 6, 1, "s");
    rect(5, 7, 6, 6, ".");
    rect(5, 8, 1, 3, "l");
    rect(6, 3, 1, 3, "m");
    if (id !== "glass_bottle") {
      rect(6, 10, 5, 3, id === "turtle_master_potion" ? "g" : "b");
      rect(6, 10, 4, 1, id === "turtle_master_potion" ? "G" : "c");
    }
    if (id === "awkward_potion") put(9, 2, "p");
    put(7, 13, "m");
    put(10, 8, "m");
  } else if (id === "treasure_map") {
    rect(2, 3, 11, 11, "a");
    rect(3, 2, 10, 11, "w");
    rect(2, 4, 1, 7, "A");
    rect(13, 4, 1, 9, "A");
    rect(4, 4, 2, 3, "g");
    rect(6, 5, 3, 1, "G");
    rect(8, 3, 2, 2, "g");
    rect(5, 8, 1, 2, "G");
    rect(7, 10, 2, 2, "g");
    for (let n = 0; n < 3; n++) {
      put(9 + n, 8 + n, "r");
      put(11 - n, 8 + n, "r");
    }
    rect(3, 13, 9, 1, "A");
  } else if (id === "nautilus_shell") {
    palette.m = "#d3ad87";
    palette.s = "#926b56";
    palette.l = "#efd1a5";
    for (let y = 2; y < 14; y++)
      for (let x = 2; x < 14; x++)
        if (Math.abs(x - 7.5) + Math.abs(y - 7.5) < 8) put(x, y, "m");
    for (const [x, y, w, h, c] of [
      [4, 3, 7, 2, "l"],
      [3, 5, 2, 6, "l"],
      [5, 11, 7, 2, "s"],
      [10, 6, 2, 5, "s"],
      [6, 5, 5, 1, "s"],
      [5, 5, 1, 5, "s"],
      [6, 9, 3, 1, "s"],
      [8, 7, 1, 2, "l"],
    ])
      rect(x, y, w, h, c);
  } else if (id === "scute") {
    for (let y = 4; y < 13; y++)
      for (let x = 2; x < 14; x++)
        if (Math.abs(x - 7.5) + (y < 7 ? 7 - y : 0) < 6)
          put(x, y, y === 4 || x < 4 ? "G" : "g");
    rect(4, 12, 8, 1, "d");
    rect(7, 6, 1, 6, "d");
    rect(4, 8, 8, 1, "d");
    put(5, 6, "G");
    put(10, 6, "G");
  } else if (id === "heart_of_the_sea") {
    palette.m = "#397eaa";
    palette.s = "#285676";
    palette.l = "#75bfc7";
    for (let y = 2; y < 14; y++)
      for (let x = 2; x < 14; x++)
        if (Math.abs(x - 7.5) + Math.abs(y - 7.5) < 8)
          put(x, y, x < 5 && y < 9 ? "l" : x > 10 || y > 10 ? "s" : "m");
    rect(5, 4, 3, 2, "w");
    rect(7, 7, 3, 3, "b");
  } else if (id === "prismarine_crystals") {
    for (const [x, y] of [
      [3, 7],
      [8, 3],
      [10, 9],
    ]) {
      rect(x, y, 3, 4, "c");
      rect(x, y, 1, 3, "l");
      put(x + 1, y - 1, "w");
      put(x + 2, y + 4, "s");
    }
  } else if (id === "ink_sac") {
    rect(7, 2, 3, 3, "s");
    rect(5, 5, 6, 6, "d");
    rect(4, 7, 8, 4, "d");
    rect(6, 11, 5, 2, "d");
    rect(6, 6, 2, 3, "s");
    put(10, 4, "l");
    put(5, 13, "s");
  } else if (id === "nether_wart") {
    for (const [x, y] of [
      [3, 8],
      [7, 4],
      [10, 9],
    ]) {
      rect(x, y, 3, 4, "r");
      rect(x, y, 1, 2, "o");
      put(x + 1, y - 1, "r");
      rect(x + 1, y + 4, 1, 2, "a");
    }
    rect(4, 13, 8, 1, "a");
  } else if (id === "blaze_rod") {
    for (let n = 0; n < 11; n++) {
      put(2 + n, 13 - n, "a");
      put(3 + n, 13 - n, "o");
      put(3 + n, 12 - n, "A");
    }
    put(13, 1, "w");
  } else if (id === "cinder_sigil") {
    for (let y = 1; y < 15; y++)
      for (let x = 1; x < 15; x++)
        if (Math.abs(x - 7.5) + Math.abs(y - 7.5) < 7)
          put(x, y, Math.abs(x - 7.5) + Math.abs(y - 7.5) > 5 ? "a" : "d");
    rect(7, 3, 2, 10, "o");
    rect(4, 6, 8, 2, "A");
    rect(7, 6, 2, 2, "w");
    put(10, 10, "r");
  }
  return { grid, palette };
}
export function paintCompletedItem(c, id) {
  const art = completedItemPixels(id);
  if (!art) return false;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const color = art.palette[art.grid[y][x]];
      if (color) {
        c.fillStyle = color;
        c.fillRect(x * 2, y * 2, 2, 2);
      }
    }
  return true;
}
