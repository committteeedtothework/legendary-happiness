import {
  appendEditionBlocks,
  appendEditionItems,
  EDITION_AUDIT,
} from "./edition-data.js";
import {
  appendAquaticBlocks,
  appendAquaticItems,
  appendAquaticMobs,
} from "./aquatic-data.js";
export const VERSION = "2.18.0";
export const GENERATION_VERSION = 16;
export const REFERENCE =
  "Java Edition 26.3 (content); custom survival mechanics";
export const MIN_Y = -64,
  MAX_Y = 319,
  CHUNK = 16,
  SEA = 62;
// Default artwork, models and sounds are original; the optional supplied pack is attributed separately.
const blocks = [
  ["air", "Air", "#ffffff", 0],
  ["grass", "Grass block", "#708b47", 0.6, "shovel", 0, "dirt"],
  ["dirt", "Dirt", "#866044", 0.5, "shovel"],
  ["stone", "Stone", "#858a83", 1.5, "pickaxe", 1, "cobble"],
  ["sand", "Sand", "#d6c18b", 0.5, "shovel"],
  ["water", "Water", "#528ca3", 100],
  ["log", "Oak log", "#746047", 2, "axe"],
  ["leaves", "Oak leaves", "#527c42", 0.2],
  ["planks", "Oak planks", "#b29261", 2, "axe"],
  ["cobble", "Cobblestone", "#7c817a", 2, "pickaxe", 1],
  ["coal_ore", "Coal ore", "#777f78", 3, "pickaxe", 1, "coal"],
  ["iron_ore", "Iron ore", "#9c9284", 3, "pickaxe", 2, "raw_iron"],
  ["diamond_ore", "Diamond ore", "#72c9c5", 3, "pickaxe", 3, "diamond"],
  ["bedrock", "Bedrock", "#3c4140", Infinity],
  ["crafting_table", "Crafting table", "#a58155", 2.5, "axe"],
  ["furnace", "Furnace", "#676f6b", 3.5, "pickaxe", 1],
  ["chest", "Chest", "#ae804b", 2.5, "axe"],
  ["glass", "Glass", "#bbdfda", 0.3],
  ["torch", "Torch", "#ffc568", 0],
  ["gravel", "Gravel", "#91918a", 0.6, "shovel"],
  ["farmland", "Farmland", "#6f4b30", 0.6, "shovel", "", "dirt"],
  ["crop", "Wheat crop", "#79a447", 0],
  ["brick", "Bricks", "#ac7761", 2, "pickaxe", 1],
  ["snow", "Snow block", "#d6e4df", 0.2, "shovel"],
  ["basalt", "Basalt", "#555b5a", 1.25, "pickaxe", 1],
  ["wool", "Wool", "#ddd7bf", 0.8],
  ["bed", "Camp bed", "#b9624c", 0.2, "axe"],
  ["obsidian", "Obsidian", "#362d4e", 50, "pickaxe", 4],
  ["portal", "Cinderwild portal", "#9a4ed4", Infinity],
  ["cinderstone", "Cinderstone", "#834c45", 1.5, "pickaxe", 1],
  ["emberglass", "Emberglass", "#ffb45b", 0.8, "pickaxe", 1],
  ["lava", "Lava", "#ee7133", 100],
  ["path", "Village path", "#a38a52", 0.65, "shovel", 0, "dirt"],
  ["wild_grass", "Wild grass", "#6d9940", 0],
  ["poppy", "Red meadow flower", "#cf4539", 0],
  ["cornflower", "Blue meadow flower", "#6b86dc", 0],
  ["sandstone", "Sandstone", "#d2bc82", 0.8, "pickaxe", 1],
];
export const BLOCKS = blocks.map(
  ([key, name, color, hardness, tool, tier = 0, drop]) => ({
    key,
    name,
    color,
    hardness,
    tool,
    tier,
    drop: drop || key,
    solid: ![
      "air",
      "water",
      "torch",
      "crop",
      "portal",
      "lava",
      "wild_grass",
      "poppy",
      "cornflower",
    ].includes(key),
    transparent: [
      "air",
      "water",
      "glass",
      "torch",
      "crop",
      "portal",
      "lava",
      "leaves",
      "wild_grass",
      "poppy",
      "cornflower",
    ].includes(key),
  }),
);
// Append-only state IDs keep every existing saved block ID stable.
for (let facing = 0; facing < 4; facing++)
  for (const open of [false, true])
    for (const upper of [false, true])
      BLOCKS.push({
        key:
          facing === 0 && !open && !upper
            ? "oak_door"
            : `oak_door_${facing}_${open ? "open" : "closed"}_${upper ? "upper" : "lower"}`,
        name: "Oak door",
        color: "#ae8651",
        hardness: 3,
        tool: "axe",
        tier: 0,
        drop: "oak_door",
        solid: true,
        transparent: true,
        door: { facing, open, upper },
      });
