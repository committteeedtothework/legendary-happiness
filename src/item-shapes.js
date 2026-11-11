import { ITEMS, BLOCKS } from "./data.js";
// Ordinary inventory sprites have no invented cuboid edges or pixel extrusion.
// Solid building blocks and deliberately modeled weapons keep their depth.
export function isFlatItem(id) {
  const item = ITEMS[id];
  if (!item) return false;
  if (item.artifactModel) return false;
  if (item.tool === "fishing_rod") return true;
  if (item.tool || id === "matthew_dual_pistols") return false;
  return (
    item.block === undefined ||
    BLOCKS[item.block].plant ||
    BLOCKS[item.block].door ||
    [
      "torch",
      "crop",
      "wild_grass",
      "poppy",
      "cornflower",
      "sugar_cane",
      "fern",
      "bamboo",
      "cobweb",
      "mine_rail",
    ].includes(id)
  );
}
