import { ITEMS, BLOCKS, CREATIVE_ITEMS } from "./data.js";
// UI-only categories; inventory IDs and the authoritative Creative registry stay stable.
export const CREATIVE_TABS = [
  { id: "building", name: "Building Blocks", icon: "brick", row: "top" },
  { id: "colors", name: "Colored Blocks", icon: "cyan_concrete", row: "top" },
  { id: "natural", name: "Natural Blocks", icon: "grass", row: "top" },
  {
    id: "functional",
    name: "Functional Blocks",
    icon: "bookshelf",
    row: "top",
  },
  {
    id: "redstone",
    name: "Redstone & Mechanisms",
    icon: "redstone",
    row: "top",
  },
  { id: "search", name: "Search Items", icon: "compass", row: "top" },
  {
    id: "tools",
    name: "Tools & Travel",
    icon: "diamond_pickaxe",
    row: "bottom",
  },
  {
    id: "combat",
    name: "Combat & Armor",
    icon: "diamond_sword",
    row: "bottom",
  },
  { id: "food", name: "Food & Drinks", icon: "golden_apple", row: "bottom" },
  { id: "ingredients", name: "Ingredients", icon: "iron_ingot", row: "bottom" },
  { id: "spawn", name: "Spawn Eggs", icon: "creeper_spawn_egg", row: "bottom" },
  { id: "stands", name: "Stands", icon: "palm_tablet", row: "bottom" },
  {
    id: "inventory",
    name: "Player Inventory & Crafting",
    icon: "chest",
    row: "bottom",
  },
];
const categories = new Set(
  CREATIVE_TABS.filter(
    (t) => !["search", "stands", "inventory"].includes(t.id),
  ).map((t) => t.id),
);
export function creativeCategory(id) {
  const item = ITEMS[id];
  if (!item) return null;
  const block = BLOCKS[item.block];
  if (item.spawnType) return "spawn";
  if (id === "redstone") return "redstone";
  if (
    item.armorSlot !== undefined ||
    ["sword", "spear", "trident", "pistols", "mace"].includes(item.tool) ||
    ["bow", "crossbow", "shield", "arrow"].includes(id)
  )
    return "combat";
  if (item.food || (/potion|_bottle$/.test(id) && id !== "glass_bottle"))
    return "food";
  if (
    item.tool ||
    item.boat ||
    /bucket$/.test(id) ||
    [
      "flint_and_steel",
      "shears",
      "spyglass",
      "compass",
      "clock",
      "treasure_map",
    ].includes(id)
  )
    return "tools";
  if (block) {
    if (
      /^(white|orange|magenta|light_blue|yellow|lime|pink|gray|light_gray|cyan|purple|blue|brown|green|red|black)_(wool|concrete|terracotta|stained_glass|carpet|bed)/.test(
        id,
      ) ||
      id === "wool"
    )
      return "colors";
    if (
      /redstone|^tnt$|rail|piston|observer|hopper|dispenser|dropper|lever|button|pressure_plate|repeater|comparator/.test(
        id,
      ) &&
      !/_ore$/.test(id)
    )
      return "redstone";
    if (
      block.station ||
      block.door ||
      ["gate", "trapdoor", "ladder", "lantern", "chain", "pot"].includes(
        block.shape,
      ) ||
      /table|chest|furnace|barrel|bookshelf|jukebox|torch|lantern|conduit|brewing_stand|^bed$/.test(
        id,
      )
    )
      return "functional";
    if (
      block.plant ||
      block.foliage ||
      block.crop ||
      /^poppy$|^cornflower$|^wild_grass$|^fern$|^sugar_cane$|^bamboo$|^cobweb$|ore$|leaves|sapling|coral|kelp|seagrass|mushroom|^grass$|^dirt$|^sand$|^red_sand$|^gravel$|^snow$|^ice$|_ice$|^moss$|cactus|dripstone|sea_pickle|turtle_egg|soul_sand|^clay$|^ash$|podzol|mycelium|rooted_dirt/.test(
        id,
      )
    )
      return "natural";
    return "building";
  }
  if (
    item.plant ||
    id === "seeds" ||
    id.endsWith("_seeds") ||
    ["sweet_berries", "glow_berries", "nether_wart"].includes(id)
  )
    return "natural";
  if (item.musicDisc) return "functional";
  return "ingredients";
}
const materials = [
  "oak",
  "spruce",
  "birch",
  "jungle",
  "acacia",
  "dark_oak",
  "mangrove",
  "cherry",
  "pale_oak",
  "bamboo",
  "crimson",
  "warped",
  "poplar",
  "stone",
  "cobblestone",
  "granite",
  "diorite",
  "andesite",
  "deepslate",
  "tuff",
  "sandstone",
  "mud",
  "brick",
  "quartz",
  "prismarine",
  "blackstone",
  "basalt",
  "nether",
  "copper",
  "iron",
  "gold",
  "diamond",
  "netherite",
  "hellfire",
];
const colors = [
  "white",
  "light_gray",
  "gray",
  "black",
  "brown",
  "red",
  "orange",
  "yellow",
  "lime",
  "green",
  "cyan",
  "light_blue",
  "blue",
  "purple",
  "magenta",
  "pink",
];
function material(id) {
  if (
    [
      "log",
      "planks",
      "leaves",
      "wooden_pickaxe",
      "wooden_axe",
      "wooden_shovel",
      "wooden_hoe",
      "wooden_sword",
    ].includes(id)
  )
    return 0;
  if (id.startsWith("pine_")) return 1;
  const key = id
    .replace(/^stripped_|^waxed_|^oxidized_|^weathered_|^exposed_/g, "")
    .replace(/^golden_/, "gold_");
  const matches = materials
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => key === m || key.startsWith(m + "_"))
    .sort((a, b) => b.m.length - a.m.length);
  return matches[0]?.i ?? 99;
}
function shapeOrder(id) {
  return /(_log$|^log$|_stem$)/.test(id)
    ? 0
    : /_wood$|_hyphae$/.test(id)
      ? 1
      : /planks/.test(id)
        ? 2
        : /stairs/.test(id)
          ? 3
          : /slab/.test(id)
            ? 4
            : /fence_gate/.test(id)
              ? 6
              : /fence/.test(id)
                ? 5
                : /trapdoor/.test(id)
                  ? 8
                  : /door/.test(id)
                    ? 7
                    : 9;
}
function colorOrder(id) {
  return colors.findIndex((c) => id.startsWith(c + "_"));
}
const order = [...categories];
export const CREATIVE_ENTRIES = Object.freeze(
  CREATIVE_ITEMS.map((id, index) =>
    Object.freeze({ id, index, category: creativeCategory(id) }),
  ).sort((a, b) => {
    const category = order.indexOf(a.category) - order.indexOf(b.category);
    if (category) return category;
    if (a.category === "colors") {
      const type = (id) =>
        id.replace(
          /^(light_blue|light_gray|white|orange|magenta|yellow|lime|pink|gray|cyan|purple|blue|brown|green|red|black)_/,
          "",
        );
      const t = type(a.id).localeCompare(type(b.id), "en");
      if (t) return t;
      return colorOrder(a.id) - colorOrder(b.id);
    }
    return (
      material(a.id) - material(b.id) ||
      shapeOrder(a.id) - shapeOrder(b.id) ||
      ITEMS[a.id].name.localeCompare(ITEMS[b.id].name, "en", { numeric: true })
    );
  }),
);
export function creativeEntries(category = "search", query = "") {
  if (category !== "search" && !categories.has(category)) return [];
  const words = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return CREATIVE_ENTRIES.filter(
    (e) =>
      (category === "search" || e.category === category) &&
      words.every((w) =>
        (ITEMS[e.id].name + " " + e.id.replaceAll("_", " "))
          .toLowerCase()
          .includes(w),
      ),
  );
}
export function creativeWindow(count, scrollTop, rowHeight, visibleRows = 5) {
  const height = Math.max(1, Number(rowHeight) || 1),
    rows = Math.max(visibleRows, Math.ceil(count / 9)),
    maxTop = Math.max(0, (rows - visibleRows) * height);
  const top = Math.max(0, Math.min(maxTop, Number(scrollTop) || 0));
  const row = Math.max(0, Math.floor(top / height) - 1),
    start = row * 9,
    end = Math.min(rows * 9, (row + visibleRows + 2) * 9);
  return {
    start,
    end,
    offset: row * height,
    height: rows * height,
    scrollTop: top,
  };
}