for (const b of [
  {
    key: "devin_relic_base",
    name: "The Devin Sword · ancient stone",
    color: "#384e61",
    hardness: Infinity,
    solid: true,
    transparent: true,
    relic: "base",
  },
  {
    key: "devin_relic_blade",
    name: "The Devin Sword · hold left click for 30 seconds",
    color: "#5ce8ed",
    hardness: Infinity,
    solid: false,
    transparent: true,
    relic: "blade",
  },
  {
    key: "enchanting_table",
    name: "Enchanting table",
    color: "#513f76",
    hardness: 5,
    tool: "pickaxe",
    tier: 1,
    solid: true,
    transparent: false,
  },
  {
    key: "lapis_ore",
    name: "Lapis ore",
    color: "#365eb6",
    hardness: 3,
    tool: "pickaxe",
    tier: 2,
    drop: "lapis_lazuli",
    solid: true,
    transparent: false,
  },
  {
    key: "sugar_cane",
    name: "Sugar cane",
    color: "#8eb44f",
    hardness: 0,
    solid: false,
    transparent: true,
  },
])
  BLOCKS.push({ ...b, tier: b.tier || 0, drop: b.drop || b.key });
// New terrain blocks append after all v0.5 IDs.
for (const [key, name, color, tool, hardness, extra] of [
  ["pine_log", "Pine log", "#665039", "axe", 2, {}],
  [
    "pine_leaves",
    "Pine needles",
    "#3f725b",
    null,
    0.2,
    { transparent: true, foliage: true },
  ],
  ["birch_log", "Birch log", "#d9d8c5", "axe", 2, {}],
  [
    "birch_leaves",
    "Birch leaves",
    "#80a54c",
    null,
    0.2,
    { transparent: true, foliage: true },
  ],
  ["terracotta", "Terracotta", "#b6724d", "pickaxe", 1.25, { tier: 1 }],
  ["red_sand", "Red sand", "#b98445", "shovel", 0.5, {}],
  ["moss", "Moss block", "#66864d", "hoe", 0.1, {}],
  ["cactus", "Cactus", "#759047", null, 0.4, { transparent: true }],
  [
    "fern",
    "Fern",
    "#56885c",
    null,
    0,
    { solid: false, transparent: true, plant: true },
  ],
  ["ice", "Ice", "#94c6d7", "pickaxe", 0.5, { transparent: true }],
])
  BLOCKS.push({
    key,
    name,
    color,
    tool,
    hardness,
    tier: 0,
    drop: key,
    solid: true,
    transparent: false,
    ...extra,
  });
// Generator-7 additions remain append-only, within the existing 16x16 atlas.
for (const [key, name, color, hardness, tier, drop, extra] of [
  ["hellfire_ore", "Hellfire ore", "#ea7440", 5, 4, "raw_hellfire", {}],
  ["brimstone_ore", "Brimstone ore", "#ddbb41", 3.5, 3, "brimstone", {}],
  ["ash", "Volcanic ash", "#66616c", 0.7, 0, "ash", { tool: "shovel" }],
  ["ashen_log", "Ashen log", "#5f475c", 2, 0, "ashen_log", { tool: "axe" }],
  [
    "ember_leaves",
    "Ember canopy",
    "#ba564f",
    0.3,
    0,
    "ember_leaves",
    { transparent: true, foliage: true },
  ],
  ["cinder_bricks", "Cinder bricks", "#703e4c", 3, 2, "cinder_bricks", {}],
  [
    "glow_crystal",
    "Cinder crystal",
    "#e5a657",
    1.5,
    2,
    "glow_crystal",
    { transparent: true },
  ],
  ["runestone", "Temple runestone", "#557b8d", 4, 2, "runestone", {}],
  [
    "bamboo",
    "Jungle bamboo",
    "#7b9f46",
    0.1,
    0,
    "bamboo",
    { tool: "axe", solid: false, transparent: true, plant: true },
  ],
])
  BLOCKS.push({
    key,
    name,
    color,
    hardness,
    tier,
    drop,
    tool: "pickaxe",
    solid: true,
    transparent: false,
    ...extra,
  });
// Release 1.2 content is appended: saved numeric IDs never move.
for (const [key, name, color, hardness, tool, tier, drop] of [
  ["copper_ore", "Copper ore", "#bd7859", 3, "pickaxe", 2, "raw_copper"],
  ["gold_ore", "Gold ore", "#d3b84e", 3, "pickaxe", 3, "raw_gold"],
  ["emerald_ore", "Emerald ore", "#45b47e", 3, "pickaxe", 3, "emerald"],
  ["coal_block", "Block of coal", "#303431", 5, "pickaxe", 1],
  ["iron_block", "Block of iron", "#c8d6d4", 5, "pickaxe", 2],
  ["copper_block", "Block of copper", "#be7958", 3, "pickaxe", 2],
  ["gold_block", "Block of gold", "#e5c453", 3, "pickaxe", 3],
  ["diamond_block", "Block of diamond", "#64cfca", 5, "pickaxe", 3],
  ["lapis_block", "Block of lapis", "#3d5fa8", 3, "pickaxe", 2],
  ["emerald_block", "Block of emerald", "#46b780", 5, "pickaxe", 3],
  ["raw_iron_block", "Block of raw iron", "#b99d88", 5, "pickaxe", 2],
  ["raw_copper_block", "Block of raw copper", "#ac7960", 5, "pickaxe", 2],
  ["raw_gold_block", "Block of raw gold", "#c7a74e", 5, "pickaxe", 3],
  ["stone_bricks", "Stone bricks", "#92988f", 1.5, "pickaxe", 1],
  ["mossy_stone_bricks", "Mossy stone bricks", "#7a8c66", 1.5, "pickaxe", 1],
  [
    "cracked_stone_bricks",
    "Cracked stone bricks",
    "#777e78",
    1.5,
    "pickaxe",
    1,
  ],
  ["smooth_stone", "Smooth stone", "#a0a49b", 2, "pickaxe", 1],
  ["granite", "Granite", "#a47d6c", 1.5, "pickaxe", 1],
  ["diorite", "Diorite", "#c0c3b4", 1.5, "pickaxe", 1],
  ["andesite", "Andesite", "#818e8a", 1.5, "pickaxe", 1],
  ["clay", "Clay", "#9cabb5", 0.6, "shovel", 0, "clay_ball"],
  ["packed_ice", "Packed ice", "#8cb8d0", 0.5, "pickaxe", 0],
  ["hay_bale", "Hay bale", "#bca555", 0.5, "hoe", 0],
  ["bookshelf", "Bookshelf", "#a17f51", 1.5, "axe", 0],
  ["tnt", "TNT", "#c25d42", 0, null, 0],
])
  BLOCKS.push({
    key,
    name,
    color,
    hardness,
    tool,
    tier,
    drop: drop || key,
    solid: true,
    transparent: false,
  });
