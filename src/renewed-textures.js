import { BLOCKS, ATLAS_COLS, ATLAS_ROWS } from "./data.js";
import { hash } from "./random.js";

// Hand-authored procedural 16px motifs. This artwork is independent of any
// Minecraft resource pack; each face has material grain and quiet readable edges.
export function paintRenewedAtlas(canvas) {
  const c = canvas.getContext("2d");
  const stone = (x, y, seed) => {
    const row = Math.floor(y / 4),
      xx = (x + (row % 2) * 3) % 16,
      col = Math.floor(xx / 6);
    const seam = y % 4 === 0 || xx % 6 === 0;
    return seam
      ? -20
      : (hash(col, row, 0, seed) - 0.5) * 23 + (y % 4 === 1 ? 7 : 0);
  };
  for (let id = 1; id < 199; id++)
    for (let face = 0; face < 3; face++) {
      const b = BLOCKS[id],
        key = b.key,
        tile = id * 3 + face,
        ox = (tile % ATLAS_COLS) * 16,
        oy = Math.floor(tile / ATLAS_COLS) * 16;
      const natural =
        /^(grass|dirt|stone|sand|red_sand|gravel|snow|moss|clay|terracotta|wool|basalt|bedrock|obsidian|cinderstone|runestone|sandstone|planks|path|farmland)$/.test(
          key,
        );
      const log = key.endsWith("log"),
        leaf = key.includes("leaves"),
        ore = key.endsWith("_ore"),
        cobble = key === "cobble",
        brick = key.includes("bricks") || key === "brick";
      if (!natural && !log && !leaf && !ore && !cobble && !brick) continue;
      const image = c.getImageData(ox, oy, 16, 16),
        base = [1, 3, 5].map((i) => parseInt(b.color.slice(i, i + 2), 16));
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const i = (y * 16 + x) * 4,
            n = (hash(x, y, id, 117) - 0.5) * 11;
          let color = base,
            shade = n;
          if (key === "grass" && face === 1) {
            const hem = 3 + Math.floor(hash(x >> 1, 1, 0, 61) * 3);
            color = y < hem ? [108, 137, 68] : [127, 88, 60];
            shade = n + (y === hem ? -13 : 0);
          } else if (key === "grass" && face === 2) color = [127, 88, 60];
          else if (log) {
            if (face !== 1) {
              color = key === "birch_log" ? [202, 196, 173] : [159, 125, 80];
              const ring = Math.floor(
                Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)),
              );
              shade += (ring % 3 === 0 ? -25 : 7) + (x === 7 ? -9 : 0);
            } else {
              shade +=
                (hash(Math.floor(x / 3), Math.floor(y / 8), id, 123) - 0.5) *
                  34 +
                (x % 4 === 0 ? -20 : 0);
              if (key === "birch_log") {
                color = [208, 208, 187];
                if (
                  (y % 7 === 1 || y % 7 === 2) &&
                  hash(x >> 2, y >> 2, 0, 19) > 0.45
                )
                  shade = -105;
              }
            }
          } else if (ore) {
            color = [119, 125, 120];
            shade = n + stone(x, y, 57) * 0.25;
            for (const [cx, cy] of [
              [3, 4],
              [11, 3],
              [7, 10],
              [13, 13],
            ])
              if (
                Math.abs(x - cx) + Math.abs(y - cy) <
                2 + (hash(cx, cy, id) > 0.5 ? 1 : 0)
              ) {
                color = base;
                shade = n + (x <= cx && y <= cy ? 25 : -12);
              }
            if (key === "coal_ore") {
              if (color === base) color = [47, 49, 48];
            }
          } else if (cobble || brick || key === "runestone") {
            shade += stone(x, y, id);
            if (
              key === "runestone" &&
              ((x === 5 && y > 3 && y < 12) ||
                (y === 5 && x > 4 && x < 11) ||
                (x === 10 && y > 5 && y < 10))
            )
              shade -= 35;
          } else if (key === "planks") {
            const row = Math.floor(y / 4),
              seam = y % 4 === 0 || (x + row * 5) % 12 === 0;
            shade += seam
              ? -29
              : (y % 4 === 1 ? 12 : 0) + (hash(x >> 2, row, 1, 7) - 0.5) * 13;
          } else if (leaf) {
            const cluster = hash(x >> 2, y >> 2, id, 75);
            shade += (cluster - 0.5) * 34 + ((x + y) % 4 === 0 ? 9 : 0);
            // Keep the old authored alpha holes, so leaves remain cutout textures.
          } else if (key === "obsidian") {
            shade += stone(x, y, 321) * 0.55;
            if ((x + y * 2) % 13 === 0) color = [81, 61, 107];
          } else if (
            key === "basalt" ||
            key === "cinderstone" ||
            key === "stone" ||
            key === "bedrock"
          ) {
            shade += (hash(x >> 2, y >> 1, id, 215) - 0.5) * 16;
            if (y % 8 === 0 && x > 2 && x < 13) shade -= 8;
          } else if (key === "farmland")
            shade += x % 4 === 0 ? -24 : x % 4 === 1 ? 12 : 0;
          else if (key === "sand" || key === "red_sand" || key === "snow")
            shade = n * 0.5 + Math.sin((x + y * 2) * 0.7) * 2;
          else shade += (hash(x >> 1, y >> 1, id, 77) - 0.5) * 14;
          for (let ch = 0; ch < 3; ch++)
            image.data[i + ch] = Math.max(0, Math.min(255, color[ch] + shade));
        }
      c.putImageData(image, ox, oy);
    }
}
