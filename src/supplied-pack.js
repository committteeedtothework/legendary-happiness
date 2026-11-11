import {
  SUPPLIED_BLOCKS,
  SUPPLIED_ITEMS,
  SUPPLIED_PIXELS,
} from "./supplied-pack-data.js";
import { EXTRA_ART } from "./block-art.js";
import { ATLAS_COLS } from "./data.js";

const images = new Map();
// No async image loading or network dependency: this also works from file://.
export function suppliedImage(name) {
  if (images.has(name)) return images.get(name);
  const encoded = SUPPLIED_PIXELS[name];
  if (!encoded) return null;
  const raw = atob(encoded),
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const context = canvas.getContext("2d"),
    pixels = context.createImageData(16, 16);
  let offset = 0;
  for (let i = 0; i < raw.length; i += 5)
    for (let n = 0; n < raw.charCodeAt(i); n++)
      for (let c = 1; c <= 4; c++)
        pixels.data[offset++] = raw.charCodeAt(i + c);
  if (offset !== 16 * 16 * 4)
    throw new Error("Invalid supplied texture: " + name);
  context.putImageData(pixels, 0, 0);
  images.set(name, canvas);
  return canvas;
}
export function suppliedBlockFaces(block) {
  return SUPPLIED_BLOCKS[
    block.door ? `oak_door_${block.door.upper ? "upper" : "lower"}` : block.key
  ];
}
export function paintSuppliedAtlas(canvas, blocks, columns = ATLAS_COLS) {
  const context = canvas.getContext("2d");
  for (const [id, block] of blocks.entries()) {
    // Modern material states share independent edition-owned tiles. Painting
    // them at numeric-ID offsets overwrites unrelated cells and runs off-atlas.
    if (block.edition) continue;
    const faces = suppliedBlockFaces(block);
    if (!faces) continue;
    for (let face = 0; face < 3; face++) {
      const tile = (block.artTile ?? id * 3) + face,
        x = (tile % columns) * 16,
        y = Math.floor(tile / columns) * 16;
      context.clearRect(x, y, 16, 16);
      const image = suppliedImage("block/" + faces[face]);
      if (block.key === "torch") {
        const rect =
          face === 0
            ? [7, 6, 2, 2]
            : face === 2
              ? [7, 14, 2, 2]
              : [7, 6, 2, 10];
        context.imageSmoothingEnabled = false;
        context.drawImage(image, ...rect, x, y, 16, 16);
      } else context.drawImage(image, x, y);
    }
  }
  for (const [name, tile] of Object.entries(EXTRA_ART)) {
    const x = (tile % columns) * 16,
      y = Math.floor(tile / columns) * 16;
    context.clearRect(x, y, 16, 16);
    context.drawImage(suppliedImage("block/" + name), x, y);
  }
}
export function suppliedItemImage(id) {
  return SUPPLIED_ITEMS[id]
    ? suppliedImage(
        SUPPLIED_ITEMS[id].includes("/")
          ? SUPPLIED_ITEMS[id]
          : "item/" + SUPPLIED_ITEMS[id],
      )
    : null;
}