BLOCKS.push({
  key: "temple_seal",
  name: "Guardian seal · defeat all three Guardians",
  color: "#61cad4",
  hardness: Infinity,
  tier: 0,
  solid: true,
  transparent: true,
  internal: true,
});
BLOCKS.push({
  key: "fire",
  name: "Fire",
  color: "#f3b44e",
  hardness: 0,
  tier: 0,
  solid: false,
  transparent: true,
  internal: true,
  plant: true,
});
BLOCKS.push({
  key: "primed_tnt",
  name: "Primed TNT",
  color: "#eaa576",
  hardness: Infinity,
  tier: 0,
  solid: false,
  transparent: true,
  internal: true,
});
// Fluid levels are real, persistent block states, shared by physics and workers.
for (const type of ["water", "lava"]) {
  const source = BLOCKS.find((b) => b.key === type);
  source.fluid = { type, level: 0, source: true, falling: false };
  for (let level = 1; level <= 8; level++)
    BLOCKS.push({
      ...source,
      key: `${type}_flow_${level}`,
      name: `Flowing ${type}`,
      internal: true,
      fluid: {
        type,
        level: level === 8 ? 0 : level,
        source: false,
        falling: level === 8,
      },
    });
}
BLOCKS.push({
  key: "matthew_altar",
  name: "Matthew’s Rift Altar",
  color: "#56384f",
  hardness: Infinity,
  tier: 0,
  solid: true,
  internal: true,
});
// Append-only jukebox ID: every existing block/state remains unchanged.
BLOCKS.push({
  key: "jukebox",
  name: "Jukebox",
  color: "#79583e",
  hardness: 2,
  tool: "axe",
  tier: 0,
  drop: "jukebox",
  solid: true,
  transparent: false,
});
BLOCKS.push({
  key: "infernal_seal",
  name: "Infernal ward · defeat all six defenders",
  color: "#ff7b39",
  hardness: Infinity,
  solid: true,
  transparent: true,
  internal: true,
  tier: 0,
});
BLOCKS.push({
  key: "riftstone",
  name: "Titan's prison stone",
  color: "#392832",
  hardness: Infinity,
  solid: true,
  transparent: false,
  internal: true,
  tier: 0,
});
BLOCKS.push({
  key: "trial_exit",
  name: "Titan return rune",
  color: "#65c5dc",
  hardness: Infinity,
  solid: true,
  transparent: false,
  internal: true,
  tier: 0,
});
BLOCKS.push(
  {
    key: "dripstone",
    name: "Dripstone",
    color: "#a98065",
    hardness: 1.5,
    solid: true,
    transparent: false,
    tool: "pickaxe",
    tier: 0,
    drop: "dripstone",
  },
  {
    key: "cobweb",
    name: "Cobweb",
    color: "#dddcd3",
    hardness: 2,
    solid: false,
    transparent: true,
    tool: "sword",
    tier: 0,
    drop: "string",
  },
  {
    key: "mine_rail",
    name: "Abandoned mine rail",
    color: "#9e9280",
    hardness: 0.5,
    solid: false,
    transparent: true,
    tier: 0,
    drop: "mine_rail",
    bounds: [0, 0, 0, 1, 0.04, 1],
  },
);
// Appended IDs preserve every older world's blocks. Snow is simulated through
// the normal edit layer, so workers, saves and co-op use the same block states.
for (let layers = 1; layers <= 8; layers++)
  BLOCKS.push({
    key: `snow_layer_${layers}`,
    name: `Snow · ${layers}/8 layers`,
    color: "#d6e4df",
    hardness: 0.1,
    tool: "shovel",
    tier: 0,
    solid: true,
    transparent: true,
    internal: true,
    snowLayers: layers,
    bounds: [0, 0, 0, 1, layers / 8, 1],
    drop: null,
  });
appendAquaticBlocks(BLOCKS);
appendEditionBlocks(BLOCKS);
export const ATLAS_COLS = 32,
  ATLAS_ROWS = 128;
