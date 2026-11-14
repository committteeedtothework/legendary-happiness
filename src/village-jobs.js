export const VILLAGER_JOBS = {
  farmer: { station: "farmland", color: "#b79b54" },
  mason: { station: "stonecutter", color: "#b6ada5" },
  shepherd: { station: "crafting_table", color: "#e5ded0" },
  blacksmith: { station: "furnace", color: "#332b2b" },
  toolsmith: { station: "smithing_table", color: "#5e4d40" },
  armorer: { station: "blast_furnace", color: "#697b86" },
  librarian: { station: "bookshelf", color: "#e7d9c8" },
  cleric: { station: "brewing_stand", color: "#855b9c" },
  fletcher: { station: "crafting_table", color: "#7f6745" },
  fisherman: { station: "barrel", color: "#aa874e" },
  butcher: { station: "smoker", color: "#f4ded7" },
};
export function appendVillageTrades(t) {
  Object.assign(t, {
    blacksmith: [
      { input: "iron_ingot", cost: 4, output: "emerald", count: 1 },
      { input: "emerald", cost: 12, output: "iron_sword", count: 1 },
      { input: "emerald", cost: 32, output: "diamond_sword", count: 1 },
    ],
    toolsmith: [
      { input: "coal", cost: 15, output: "emerald", count: 1 },
      { input: "emerald", cost: 12, output: "iron_pickaxe", count: 1 },
      { input: "emerald", cost: 24, output: "diamond_pickaxe", count: 1 },
    ],
    armorer: [
      { input: "iron_ingot", cost: 5, output: "emerald", count: 1 },
      { input: "emerald", cost: 18, output: "iron_chestplate", count: 1 },
      { input: "emerald", cost: 8, output: "iron_helmet", count: 1 },
    ],
    librarian: [
      { input: "paper", cost: 24, output: "emerald", count: 1 },
      { input: "emerald", cost: 9, output: "bookshelf", count: 1 },
      { input: "emerald", cost: 3, output: "book", count: 1 },
    ],
    cleric: [
      { input: "rotten_flesh", cost: 32, output: "emerald", count: 1 },
      { input: "emerald", cost: 5, output: "ender_pearl", count: 1 },
      { input: "emerald", cost: 4, output: "glowstone_dust", count: 3 },
    ],
    fletcher: [
      { input: "stick", cost: 32, output: "emerald", count: 1 },
      { input: "emerald", cost: 1, output: "arrow", count: 16 },
      { input: "emerald", cost: 4, output: "bow", count: 1 },
    ],
    fisherman: [
      { input: "cod", cost: 12, output: "emerald", count: 1 },
      { input: "emerald", cost: 1, output: "cooked_cod", count: 4 },
    ],
    butcher: [
      { input: "raw_meat", cost: 14, output: "emerald", count: 1 },
      { input: "emerald", cost: 1, output: "cooked_meat", count: 6 },
    ],
  });
}
