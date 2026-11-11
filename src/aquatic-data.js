// Append-only aquatic registry: no imports, so saved numeric block IDs stay stable.
const title = (s) =>
  s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export function appendAquaticBlocks(blocks) {
  const add = (key, color, hardness = 0.5, extra = {}) =>
    blocks.push({
      key,
      name: title(key),
      color,
      hardness,
      solid: true,
      transparent: false,
      tier: 0,
      drop: key,
      ...extra,
    });
  for (const [key, color] of Object.entries({
    prismarine: "#6baba0",
    prismarine_bricks: "#69ada8",
    dark_prismarine: "#365f58",
    sea_lantern: "#c1eee0",
    magma_block: "#ae452b",
    soul_sand: "#65503d",
    blue_ice: "#83b4e5",
  }))
    add(
      key,
      color,
      key === "blue_ice"
        ? 2.8
        : key.includes("prismarine")
          ? 1.5
          : key === "sea_lantern"
            ? 0.3
            : 0.5,
      {
        tool: key === "soul_sand" ? "shovel" : "pickaxe",
        tier: key === "soul_sand" ? 0 : 1,
        light: key === "sea_lantern" ? 15 : 0,
        ...(key === "soul_sand" ? { bounds: [0, 0, 0, 1, 0.875, 1] } : {}),
      },
    );
  add("conduit", "#83c8c6", 3, {
    tool: "pickaxe",
    tier: 1,
    bounds: [0.25, 0.25, 0.25, 0.75, 0.75, 0.75],
  });
  add("brewing_stand", "#92835b", 0.5, {
    tool: "pickaxe",
    tier: 1,
    transparent: true,
    bounds: [0.1, 0, 0.1, 0.9, 0.9, 0.9],
  });
  const wet = {
    solid: false,
    transparent: true,
    aquaticWater: true,
    fluid: { type: "water", source: true, level: 0 },
    aquatic: true,
  };
  add("kelp", "#589145", 0, {
    ...wet,
    plant: true,
    bounds: [0.1, 0, 0.1, 0.9, 1, 0.9],
  });
  add("seagrass", "#639a4c", 0, {
    ...wet,
    plant: true,
    bounds: [0.1, 0, 0.1, 0.9, 0.7, 0.9],
  });
  for (const [kind, color] of Object.entries({
    tube: "#4066d2",
    brain: "#d76bac",
    bubble: "#a45cc5",
    fire: "#d85648",
    horn: "#d8b44e",
  }))
    for (const form of ["block", "coral", "fan"])
      for (const dead of [false, true]) {
        const key = `${dead ? "dead_" : ""}${kind}_coral${form === "coral" ? "" : `_${form}`}`;
        add(key, dead ? "#8a8d83" : color, form === "block" ? 1.5 : 0, {
          ...(form === "block"
            ? { tool: "pickaxe", tier: 1 }
            : {
                ...wet,
                plant: true,
                bounds:
                  form === "fan"
                    ? [0.05, 0, 0.05, 0.95, 0.25, 0.95]
                    : [0.15, 0, 0.15, 0.85, 0.8, 0.85],
              }),
          coral: { kind, form, dead },
          drop: key,
        });
      }
  for (let n = 1; n <= 4; n++) {
    add(`sea_pickle_${n}`, "#8c9f50", 0, {
      ...wet,
      pickles: n,
      name: n === 1 ? "Sea Pickle" : `${n} Sea Pickles`,
      internal: n !== 1,
      drop: "sea_pickle_1",
      light: 3 * n + 3,
      bounds: [0.18, 0, 0.18, 0.82, 0.45, 0.82],
    });
    for (let stage = 0; stage < 3; stage++)
      add(`turtle_egg_${n}_${stage}`, "#e1dfb3", 0.5, {
        solid: false,
        transparent: true,
        eggs: n,
        name: `${n === 1 ? "Turtle Egg" : `${n} Turtle Eggs`}${stage ? " · Cracked " + stage : ""}`,
        eggStage: stage,
        internal: n !== 1 || stage !== 0,
        drop: null,
        bounds: [0.2, 0, 0.2, 0.8, 0.45, 0.8],
      });
  }
  for (let n = 0; n < 4; n++)
    add(`nether_wart_${n}`, "#9c3944", 0, {
      solid: false,
      transparent: true,
      plant: true,
      wart: n + 1,
      internal: true,
      drop: "nether_wart",
      bounds: [0.1, 0, 0.1, 0.9, 0.2 + n * 0.15, 0.9],
    });
  add("dried_kelp_block", "#52623a", 0.5);
}
export function appendAquaticMobs(info, hostile) {
  const add = (key, name, health, width, height, speed, extra = {}) =>
    (info[key] = { name, health, width, height, speed, voice: key, ...extra });
  add("cod", "Cod", 3, 0.5, 0.3, 1.4, { aquatic: true, fish: true });
  add("salmon", "Salmon", 3, 0.7, 0.4, 1.7, { aquatic: true, fish: true });
  add("tropical_fish", "Tropical Fish", 3, 0.4, 0.4, 1.3, {
    aquatic: true,
    fish: true,
  });
  add("pufferfish", "Pufferfish", 3, 0.45, 0.45, 0.8, {
    aquatic: true,
    fish: true,
  });
  add("squid", "Squid", 10, 0.8, 0.8, 1, { aquatic: true });
  add("dolphin", "Dolphin", 10, 0.8, 0.6, 2.7, {
    aquatic: true,
    breathes: true,
  });
  add("turtle", "Sea Turtle", 30, 1.2, 0.4, 0.9, {
    aquatic: true,
    breathes: true,
  });
  add("drowned", "Drowned", 20, 0.6, 1.95, 1.1, { undead: true });
  hostile.add("drowned");
  add("husk", "Husk", 20, 0.6, 1.95, 1.15, { undead: true, noSunBurn: true });
  hostile.add("husk");
  add("stray", "Stray", 20, 0.6, 1.99, 1.15, { undead: true });
  hostile.add("stray");
  add("skeleton_horse", "Skeleton Horse", 15, 1.4, 1.6, 4.2, {
    undead: true,
    noSunBurn: true,
  });
}
export function appendAquaticItems({
  ITEMS,
  B,
  CREATIVE_ITEMS,
  shaped,
  shapeless,
  FUELS,
  SMELTS,
}) {
  const add = (key, name, color, extra = {}) => {
    ITEMS[key] = { key, name, color, stack: 64, ...extra };
    CREATIVE_ITEMS.push(key);
  };
  for (const [key, name, color] of [
    ["scute", "Scute", "#67a881"],
    ["nautilus_shell", "Nautilus Shell", "#d5ae8c"],
    ["heart_of_the_sea", "Heart of the Sea", "#468cc1"],
    ["prismarine_shard", "Prismarine Shard", "#7cbbb5"],
    ["prismarine_crystals", "Prismarine Crystals", "#acd9cc"],
    ["ink_sac", "Ink Sac", "#34404f"],
    ["nether_wart", "Nether Wart", "#a74750"],
    ["blaze_rod", "Cinder Blaze Rod", "#e8ac45"],
    ["blaze_powder", "Blaze Powder", "#f2bd54"],
  ])
    add(key, name, color);
  for (const [key, name, food, saturation, color] of [
    ["cod", "Raw Cod", 2, 0.4, "#bba985"],
    ["salmon", "Raw Salmon", 2, 0.4, "#bf6b62"],
    ["tropical_fish", "Tropical Fish", 1, 0.2, "#eaaa57"],
    ["pufferfish", "Pufferfish", 1, 0.2, "#c6b95b"],
    ["cooked_cod", "Cooked Cod", 5, 6, "#d5b57a"],
    ["cooked_salmon", "Cooked Salmon", 6, 9.6, "#c87a57"],
    ["dried_kelp", "Dried Kelp", 1, 0.6, "#59673e"],
  ])
    add(key, name, color, { food, saturation });
  add("turtle_shell", "Turtle Shell", "#6a9c72", {
    stack: 1,
    armorSlot: 0,
    armor: 2,
    durability: 275,
  });
  add("fishing_rod", "Fishing Rod", "#ad936f", {
    stack: 1,
    tool: "fishing_rod",
    durability: 64,
  });
  add("trident", "Trident", "#8dc6be", {
    stack: 1,
    tool: "trident",
    attack: 9,
    speed: 1.1,
    cooldown: 1 / 1.1,
    durability: 250,
  });
  for (const fish of ["cod", "salmon", "tropical_fish", "pufferfish"])
    add(`${fish}_bucket`, `${title(fish)} Bucket`, "#91b9c7", {
      stack: 1,
      fishBucket: fish,
    });
  add("treasure_map", "Buried Treasure Map", "#d4bf8a", { stack: 1 });
  add("glass_bottle", "Glass Bottle", "#b3d4db", { stack: 64 });
  for (const [id, name] of [
    ["water_bottle", "Water Bottle"],
    ["awkward_potion", "Awkward Potion"],
    ["turtle_master_potion", "Potion of the Turtle Master"],
  ])
    add(id, name, id === "turtle_master_potion" ? "#789b68" : "#6c9ac7", {
      stack: 1,
    });
  shaped("fishing_rod", "fishing_rod", 1, ["  S", " ST", "S T"], {
    S: "stick",
    T: "string",
  });
  shaped("turtle_shell", "turtle_shell", 1, ["SSS", "S S"], { S: "scute" });
  shaped("conduit", "conduit", 1, ["NNN", "NHN", "NNN"], {
    N: "nautilus_shell",
    H: "heart_of_the_sea",
  });
  shaped("prismarine", "prismarine", 1, ["SS", "SS"], {
    S: "prismarine_shard",
  });
  shaped("prismarine_bricks", "prismarine_bricks", 1, ["SSS", "SSS", "SSS"], {
    S: "prismarine_shard",
  });
  shaped("dark_prismarine", "dark_prismarine", 1, ["SSS", "SIS", "SSS"], {
    S: "prismarine_shard",
    I: "ink_sac",
  });
  shaped("sea_lantern", "sea_lantern", 1, ["SCS", "CCC", "SCS"], {
    S: "prismarine_shard",
    C: "prismarine_crystals",
  });
  shaped("dried_kelp_block", "dried_kelp_block", 1, ["KKK", "KKK", "KKK"], {
    K: "dried_kelp",
  });
  shapeless("unpack_dried_kelp", "dried_kelp", 9, ["dried_kelp_block"]);
  shaped("blue_ice", "blue_ice", 1, ["III", "III", "III"], { I: "packed_ice" });
  shaped("brewing_stand", "brewing_stand", 1, [" R ", "CCC"], {
    R: "blaze_rod",
    C: "cobble",
  });
  shaped("glass_bottle", "glass_bottle", 3, ["G G", " G "], { G: "glass" });
  shapeless("blaze_powder", "blaze_powder", 2, ["blaze_rod"]);
  FUELS.dried_kelp_block = 4000;
  FUELS.blaze_rod = 2400;
  SMELTS.kelp = "dried_kelp";
  SMELTS.cod = "cooked_cod";
  SMELTS.salmon = "cooked_salmon";
}