export const B = Object.fromEntries(BLOCKS.map((b, i) => [b.key, i]));
export const ITEMS = Object.fromEntries(
  BLOCKS.slice(1)
    .filter(
      (b) =>
        !b.relic &&
        !b.internal &&
        b.key !== "water" &&
        b.key !== "bedrock" &&
        b.key !== "crop" &&
        b.key !== "farmland" &&
        b.key !== "portal" &&
        b.key !== "lava" &&
        (!b.door || b.key === "oak_door" || b.key === b.door.item),
    )
    .map(({ tool: miningTool, ...b }) => [
      b.key,
      { ...b, stack: 64, block: B[b.key] },
    ]),
);
function item(key, name, color, extra = {}) {
  ITEMS[key] = { key, name, color, stack: 64, ...extra };
}
item("matthew_dual_pistols", "Matthew's Dual Wielded Pistols", "#d7a6dc", {
  stack: 1,
  tool: "pistols",
  attack: 2,
  speed: 1,
  tier: 0,
  unbreakable: true,
});
item("stick", "Stick", "#b29160");
item("coal", "Coal", "#3a4042");
item("charcoal", "Charcoal", "#414642");
item("raw_copper", "Raw copper", "#b97d60");
item("copper_ingot", "Copper ingot", "#cf8d69");
item("raw_gold", "Raw gold", "#d5b451");
item("gold_ingot", "Gold ingot", "#e8ca58");
item("clay_ball", "Clay ball", "#a4b2bd");
item("brick_item", "Brick", "#b5785d");
item("bucket", "Bucket", "#bccbd0", { stack: 1 });
item("water_bucket", "Water bucket", "#638fb9", { stack: 1 });
item("lava_bucket", "Lava bucket", "#ef8a39", { stack: 1 });
item("raw_iron", "Raw iron", "#c3a58e");
item("iron_ingot", "Iron ingot", "#dce2df");
item("diamond", "Diamond", "#65d7ce");
item("raw_hellfire", "Raw Hellfire", "#db663b");
item("hellfire_ingot", "Hellfire ingot", "#f4994c");
item("brimstone", "Brimstone", "#d6bc4d");
item("hellfire_alloy", "Hellfire alloy", "#ffae62");
item("cinder_sigil", "Cinder Sigil · key to the Devin Temple", "#ffbd62", {
  stack: 16,
});
item("seeds", "Wheat seeds", "#8aab54", { plant: true });
item("wheat", "Wheat", "#d6bb66");
item("apple", "Apple", "#bc5e46", { food: 4, saturation: 2.4 });
item("raw_meat", "Raw meat", "#c27d73", { food: 3, saturation: 1.8 });
item("cooked_meat", "Cooked meat", "#9a6450", { food: 8, saturation: 12.8 });
item("bread", "Bread", "#c59c58", { food: 5, saturation: 6 });
for (const [material, tier, speed, durability, color, attack] of [
  ["dirt", 0, 1.2, 12, "#876347", 2],
  ["wooden", 1, 2, 59, "#ad8d59", 4],
  ["golden", 1, 12, 32, "#e8c75d", 4],
  ["stone", 2, 4, 131, "#929b94", 5],
  ["iron", 3, 6, 250, "#d5e3df", 6],
  ["diamond", 4, 8, 1561, "#61c6c0", 7],
  ["hellfire", 5, 10, 2031, "#ff9c56", 8],
]) {
  for (const type of ["pickaxe", "axe", "shovel", "sword", "hoe"])
    item(
      `${material}_${type}`,
      `${material[0].toUpperCase() + material.slice(1)} ${type}`,
      color,
      {
        stack: 1,
        tool: type,
        tier,
        speed,
        durability,
        attack:
          type === "sword"
            ? attack
            : type === "axe"
              ? material === "dirt"
                ? 2
                : attack + 3
              : 1,
      },
    );
}
item("leather", "Leather", "#a07a53");
item("flint", "Flint", "#51535f");
item("emerald", "Emerald", "#39c66a");
item("feather", "Feather", "#eee9db");
item("rotten_flesh", "Rotten flesh", "#8a7251", { food: 4, saturation: 0.8 });
item("bone", "Bone", "#d8d4b7");
item("bone_meal", "Bone meal", "#e5dfce");
item("string", "String", "#ddd9cb");
item("gunpowder", "Gunpowder", "#595b58");
item("flint_and_steel", "Flint and steel", "#bec4cc", {
  stack: 1,
  durability: 64,
});
item("lapis_lazuli", "Lapis lazuli", "#416bd1");
item("paper", "Paper", "#eee6ca");
item("book", "Book", "#9b5c3e");
export const ARMOR_SLOTS = ["helmet", "chestplate", "leggings", "boots"];
for (const [material, ingredient, points, durability, toughness, color] of [
  ["dirt", "dirt", [0.5, 1, 0.5, 0.5], [8, 12, 10, 8], 0, "#876347"],
  ["leather", "leather", [1, 3, 2, 1], [55, 80, 75, 65], 0, "#a07149"],
  ["golden", "gold_ingot", [2, 5, 3, 1], [77, 112, 105, 91], 0, "#dfbc55"],
  ["iron", "iron_ingot", [2, 6, 5, 2], [165, 240, 225, 195], 0, "#cad5de"],
  ["diamond", "diamond", [3, 8, 6, 3], [363, 528, 495, 429], 2, "#58d2cf"],
  [
    "hellfire",
    "hellfire_alloy",
    [3, 8, 6, 3],
    [450, 650, 610, 530],
    3,
    "#ef9551",
  ],
])
  ARMOR_SLOTS.forEach((slot, i) =>
    item(
      `${material}_${slot}`,
      `${material[0].toUpperCase() + material.slice(1)} ${slot}`,
      color,
      {
        stack: 1,
        armorSlot: i,
        armor: points[i],
        toughness,
        durability: durability[i],
        ingredient,
      },
    ),
  );
