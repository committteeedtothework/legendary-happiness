// Append-only IDs: every block and item already stored in a save keeps its ID.
export function appendEndBlocks(blocks) {
  let art = 2400;
  for (const [key, name, color, hardness, extra] of [
    ["end_stone", "End Stone", "#dedfa8", 3, {}],
    ["end_stone_bricks", "End Stone Bricks", "#d7d9ac", 0.8, {}],
    ["purpur_block", "Purpur Block", "#a780ae", 1.5, {}],
    [
      "end_portal_frame",
      "End Portal Frame",
      "#64806d",
      Infinity,
      { bounds: [0, 0, 0, 1, 0.8125, 1] },
    ],
    [
      "end_portal_frame_filled",
      "End Portal Frame · Eye of Ender",
      "#4c8a73",
      Infinity,
      { internal: true, bounds: [0, 0, 0, 1, 0.95, 1] },
    ],
    [
      "end_portal",
      "End Portal",
      "#100c21",
      Infinity,
      { solid: false, transparent: true, internal: true },
    ],
    [
      "end_exit",
      "Exit Portal",
      "#211032",
      Infinity,
      { solid: false, transparent: true, internal: true },
    ],
    [
      "end_gateway",
      "End Gateway",
      "#6d27a0",
      Infinity,
      { solid: false, transparent: true, internal: true },
    ],
    ["chorus_plant", "Chorus Plant", "#725477", 0.4, { drop: "chorus_fruit" }],
    [
      "chorus_flower",
      "Chorus Flower",
      "#d8b8df",
      0.4,
      { drop: "chorus_flower" },
    ],
    ["dragon_egg", "DRAGOON Egg", "#23172d", 3, { tool: "pickaxe", tier: 1 }],
  ])
    (blocks.push({
      key,
      name,
      color,
      hardness,
      tool: "pickaxe",
      tier: 1,
      solid: true,
      transparent: false,
      drop: key,
      endContent: true,
      artTile: art,
      ...extra,
    }),
      (art += 3));
}
export function appendEndItems({ ITEMS, CREATIVE_ITEMS, shapeless, shaped }) {
  Object.assign(ITEMS, {
    ender_pearl: {
      key: "ender_pearl",
      name: "Ender Pearl",
      color: "#168f83",
      stack: 16,
      endContent: true,
    },
    eye_of_ender: {
      key: "eye_of_ender",
      name: "Eye of Ender",
      color: "#7fca63",
      stack: 64,
      endContent: true,
    },
    chorus_fruit: {
      key: "chorus_fruit",
      name: "Chorus Fruit",
      color: "#c998ce",
      stack: 64,
      endContent: true,
    },
    end_crystal: {
      key: "end_crystal",
      name: "End Crystal",
      color: "#f08ee7",
      stack: 64,
      endContent: true,
    },
    dragoon_trophy: {
      key: "dragoon_trophy",
      name: "DRAGOON Trophy",
      color: "#cf96ed",
      stack: 1,
      endContent: true,
    },
    enderman_spawn_egg: {
      key: "enderman_spawn_egg",
      name: "Enderman Spawn Egg",
      color: "#352b3d",
      stack: 64,
      spawnType: "enderman",
    },
  });
  for (const k of [
    "ender_pearl",
    "eye_of_ender",
    "chorus_fruit",
    "end_crystal",
    "dragoon_trophy",
    "enderman_spawn_egg",
  ])
    if (!CREATIVE_ITEMS.includes(k)) CREATIVE_ITEMS.push(k);
  shapeless("eye_of_ender", "eye_of_ender", 1, ["ender_pearl", "blaze_powder"]);
  shaped("end_stone_bricks", "end_stone_bricks", 4, ["EE", "EE"], {
    E: "end_stone",
  });
  // Existing Cinderworld materials keep the resurrection recipe obtainable.
  shaped("end_crystal", "end_crystal", 1, ["GGG", "GEG", "GBG"], {
    G: "glass",
    E: "eye_of_ender",
    B: "blaze_powder",
  });
}
export function appendEndMobs(info, hostiles) {
  Object.assign(info, {
    enderman: {
      name: "Enderman",
      height: 2.9,
      width: 0.6,
      health: 40,
      speed: 2.1,
      damage: 7,
      neutral: true,
      voice: "stalker",
    },
    dragoon: {
      name: "DRAGOON",
      height: 5,
      width: 14,
      health: 200,
      speed: 0,
      flying: true,
      voice: "mad_titan",
    },
    end_crystal: {
      name: "End Crystal",
      height: 2,
      width: 1.4,
      health: 1,
      speed: 0,
      voice: "emberling",
    },
  });
  hostiles.add("enderman");
  hostiles.add("dragoon");
}
