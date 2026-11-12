// Goals describe real actions supported by this game. Minecraft names are
// referenced in ACHIEVEMENTS.md; requirements are written for DCSMCRAFT.
import { ITEMS } from "./data.js";
export const ACHIEVEMENT_CATEGORIES = [
  ["survival", "Survival"],
  ["equipment", "Equipment"],
  ["adventure", "Adventure"],
  ["ocean", "Ocean"],
  ["custom", "DCSMCRAFT"],
  ["titans", "Titans"],
];
const rows = [];
const add = (category, id, title, description, icon, rules, options = {}) =>
  rows.push({
    id,
    category,
    title,
    description,
    icon,
    target: 1,
    survival: !["custom", "titans"].includes(category),
    rules,
    ...options,
  });
const action = (event, values = {}) => ({ event, ...values });
const own = (...items) => action("inventory", { items });
const all = (...items) => action("inventory", { items, all: true });
const crafted = (...items) => action("craft", { items });
const armor = (material) =>
  ["helmet", "chestplate", "leggings", "boots"].map((x) => `${material}_${x}`);
const logs = Object.keys(ITEMS).filter((x) => x === "log" || /_log$/.test(x));
const addSurvival = (id, title, text, icon, rule, options) =>
  add("survival", id, title, text, icon, [rule], options);
addSurvival(
  "taking_inventory",
  "Taking Inventory",
  "Open your inventory in Survival.",
  "chest",
  action("inventory-open"),
);
addSurvival(
  "getting_wood",
  "Getting Wood",
  "Collect a log.",
  "log",
  own(...logs),
);
addSurvival(
  "benchmaking",
  "Benchmaking",
  "Craft a crafting table.",
  "crafting_table",
  crafted("crafting_table"),
);
addSurvival(
  "time_to_mine",
  "Time to Mine!",
  "Craft a wooden pickaxe.",
  "wooden_pickaxe",
  crafted("wooden_pickaxe"),
);
addSurvival(
  "getting_upgrade",
  "Getting an Upgrade",
  "Craft a stone pickaxe.",
  "stone_pickaxe",
  crafted("stone_pickaxe"),
);
addSurvival(
  "hot_topic",
  "Hot Topic",
  "Craft a furnace.",
  "furnace",
  crafted("furnace"),
);
addSurvival(
  "acquire_hardware",
  "Acquire Hardware",
  "Take an iron ingot from a furnace.",
  "iron_ingot",
  action("smelt-take", { items: ["iron_ingot"] }),
);
addSurvival(
  "time_to_strike",
  "Time to Strike!",
  "Craft a wooden sword.",
  "wooden_sword",
  crafted("wooden_sword"),
);
addSurvival(
  "time_to_farm",
  "Time to Farm!",
  "Craft a wooden hoe.",
  "wooden_hoe",
  crafted("wooden_hoe"),
);
addSurvival(
  "bake_bread",
  "Bake Bread",
  "Craft bread from wheat.",
  "bread",
  crafted("bread"),
);
addSurvival(
  "cow_tipper",
  "Cow Tipper",
  "Collect leather.",
  "leather",
  own("leather"),
);
addSurvival(
  "diamonds",
  "DIAMONDS!",
  "Collect a diamond.",
  "diamond",
  own("diamond"),
);
addSurvival(
  "ice_bucket",
  "Ice Bucket Challenge",
  "Collect obsidian.",
  "obsidian",
  own("obsidian"),
);
addSurvival(
  "moar_tools",
  "MOAR Tools",
  "Craft a wooden pickaxe, axe, shovel, hoe, and sword.",
  "wooden_axe",
  action("craft", {
    items: [
      "wooden_pickaxe",
      "wooden_axe",
      "wooden_shovel",
      "wooden_hoe",
      "wooden_sword",
    ],
    unique: "item",
  }),
  { target: 5 },
);
addSurvival(
  "seedy_place",
  "A Seedy Place",
  "Plant wheat seeds on farmland.",
  "seeds",
  action("plant"),
);
addSurvival(
  "builder",
  "Block by Block",
  "Place 128 blocks.",
  "planks",
  action("place"),
  { target: 128 },
);
const gear = (id, title, text, icon, rule) =>
  add("equipment", id, title, text, icon, [rule]);