for (const [material, color, damage, durability] of [
  ["dirt", "#876347", 2, 12],
  ["wooden", "#ae8c53", 5, 59],
  ["stone", "#919c9a", 6, 131],
  ["iron", "#cddce2", 7, 250],
  ["diamond", "#5bd5d0", 8, 1561],
  ["hellfire", "#ff9c56", 9, 2031],
])
  item(
    `${material}_spear`,
    `${material[0].toUpperCase() + material.slice(1)} spear`,
    color,
    {
      stack: 1,
      tool: "spear",
      attack: damage,
      reach: 4.25,
      cooldown: 1,
      durability,
    },
  );
item("devin_sword", "The Devin Sword", "#64eaf1", {
  stack: 1,
  tool: "sword",
  attack: 10,
  reach: 3.5,
  cooldown: 0.8,
  legendary: true,
  unbreakable: true,
});
export const FUELS = {
  coal_block: 16000,
  lava_bucket: 20000,
  bookshelf: 300,

  brimstone: 2400,
  ashen_log: 300,
  bamboo: 50,
  coal: 1600,
  charcoal: 1600,
  log: 300,
  planks: 300,
  stick: 100,
  wooden_pickaxe: 200,
  wooden_axe: 200,
  wooden_sword: 200,
}; // 20 Hz ticks
export const SMELTS = {
  raw_copper: "copper_ingot",
  raw_gold: "gold_ingot",
  clay_ball: "brick_item",
  clay: "terracotta",
  stone: "smooth_stone",
  stone_bricks: "cracked_stone_bricks",
  raw_hellfire: "hellfire_ingot",
  ashen_log: "charcoal",
  raw_iron: "iron_ingot",
  sand: "glass",
  cobble: "stone",
  log: "charcoal",
  raw_meat: "cooked_meat",
};
// Each recipe has an actual shaped grid (spaces are empty) or shapeless ingredient list.
export const RECIPES = [];
const shaped = (id, result, count, pattern, key) =>
  RECIPES.push({ id, result, count, pattern, key });
const shapeless = (id, result, count, ingredients) =>
  RECIPES.push({ id, result, count, ingredients });
shapeless("planks", "planks", 4, ["log"]);
shaped("sticks", "stick", 4, ["P", "P"], { P: "planks" });
shaped("table", "crafting_table", 1, ["PP", "PP"], { P: "planks" });
shaped("furnace", "furnace", 1, ["CCC", "C C", "CCC"], { C: "cobble" });
shaped("chest", "chest", 1, ["PPP", "P P", "PPP"], { P: "planks" });
shaped("torch", "torch", 4, ["C", "S"], { C: "coal", S: "stick" });
shaped("charcoal_torch", "torch", 4, ["C", "S"], { C: "charcoal", S: "stick" });
shaped("bread", "bread", 1, ["WWW"], { W: "wheat" });
shaped("bed", "bed", 1, ["WWW", "PPP"], { W: "wool", P: "planks" });
for (const [material, ing] of [
  ["dirt", "dirt"],
  ["wooden", "planks"],
  ["golden", "gold_ingot"],
  ["stone", "cobble"],
  ["iron", "iron_ingot"],
  ["diamond", "diamond"],
  ["hellfire", "hellfire_alloy"],
]) {
  const key = { M: ing, S: "stick" };
  shaped(
    `${material}_pickaxe`,
    `${material}_pickaxe`,
    1,
    ["MMM", " S ", " S "],
    key,
  );
  shaped(`${material}_axe`, `${material}_axe`, 1, ["MM", "MS", " S"], key);
  shaped(`${material}_shovel`, `${material}_shovel`, 1, ["M", "S", "S"], key);
  shaped(`${material}_sword`, `${material}_sword`, 1, ["M", "M", "S"], key);
  shaped(`${material}_hoe`, `${material}_hoe`, 1, ["MM", " S", " S"], key);
}
shapeless("flint_and_steel", "flint_and_steel", 1, ["flint", "iron_ingot"]);

shaped("oak_door", "oak_door", 3, ["PP", "PP", "PP"], { P: "planks" });
for (const material of [
  "dirt",
  "leather",
  "golden",
  "iron",
  "diamond",
  "hellfire",
]) {
  const ing = ITEMS[`${material}_helmet`].ingredient;
  for (const [slot, pattern] of [
    ["helmet", ["MMM", "M M"]],
    ["chestplate", ["M M", "MMM", "MMM"]],
    ["leggings", ["MMM", "M M", "M M"]],
    ["boots", ["M M", "M M"]],
  ])
    shaped(`${material}_${slot}`, `${material}_${slot}`, 1, pattern, {
      M: ing,
    });
}
for (const [material, ing] of [
  ["dirt", "dirt"],
  ["wooden", "planks"],
  ["stone", "cobble"],
  ["iron", "iron_ingot"],
  ["diamond", "diamond"],
  ["hellfire", "hellfire_alloy"],
])
  shaped(`${material}_spear`, `${material}_spear`, 1, ["  M", " S ", "S  "], {
    M: ing,
    S: "stick",
  });
