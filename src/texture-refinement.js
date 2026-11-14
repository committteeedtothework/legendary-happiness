import { BLOCKS, ATLAS_COLS, ATLAS_ROWS } from "./data.js";
import { blockArtUV } from "./block-art.js";
// Remove isolated high-frequency flecks from opaque material faces, without
// blurring ore seams, type markings, foliage cutouts or neighboring atlas cells.
export function refineMaterialFaces(canvas, pack) {
  const ctx = canvas.getContext("2d"),
    seen = new Set();
  for (let id = 1; id < BLOCKS.length; id++) {
    const b = BLOCKS[id];
    if (!/wool|concrete|terracotta|end_stone$|purpur/.test(b.key) || b.internal)
      continue;
    for (let f = 0; f < 6; f++) {
      const [u, v] = blockArtUV(id, f, 0.5, 0.5, pack),
        x = Math.floor(u * ATLAS_COLS) * 16,
        y = Math.floor((1 - v) * ATLAS_ROWS) * 16,
        key = x + "," + y;
      if (seen.has(key)) continue;
      seen.add(key);
      const img = ctx.getImageData(x, y, 16, 16),
        copy = new Uint8ClampedArray(img.data);
      for (let j = 0; j < 16; j++)
        for (let i = 0; i < 16; i++)
          for (let c = 0; c < 3; c++) {
            const values = [];
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++) {
                const a = Math.max(0, Math.min(15, i + dx)),
                  d = Math.max(0, Math.min(15, j + dy));
                values.push(copy[(d * 16 + a) * 4 + c]);
              }
            values.sort((a, b) => a - b);
            const n = (j * 16 + i) * 4 + c,
              median = values[4];
            img.data[n] =
              Math.abs(copy[n] - median) > 11
                ? Math.round(copy[n] * 0.25 + median * 0.75)
                : copy[n];
          }
      ctx.putImageData(img, x, y);
    }
  }
}