gear(
  "iron_pick",
  "Isn't It Iron Pick",
  "Obtain an iron pickaxe.",
  "iron_pickaxe",
  own("iron_pickaxe"),
);
gear(
  "suit_up",
  "Suit Up",
  "Obtain a piece of iron armor.",
  "iron_chestplate",
  own(...armor("iron")),
);
gear(
  "full_iron",
  "Ironclad",
  "Carry or wear a complete iron armor set.",
  "iron_helmet",
  all(...armor("iron")),
);
gear(
  "diamond_pick",
  "Diamond Tipped",
  "Obtain a diamond pickaxe.",
  "diamond_pickaxe",
  own("diamond_pickaxe"),
);
gear(
  "diamond_armor",
  "Cover Me with Diamonds",
  "Carry or wear a complete diamond armor set.",
  "diamond_chestplate",
  all(...armor("diamond")),
);
gear(
  "enchanter",
  "Enchanter",
  "Enchant an item at an enchanting table.",
  "enchanting_table",
  action("enchant"),
);
gear(
  "netherite_ingot",
  "Lode to Riches",
  "Obtain a netherite ingot.",
  "netherite_ingot",
  own("netherite_ingot"),
);
gear(
  "netherite_armor",
  "Cover Me in Debris",
  "Carry or wear a complete netherite armor set.",
  "netherite_chestplate",
  all(...armor("netherite")),
);
gear(
  "serious_dedication",
  "Serious Dedication",
  "Obtain a netherite hoe.",
  "netherite_hoe",
  own("netherite_hoe"),
);
add(
  "adventure",
  "monster_hunter",
  "Monster Hunter",
  "Defeat a hostile creature.",
  "iron_sword",
  [action("hostile-kill")],
);
add(
  "adventure",
  "monster_slayer",
  "Night Watch",
  "Defeat 50 hostile creatures.",
  "diamond_sword",
  [action("hostile-kill")],
  { target: 50, challenge: true },
);
add(
  "adventure",
  "sweet_dreams",
  "Sweet Dreams",
  "Sleep through the night in a bed.",
  "bed",
  [action("sleep")],
);
add(
  "adventure",
  "what_a_deal",
  "What a Deal!",
  "Complete a villager trade.",
  "emerald",
  [action("trade")],
);
add(
  "adventure",
  "trailblazer",
  "Trailblazer",
  "Visit five different Overworld biomes.",
  "compass",
  [action("biome", { unique: "key" })],
  { target: 5, survival: false },
);
add(
  "adventure",
  "cinderworld",
  "Into the Cinderworld",
  "Travel through a portal to Cinderworld.",
  "flint_and_steel",
  [action("dimension", { keys: ["cinderwild"] })],
  { survival: false },
);
const ocean = (id, title, text, icon, key) =>
  add("ocean", id, title, text, icon, [action("aquatic", { keys: [key] })]);
ocean(
  "fishy_business",
  "Fishy Business",
  "Reel in a successful fishing catch.",
  "fishing_rod",
  "fishing",
);
ocean(
  "tactical_fishing",
  "Tactical Fishing",
  "Catch a fish in a water bucket.",
  "water_bucket",
  "fish_bucket",
);
ocean(
  "moskstraumen",
  "Moskstraumen",
  "Receive Conduit Power from an active conduit.",
  "conduit",
  "conduit",
);
ocean(
  "turtle_master",
  "Turtle Master",
  "Drink a Turtle Master potion.",
  "turtle_master_potion",
  "turtle_master",
);
ocean(
  "riptide",
  "Do a Barrel Roll!",
  "Launch yourself with Riptide.",
  "trident",
  "riptide",
);
ocean(
  "trident_hit",
  "A Throw to Remember",
  "Hit a creature with a thrown trident.",
  "trident",
  "trident",
);
add(
  "ocean",
  "heart_sea",
  "Heart of the Deep",
  "Collect a Heart of the Sea.",
  "heart_of_the_sea",
  [own("heart_of_the_sea")],
);
add(
  "ocean",
  "turtle_shell",
  "Shell Keeper",
  "Obtain a turtle shell helmet.",
  "turtle_shell",
  [own("turtle_shell", "turtle_helmet")],
);
const custom = (id, title, text, icon, rules, opts) =>
  add("custom", id, title, text, icon, rules, opts);