shaped("paper", "paper", 3, ["CCC"], { C: "sugar_cane" });
shapeless("book", "book", 1, ["paper", "paper", "paper", "leather"]);
shaped("enchanting_table", "enchanting_table", 1, [" B ", "DOD", "OOO"], {
  B: "book",
  D: "diamond",
  O: "obsidian",
});
shapeless("hellfire_alloy", "hellfire_alloy", 2, [
  "hellfire_ingot",
  "hellfire_ingot",
  "brimstone",
]);
shapeless("bone_meal", "bone_meal", 3, ["bone"]);
shaped("string_wool", "wool", 1, ["SS", "SS"], { S: "string" });
shapeless("ashen_planks", "planks", 4, ["ashen_log"]);
shaped("cinder_bricks", "cinder_bricks", 4, ["CC", "CC"], { C: "cinderstone" });
shaped("bamboo_sticks", "stick", 1, ["B", "B"], { B: "bamboo" });
for (const [block, ing] of [
  ["coal_block", "coal"],
  ["iron_block", "iron_ingot"],
  ["copper_block", "copper_ingot"],
  ["gold_block", "gold_ingot"],
  ["diamond_block", "diamond"],
  ["lapis_block", "lapis_lazuli"],
  ["emerald_block", "emerald"],
  ["raw_iron_block", "raw_iron"],
  ["raw_copper_block", "raw_copper"],
  ["raw_gold_block", "raw_gold"],
  ["hay_bale", "wheat"],
  ["packed_ice", "ice"],
]) {
  shaped(block, block, 1, ["MMM", "MMM", "MMM"], { M: ing });
  if (block !== "packed_ice") shapeless(`unpack_${block}`, ing, 9, [block]);
}
shaped("bucket", "bucket", 1, ["I I", " I "], { I: "iron_ingot" });
shaped("tnt", "tnt", 1, ["GSG", "SGS", "GSG"], { G: "gunpowder", S: "sand" });
shaped("red_sand_tnt", "tnt", 1, ["GSG", "SGS", "GSG"], {
  G: "gunpowder",
  S: "red_sand",
});
shaped("stone_bricks", "stone_bricks", 4, ["SS", "SS"], { S: "stone" });
shapeless("mossy_stone_bricks", "mossy_stone_bricks", 1, [
  "stone_bricks",
  "moss",
]);
shaped("clay", "clay", 1, ["CC", "CC"], { C: "clay_ball" });
shaped("brick", "brick", 1, ["BB", "BB"], { B: "brick_item" });
shaped("sandstone", "sandstone", 1, ["SS", "SS"], { S: "sand" });
shaped("bookshelf", "bookshelf", 1, ["PPP", "BBB", "PPP"], {
  P: "planks",
  B: "book",
});
shapeless("granite", "granite", 2, ["stone", "terracotta"]);
shapeless("diorite", "diorite", 2, ["stone", "snow"]);
shapeless("andesite", "andesite", 2, ["stone", "diorite"]);
shaped("jukebox", "jukebox", 1, ["PPP", "PDP", "PPP"], {
  P: "planks",
  D: "diamond",
});
item("palm_tablet", "Weathered Palm Tablet", "#b99562", {
  stack: 1,
  description:
    "A broken inscription: endure the presence, or flee before it judges you.",
});
item("saint_corpse_part", "Saint’s Corpse Part", "#e6dfc3", {
  stack: 1,
  artifactModel: true,
  description:
    "An ancient reliquary. Carry one for +10 maximum Stand energy. Extra parts do not stack.",
});
for (const [name, color] of [
  ["amber", "#e9bd62"],
  ["azure", "#659ccf"],
  ["moss", "#8fb77b"],
  ["rose", "#cf798b"],
])
  item(
    `music_disc_${name}`,
    `${name[0].toUpperCase() + name.slice(1)} Disc`,
    color,
    {
      stack: 1,
      musicDisc: true,
      description: "Reusable local MP3 disc · link your file at a jukebox",
    },
  );
