import { B, BLOCKS, ATLAS_COLS, ATLAS_ROWS } from "./data.js";
import { hash } from "./random.js";
// Original 16px aquatic art; applied only to the append-only ocean registry.
export function paintAquaticAtlas(canvas) {
  const c = canvas.getContext("2d");
  for (let id = B.prismarine; id < 199; id++)
    for (let face = 0; face < 3; face++) {
      const b = BLOCKS[id],
        ox = ((id * 3 + face) % ATLAS_COLS) * 16,
        oy = Math.floor((id * 3 + face) / ATLAS_COLS) * 16;
      c.clearRect(ox, oy, 16, 16);
      const draw = (color, x, y, w = 1, h = 1) => {
        c.fillStyle = color;
        c.fillRect(ox + x, oy + y, w, h);
      };
      if (b.plant) {
        const fan = b.coral?.form === "fan",
          wart = b.wart;
        for (let x = 1; x < 15; x++)
          for (let y = 1; y < 16; y++) {
            const v = hash(x, y, id),
              curve = Math.sin((y + x * 0.4) * 0.6) * 1.5;
            const on = wart
              ? y > 15 - wart * 3 && hash(Math.floor(x / 3), 0, 0, id) > 0.2
              : fan
                ? y > 10 && Math.abs(x - 8) < (y - 9) * 2
                : Math.abs(x - 8 - curve) < 1.6 ||
                  (y % 5 < 2 && Math.abs(x - 8) < 5 && v > 0.35);
            if (on)
              draw(v > 0.5 ? b.color : b.coral ? "#d6c3a5" : "#8cb36b", x, y);
          }
      } else if (b.pickles) {
        for (let i = 0; i < b.pickles; i++) {
          const x = 2 + (i % 2) * 7,
            y = 3 + Math.floor(i / 2) * 6;
          draw("#495938", x, y, 4, 6);
          draw(b.color, x + 1, y, 3, 5);
          draw("#d9df99", x + 1, y, 2, 1);
        }
      } else if (b.eggs) {
        for (let i = 0; i < b.eggs; i++) {
          const x = 2 + (i % 2) * 7,
            y = 2 + Math.floor(i / 2) * 7;
          draw("#89966e", x, y + 1, 5, 5);
          draw("#e8e3bc", x + 1, y, 4, 5);
          draw("#6c9c80", x + 2, y + 1, 1, 1);
          if (b.eggStage) draw("#7b826e", x + 2, y + 2, 1, 3);
        }
      } else
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++) {
            const n = hash(x >> 1, y >> 1, id),
              brick = b.key.includes("bricks"),
              line = brick && (y % 8 === 0 || (x + (y < 8 ? 0 : 8)) % 16 === 0);
            let color = b.color;
            if (line) color = "#427c7c";
            else if (b.key === "magma_block")
              color = x % 6 === 0 || y % 5 === 0 ? "#ef8b33" : "#76392e";
            else if (b.key === "sea_lantern")
              color =
                x < 2 || x > 13 || y < 2 || y > 13 ? "#74afa3" : "#d5f0d7";
            else if (b.key === "conduit")
              color =
                Math.abs(x - 8) + Math.abs(y - 8) < 5 ? "#dce8ba" : "#457b83";
            draw(color, x, y);
            if (n < 0.25) {
              c.fillStyle = "#183e3a25";
              c.fillRect(ox + x, oy + y, 1, 1);
            }
          }
    }
}
export function paintAquaticItem(c, id, item) {
  const color = item.color || "#97b5aa",
    px = (s, x, y, w, h) => {
      c.fillStyle = s;
      c.fillRect(x, y, w, h);
    };
  if (
    [
      "cod",
      "salmon",
      "tropical_fish",
      "pufferfish",
      "cooked_cod",
      "cooked_salmon",
    ].includes(id)
  ) {
    px("#344846", 8, 10, 18, 12);
    px(color, 10, 10, 14, 10);
    px("#e9daba", 10, 18, 14, 3);
    px(color, 3, 8, 6, 16);
    px("#203340", 21, 12, 2, 2);
    if (id.includes("tropical")) px("#efce73", 14, 10, 3, 10);
    return true;
  }
  if (id === "fishing_rod") {
    for (let i = 0; i < 23; i++)
      px(i % 2 ? "#b4a172" : "#685b43", 4 + Math.floor(i * 0.75), 27 - i, 2, 2);
    px("#b7c8c4", 23, 5, 1, 20);
    px("#cedbd4", 21, 24, 3, 2);
    return true;
  }
  if (id === "trident") {
    px("#365d68", 14, 10, 4, 21);
    px("#90c6bd", 15, 8, 2, 22);
    px("#8bc7bc", 6, 8, 19, 4);
    for (const x of [6, 14, 22]) {
      px("#3d6873", x, 1, 4, 9);
      px("#b8e5d4", x, 1, 2, 7);
    }
    return true;
  }
  if (id.includes("bottle") || id.includes("potion")) {
    px("#7eafb7", 9, 10, 15, 19);
    px("#c3dcd7", 11, 11, 11, 15);
    px(id === "glass_bottle" ? "#182b3233" : color, 12, 17, 9, 9);
    px("#88acb6", 14, 5, 5, 8);
    px("#bba577", 13, 3, 7, 3);
    return true;
  }
  if (id === "nautilus_shell") {
    px("#695c57", 5, 5, 23, 23);
    px("#d6b393", 7, 5, 19, 20);
    px("#f3d4ac", 7, 7, 14, 5);
    px("#795e59", 10, 12, 12, 10);
    px("#ddba9d", 12, 13, 8, 7);
    px("#88695d", 14, 15, 4, 3);
    return true;
  }
  if (id === "scute" || id === "turtle_shell") {
    px("#355b4a", 4, 9, 24, 15);
    px(color, 6, 7, 20, 15);
    px("#9abb7a", 9, 6, 14, 6);
    for (let x = 8; x < 25; x += 6) px("#436e52", x, 13, 2, 8);
    return true;
  }
  if (id === "treasure_map") {
    px("#635a49", 3, 5, 26, 23);
    px("#dac78c", 5, 4, 22, 22);
    for (let i = 0; i < 15; i++)
      px("#91ab81", 7 + i, 9 + Math.round(Math.sin(i) * 2), 1, 5);
    px("#ac4d45", 18, 18, 7, 2);
    px("#ac4d45", 21, 15, 2, 8);
    return true;
  }
  if (
    [
      "heart_of_the_sea",
      "prismarine_shard",
      "prismarine_crystals",
      "ink_sac",
      "nether_wart",
      "blaze_powder",
      "blaze_rod",
      "dried_kelp",
    ].includes(id)
  ) {
    for (let y = 4; y < 29; y++)
      for (let x = 3; x < 29; x++)
        if (Math.abs(x - 16) + Math.abs(y - 16) < 12)
          px((x + y) % 5 ? color : "#b7d9b4", x, y, 1, 1);
    return true;
  }
  if (item.fishBucket) {
    px("#3f5561", 6, 8, 21, 20);
    px("#b0c5c8", 7, 10, 19, 16);
    px("#528fae", 9, 11, 15, 8);
    px("#e5b575", 13, 12, 8, 5);
    px("#202e39", 18, 13, 2, 2);
    return true;
  }
  return false;
}
