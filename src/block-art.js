import { B, BLOCKS, ATLAS_COLS, ATLAS_ROWS } from "./data.js";
// Extra directional faces use spare atlas cells, leaving saved block IDs intact.
export const EXTRA_ART_NAMES = [
  "furnace_front",
  "crafting_table_front",
  "chest_front",
];
export const EXTRA_ART = Object.fromEntries(
  EXTRA_ART_NAMES.map((name, i) => [name, 597 + i]),
);
const normals = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
export function blockArtTile(id, faceIndex, pack) {
  if (BLOCKS[id]?.snowLayers) id = B.snow;
  const axis = BLOCKS[id]?.state?.axis;
  const axisSlot =
    axis === "x"
      ? faceIndex < 2
        ? 0
        : 1
      : axis === "z"
        ? faceIndex > 3
          ? 0
          : 1
        : null;
  const slot = axisSlot ?? [1, 1, 0, 2, 1, 1][faceIndex];
  if (id === B.chest && ![2, 3, 5].includes(faceIndex))
    return id * 3 + (pack === "supplied" ? 1 : 2);
  if (pack === "supplied" && faceIndex === 5) {
    if (id === B.furnace) return EXTRA_ART.furnace_front;
    if (id === B.crafting_table) return EXTRA_ART.crafting_table_front;
    if (id === B.chest) return EXTRA_ART.chest_front;
  }
  return (BLOCKS[id]?.artTile ?? id * 3) + slot;
}
export function blockArtUV(id, faceIndex, u, v, pack) {
  const tile = blockArtTile(id, faceIndex, pack),
    block = BLOCKS[id];
  if (id === B.torch && (pack === "renewed" || pack === "soft")) {
    // Original 16px torch sprite: sides use only the two-pixel wooden stem.
    u = (7 + u * 2) / 16;
    v =
      faceIndex === 2
        ? (11 + v * 2) / 16
        : faceIndex === 3
          ? (v * 2) / 16
          : (v * 13) / 16;
  }
  if (pack === "supplied" && block?.door) {
    const facing = (block.door.facing + (block.door.open ? 3 : 0)) % 4;
    const n = normals[faceIndex];
    if (n[1]) {
      u = 0.125 + u * 0.75;
      v = 0.025 + v * 0.055;
    } else if ((facing % 2 === 0 && n[0]) || (facing % 2 === 1 && n[2])) {
      u = u * 0.125;
    } else if (facing >= 2) u = 1 - u;
  }
  return [
    ((tile % ATLAS_COLS) + 0.015 + u * 0.97) / ATLAS_COLS,
    1 - (Math.floor(tile / ATLAS_COLS) + 0.985 - v * 0.97) / ATLAS_ROWS,
  ];
}