export const CREATIVE_ITEMS = Object.keys(ITEMS);
export const HOSTILE_TYPES = new Set([
  "zombie",
  "creeper",
  "spider",
  "skeleton",
  "shade",
  "stalker",
  "emberling",
  "basalt_crawler",
  "cinder_wraith",
  "devin_guardian",
  "dread_knight",
  "soul_reaver",
  "magma_maw",
  "mad_titan",
  "tiger",
]);
export const PASSIVE_TYPES = ["grazer", "woolling", "cow", "chicken", "rabbit"];
export const MOB_INFO = {
  watcher: {
    name: "The Watcher",
    height: 3.6,
    width: 0.55,
    health: 1000,
    speed: 1.2,
    damage: 0,
    noSunBurn: true,
  },
  mad_titan: {
    name: "A Mad Titan",
    height: 5,
    width: 2.4,
    health: 320,
    speed: 2.25,
    damage: 14,
    cinder: true,
    noSunBurn: true,
  },
  zombie: {
    name: "Zombie",
    height: 1.95,
    width: 0.6,
    health: 20,
    speed: 2.3,
    damage: 3,
  },
  creeper: {
    name: "Creeper",
    height: 1.7,
    width: 0.6,
    health: 20,
    speed: 2.1,
    damage: 0,
    noSunBurn: true,
  },
  spider: {
    name: "Spider",
    height: 0.85,
    width: 1.35,
    health: 16,
    speed: 3.4,
    damage: 2,
    noSunBurn: true,
  },
  skeleton: {
    name: "Skeleton",
    height: 1.99,
    width: 0.6,
    health: 20,
    speed: 2.4,
    damage: 4,
  },
  panda: {
    name: "Panda",
    height: 1.35,
    width: 0.95,
    health: 24,
    speed: 0.65,
    neutral: true,
    damage: 3,
  },
  koala: { name: "Koala", height: 0.85, width: 0.55, health: 12, speed: 0.6 },
  tiger: {
    name: "Savanna tiger",
    height: 1.15,
    width: 0.8,
    health: 26,
    speed: 3.5,
    damage: 4,
    noSunBurn: true,
  },
  ash_deer: {
    name: "Ash deer",
    height: 1.65,
    width: 0.7,
    health: 18,
    speed: 1.2,
    cinder: true,
  },
  cinderback: {
    name: "Cinderback",
    height: 0.85,
    width: 0.95,
    health: 24,
    speed: 0.65,
    cinder: true,
    neutral: true,
    damage: 3,
  },
  basalt_crawler: {
    name: "Basalt crawler",
    height: 0.8,
    width: 0.9,
    health: 28,
    speed: 2.8,
    damage: 4,
    cinder: true,
    noSunBurn: true,
  },
  cinder_wraith: {
    name: "Cinder wraith",
    height: 2.1,
    width: 0.65,
    health: 32,
    speed: 2.5,
    damage: 5,
    cinder: true,
    noSunBurn: true,
  },
  devin_guardian: {
    name: "Guardian of The Devin Sword",
    height: 2.5,
    width: 0.75,
    health: 140,
    speed: 2.5,
    damage: 12,
    noSunBurn: true,
  },
  dread_knight: {
    name: "Dread knight",
    height: 2.8,
    width: 0.9,
    health: 70,
    speed: 2.1,
    damage: 9,
    cinder: true,
    noSunBurn: true,
  },
  soul_reaver: {
    name: "Soul reaver",
    height: 2.45,
    width: 0.75,
    health: 42,
    speed: 2.5,
    damage: 6,
    cinder: true,
    noSunBurn: true,
  },
  magma_maw: {
    name: "Magma maw",
    height: 1.25,
    width: 1.25,
    health: 42,
    speed: 3.3,
    damage: 6,
    cinder: true,
    noSunBurn: true,
  },
  iron_golem: {
    name: "Iron Golem",
    height: 2.7,
    width: 1.4,
    health: 100,
    speed: 2.4,
    voice: "iron_golem",
  },
  grazer: {
    name: "Pig",
    height: 0.95,
    width: 0.65,
    health: 10,
    speed: 0.9,
    voice: "pig",
  },
  woolling: {
    name: "Sheep",
    height: 1.25,
    width: 0.75,
    health: 10,
    speed: 0.85,
    voice: "sheep",
  },
  cow: {
    name: "Cow",
    height: 1.4,
    width: 0.85,
    health: 10,
    speed: 0.8,
    voice: "cow",
  },
  chicken: {
    name: "Chicken",
    height: 0.75,
    width: 0.4,
    health: 4,
    speed: 1.1,
    voice: "chicken",
  },
  rabbit: {
    name: "Rabbit",
    height: 0.7,
    width: 0.4,
    health: 6,
    speed: 1.25,
    voice: "rabbit",
  },
  villager: {
    name: "Villager",
    height: 1.9,
    width: 0.6,
    health: 20,
    speed: 1.25,
    voice: "villager",
  },
};
// Eggs have no recipes or Survival drops. All use paths enforce Creative mode.
for (const [type, name, health, speed] of [
  ["ember_ray", "Ember Ray", 24, 3.2],
  ["cinder_roc", "Cinder Roc", 36, 2.6],
]) {
  MOB_INFO[type] = {
    name,
    health,
    speed,
    height: 1.6,
    width: 2.4,
    cinder: true,
    flying: true,
    voice: type,
  };
  HOSTILE_TYPES.add(type);
}
// Appended after existing species so Creative egg indices/colours stay stable.
MOB_INFO.snow_leopard = {
  name: "Snow Leopard",
  height: 1.03,
  width: 0.76,
  health: 22,
  speed: 1.5,
  damage: 4,
  neutral: true,
  voice: "snow_leopard",
};
MOB_INFO.polar_bear = {
  name: "Polar Bear",
  height: 1.45,
  width: 1.1,
  health: 30,
  speed: 1.05,
  damage: 5,
  neutral: true,
  voice: "polar_bear",
};
appendAquaticMobs(MOB_INFO, HOSTILE_TYPES);
export const SPAWN_EGG_TYPES = Object.keys(MOB_INFO).filter(
  (t) => !["shade", "stalker"].includes(t),
);
for (const [i, type] of SPAWN_EGG_TYPES.entries()) {
  const id = `${type}_spawn_egg`;
  ITEMS[id] = {
    id,
    name: `${MOB_INFO[type].name} Spawn Egg`,
    stack: 64,
    creativeOnly: true,
    spawnType: type,
    color: ["#a0b383", "#e6c09b", "#afa7c6", "#9eb7c7"][i % 4],
  };
  CREATIVE_ITEMS.push(id);
}
export const VILLAGER_TRADES = {
  farmer: [
    { input: "wheat", cost: 20, output: "emerald", count: 1 },
    { input: "emerald", cost: 1, output: "bread", count: 6 },
  ],
  mason: [
    { input: "stone", cost: 20, output: "emerald", count: 1 },
    { input: "emerald", cost: 1, output: "brick", count: 10 },
  ],
  shepherd: [
    { input: "wool", cost: 18, output: "emerald", count: 1 },
    { input: "emerald", cost: 1, output: "wool", count: 1 },
  ],
};
export const CYCLE_TEXT = {
  dayEnd: "Sunset.",
  nightStart: "Nightfall.",
  nightEnd: "Dawn.",
  dayStart: "Sunrise.",
};
export const CYCLE_EVENTS = [
  { tick: 12000, key: "dayEnd", title: "SUNSET" },
  { tick: 13000, key: "nightStart", title: "NIGHTFALL" },
  { tick: 23000, key: "nightEnd", title: "DAWN APPROACHES" },
  { tick: 0, key: "dayStart", title: "A NEW DAY" },
];
export const DEFAULT_SETTINGS = {
  skin: "explorer",
  sensitivity: 0.002,
  FOV: 75,
  volume: 0.35,
  renderDistance: 4,
  graphics: 3,
  maxPixelRatio: 2,
  menuFrameLimit: 30,
  droppedItemDistance: 1,
  blockEntityDistance: 96,
  distantDetail: 4,
  shadowResolution: 1024,
  shadowDistance: 64,
  shadowFilter: "soft",
  localLightCount: 4,
  lightFlicker: true,
  anisotropy: 4,
  menuSounds: true,
  menuVolume: 0.65,
  fancyGraphics: true,
  ambientOcclusion: true,
  texturePack: "renewed",
  brightness: 0.5,
  mipmapLevels: 4,
  entityDistance: 1,
  particles: "all",
  viewBobbing: true,
  dynamicFOV: true,
  damageTilt: true,
  stars: true,
  cloudHeight: 160,
  animatedTextures: true,
  entityAnimations: true,
  droppedItemAnimation: true,
  biomeColors: true,
  biomeBlend: 2,
  sunMoon: true,
  entityShadows: true,
  frameLimit: 0,
  shadows: false,
  ambientSounds: true,
  musicEnabled: false,
  musicVolume: 0.45,
  weatherEffects: true,
  lightningFlashes: true,
  mobSounds: true,
  ambientVolume: 0.55,
  mobVolume: 0.75,
  fog: true,
  clouds: true,
  showFPS: false,
  distantTerrain: true,
  cycleText: { ...CYCLE_TEXT },
};
export const makeStack = (id, count = 1) => ({
  id,
  count,
  ...(ITEMS[id]?.durability ? { durability: ITEMS[id].durability } : {}),
});