custom(
  "hellfire_ingot",
  "Fire in the Forge",
  "Take a Hellfire ingot from a furnace.",
  "hellfire_ingot",
  [action("smelt-take", { items: ["hellfire_ingot"] })],
  { survival: true },
);
custom(
  "hellfire_alloy",
  "Forged in Cinder",
  "Obtain Hellfire alloy in Survival.",
  "hellfire_alloy",
  [own("hellfire_alloy")],
  { survival: true },
);
custom(
  "hellfire_pick",
  "Beyond Diamond",
  "Obtain a Hellfire pickaxe in Survival.",
  "hellfire_pickaxe",
  [own("hellfire_pickaxe")],
  { survival: true },
);
custom(
  "hellfire_armor",
  "Fireproof Fashion",
  "Carry or wear a full Hellfire armor set in Survival.",
  "hellfire_chestplate",
  [all(...armor("hellfire"))],
  { survival: true },
);
custom(
  "devin_sword",
  "Sword in the Stone",
  "Claim the Devin Sword from its relic, or possess it in Survival.",
  "devin_sword",
  [
    action("claim", { items: ["devin_sword"] }),
    { ...own("devin_sword"), survival: true },
  ],
);
custom(
  "matthew_pistols",
  "Gunslinger",
  "Claim Matthew's pistols from the altar, or possess them in Survival.",
  "matthew_dual_pistols",
  [
    action("claim", { items: ["matthew_dual_pistols"] }),
    { ...own("matthew_dual_pistols"), survival: true },
  ],
);
custom(
  "guardian",
  "Temple Breaker",
  "Defeat a Devin Guardian.",
  "devin_sword",
  [action("hostile-kill", { keys: ["devin_guardian"] })],
);
custom(
  "mad_titan",
  "Riftbreaker",
  "Defeat the Mad Titan.",
  "hellfire_sword",
  [action("hostile-kill", { keys: ["mad_titan"] })],
  { challenge: true },
);
custom(
  "pulse",
  "Devin's Reach",
  "Strike three hostiles with a single Devin's Pulse.",
  "devin_sword",
  [action("pulse", { minimum: 3 })],
);
custom(
  "stand_awaken",
  "A Fighting Spirit",
  "Obtain a Stand.",
  "saint_corpse_part",
  [action("stand-awaken")],
);
custom(
  "stand_master",
  "Stand Master",
  "Reach Stand level 5.",
  "saint_corpse_part",
  [action("stand-level", { minimum: 5 })],
  { challenge: true },
);
custom(
  "saint_relic",
  "Sacred Remains",
  "Collect a Saint's Corpse Part in Survival.",
  "saint_corpse_part",
  [own("saint_corpse_part")],
  { survival: true },
);
custom(
  "arsenal",
  "Legendary Arsenal",
  "Carry the Devin Sword and Matthew's pistols together in Survival.",
  "matthew_dual_pistols",
  [all("devin_sword", "matthew_dual_pistols")],
  { survival: true, challenge: true },
);
const titan = (id, title, text, icon, rule, opts) =>
  add("titans", id, title, text, icon, [rule], opts);
titan(
  "titan_portal",
  "Titan Signals",
  "Enter a Titan arena.",
  "emerald",
  action("titan-stage", { keys: ["intro"] }),
);
titan(
  "last_emerald",
  "The Final Emerald",
  "Reach and collect the final Chaos Emerald.",
  "emerald",
  action("titan-emerald"),
);
titan(
  "super_sonic",
  "Super Sonic",
  "Complete the Super Sonic transformation.",
  "gold_ingot",
  action("titan-transform"),
);
titan(
  "titan_parry",
  "Right Back at You",
  "Successfully parry a Titan attack or missile.",
  "shield",
  action("titan-parry"),
);
titan(
  "perfect_parry",
  "Perfect Timing",
  "Land a perfect Titan parry.",
  "shield",
  action("titan-perfect"),
);
titan(
  "titan_homing",
  "Straight to the Point",
  "Connect a Homing Attack with a Titan.",
  "diamond",
  action("titan-hit", { keys: ["homing"] }),
);
titan(
  "titan_cyloop",
  "Full Circle",
  "Damage a Titan with a completed Cyloop.",
  "lapis_lazuli",
  action("titan-hit", { keys: ["loop", "cyloop"] }),
);
titan(
  "sonic_boom",
  "Sonic Boom",
  "Land a Sonic Boom wave on a Titan.",
  "gold_ingot",
  action("titan-hit", { keys: ["boom"] }),
);
titan(
  "ring_collector",
  "Ring Runner",
  "Collect 200 rings in Titan arenas.",
  "gold_ingot",
  action("titan-ring"),
  { target: 200 },
);
titan(
  "giganto_victory",
  "Undefeatable",
  "Defeat Giganto and complete the finishing sequence.",
  "devin_sword",
  action("titan-victory", { keys: ["giganto"] }),
  { challenge: true },
);
titan(
  "wyvern_victory",
  "Break Through It All",
  "Defeat Wyvern and complete the finishing sequence.",
  "matthew_dual_pistols",
  action("titan-victory", { keys: ["wyvern"] }),
  { challenge: true },
);
titan(
  "both_titans",
  "Titan Slayer",
  "Defeat both Giganto and Wyvern.",
  "diamond_sword",
  action("titan-victory", { keys: ["giganto", "wyvern"], unique: "key" }),
  { target: 2, challenge: true },
);
export const ACHIEVEMENTS = Object.freeze(rows.map((x) => Object.freeze(x)));
export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((x) => [x.id, x]));