export const attackCooldown = (id) =>
  ITEMS[id]?.cooldown ??
  (ITEMS[id]?.tool === "sword" ? 0.625 : ITEMS[id]?.tool === "axe" ? 1 : 0.25);

// The extra wood species share the existing plank/tool progression.
for (const log of ["pine_log", "birch_log"]) {
  shapeless(
    `${log}_planks`,
    log === "pine_log" ? "spruce_planks" : "birch_planks",
    4,
    [log],
  );
  FUELS[log] = 300;
  SMELTS[log] = "charcoal";
}
SMELTS.red_sand = SMELTS.sand;

shapeless("music_disc_amber", "music_disc_amber", 1, [
  "paper",
  "paper",
  "paper",
  "paper",
  "coal",
]);
for (const [name, material] of [
  ["azure", "lapis_lazuli"],
  ["moss", "seeds"],
  ["rose", "poppy"],
])
  shapeless(`music_disc_${name}`, `music_disc_${name}`, 1, [
    "music_disc_amber",
    material,
  ]);

ITEMS.oak_boat = {
  id: "oak_boat",
  name: "Oak Boat",
  stack: 1,
  boat: true,
  color: "#b18a55",
};
CREATIVE_ITEMS.push("oak_boat");
shaped("oak_boat", "oak_boat", 1, ["P P", "PPP"], { P: "planks" });

FUELS.oak_boat = 1200;

appendAquaticItems({
  ITEMS,
  B,
  CREATIVE_ITEMS,
  shaped,
  shapeless,
  FUELS,
  SMELTS,
});

appendEditionItems({
  ITEMS,
  BLOCKS,
  B,
  CREATIVE_ITEMS,
  RECIPES,
  SMELTS,
  FUELS,
});

// Append after the existing catalog so saved UI/network indices remain stable.
ITEMS.milk_bucket = {
  id: "milk_bucket",
  name: "Milk Bucket",
  stack: 1,
  color: "#e7e9dc",
  edition: true,
};
CREATIVE_ITEMS.push("milk_bucket");
Object.assign(
  EDITION_AUDIT.items.find((e) => e.reference === "milk_bucket"),
  {
    status: "added",
    note: "Overworld Foundations I: milk adult cows; drinking clears status effects and returns the bucket. Consumption timing is simplified.",
  },
);
