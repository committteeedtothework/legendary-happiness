import reference from "./edition-reference.js";
// Append-only content layer. Old numeric IDs and recipe indices never move.
export const EDITION_REFERENCE = "Java Edition 26.3";
export const EDITION_ALIASES = reference.aliases;
export const EDITION_AUDIT = { blocks: [], items: [] };
export const EDITION_RECIPES = { stonecutting: [], smithing: [] };
export const EDITION_REMAINDERS = {
  milk_bucket: "bucket",
  water_bucket: "bucket",
  lava_bucket: "bucket",
  honey_bottle: "glass_bottle",
};
export const editionKey = (key) => reference.aliases[key] || key;
const title = (key) =>
  key
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
const dyes = {
  white: "#dddcd2",
  orange: "#d97c31",
  magenta: "#b95bb0",
  light_blue: "#67aeca",
  yellow: "#e5c34a",
  lime: "#86b74a",
  pink: "#d691ae",
  gray: "#545a60",
  light_gray: "#a1a5a2",
  cyan: "#378d95",
  purple: "#8254ad",
  blue: "#4961b8",
  brown: "#805b3b",
  green: "#627b36",
  red: "#b54c42",
  black: "#292b32",
};
const woods = {
  oak: "#b19260",
  spruce: "#725137",
  birch: "#d2c18b",
  jungle: "#b17c57",
  acacia: "#bb6e42",
  dark_oak: "#593e29",
  mangrove: "#8c4845",
  cherry: "#dda7ad",
  pale_oak: "#d7d6c5",
  bamboo: "#c0aa57",
  crimson: "#85445f",
  warped: "#397d79",
  poplar: "#bca775",
};
export function editionColor(key) {
  for (const d of Object.keys(dyes).sort((a, b) => b.length - a.length))
    if (key.startsWith(d + "_")) return dyes[d];
  for (const [w, c] of Object.entries(woods).sort(
    (a, b) => b[0].length - a[0].length,
  ))
    if (key.includes(w))
      return /leaves|sapling/.test(key)
        ? w === "cherry"
          ? "#e9a4b9"
          : w === "pale_oak"
            ? "#a6afa0"
            : "#598653"
        : c;
  if (/netherite|ancient_debris/.test(key)) return "#544942";
  if (/copper/.test(key))
    return /oxidized/.test(key)
      ? "#4b9b82"
      : /weathered/.test(key)
        ? "#6f9a79"
        : /exposed/.test(key)
          ? "#b18b69"
          : "#c47c58";
  if (/gold/.test(key)) return "#ddb74c";
  if (/diamond/.test(key)) return "#6dcbd0";
  if (/emerald/.test(key)) return "#50b478";
  if (/lapis/.test(key)) return "#4d69b1";
  if (/redstone|nether_wart|crimson/.test(key)) return "#a64048";
  if (/iron|quartz|calcite|diorite/.test(key)) return "#cbd0c7";
  if (/amethyst|purple/.test(key)) return "#9c7ac0";
  if (/resin/.test(key)) return "#cd733b";
  if (/sulfur/.test(key)) return "#b7b448";
  if (/cinnabar/.test(key)) return "#a34f4b";
  if (/blackstone|deepslate|basalt|coal/.test(key)) return "#4d5158";
  if (/tuff/.test(key)) return "#7b8072";
  if (/mud/.test(key)) return "#646057";
  if (/granite/.test(key)) return "#a97c6e";
  if (/sand|bone/.test(key)) return "#d4c18c";
  if (/snow|ice/.test(key)) return "#b6d8e4";
  if (/prismarine/.test(key)) return "#679b94";
  if (/netherrack|nether_brick/.test(key)) return "#713f43";
  if (/soul/.test(key)) return "#655145";
  if (/glowstone|lantern/.test(key)) return "#e7bd67";
  if (/leaves|moss|azalea|grass|plant|sapling|seeds|roots|vine/.test(key))
    return "#6a984b";
  if (/dirt|rooted|podzol/.test(key)) return "#866347";
  if (/mushroom|stem|hyphae/.test(key)) return "#b59a85";
  if (/flower|poppy|rose|tulip/.test(key)) return "#d06d8c";
  if (/glass/.test(key)) return "#b6d7db";
  return "#8c908a";
}
function parentKey(def, existing) {
  let n = def.parent;
  if (!n) return null;
  const candidates = [
    n,
    n + "_planks",
    n + "_block",
    n + "s",
    n.replace(/_brick$/, "_bricks"),
    n.replace(/_tile$/, "_tiles"),
  ];
  if (n === "stone") candidates.unshift("cobblestone");
  return candidates.map(editionKey).find((n) => existing.has(n)) || null;
}
export function appendEditionBlocks(blocks) {
  const existing = new Map(blocks.map((b, i) => [b.key, i]));
  let tile = 600;
  const supportedStations = new Set([
    "barrel",
    "smoker",
    "blast_furnace",
    "stonecutter",
    "smithing_table",
  ]);
  for (const sourceDef of reference.blocks) {
    if (
      [
        "frogspawn",
        "lily_pad",
        "pale_hanging_moss",
        "golden_dandelion",
      ].includes(sourceDef.key)
    )
      continue;
    const def = /_tulip$|^red_shrub$|^cactus_flower$/.test(sourceDef.key)
      ? { ...sourceDef, shape: "plant" }
      : sourceDef;
    const key = editionKey(def.key);
    if (existing.has(key)) continue;
    if (def.shape === "workstation" && !supportedStations.has(key)) continue;
    const id = blocks.length;
    const plant = def.shape === "plant",
      shape = def.shape;
    const hardness = plant
      ? 0
      : /obsidian/.test(key)
        ? 50
        : /ancient_debris/.test(key)
          ? 30
          : /ore|metal|anvil|netherite/.test(key)
            ? 3
            : /leaves/.test(key)
              ? 0.2
              : /glass/.test(key)
                ? 0.3
                : /wool/.test(key)
                  ? 0.8
                  : def.tool === "axe"
                    ? 2
                    : def.tool === "shovel"
                      ? 0.5
                      : 1.5;
    const b = {
      key,
      name: title(def.key),
      color: editionColor(def.key),
      hardness,
      tool: def.tool,
      tier: def.tier,
      drop: key,
      solid: !plant,
      transparent: plant || shape !== "cube" || /glass|leaves|ice/.test(key),
      edition: true,
      shape,
      editionBase: id,
      plant,
      foliage: key.endsWith("_leaves"),
      sapling: def.sapling,
      station: supportedStations.has(key) ? key : null,
    };
    const parent = parentKey(def, existing);
    if (parent) {
      b.artTile =
        blocks[existing.get(parent)].artTile ?? existing.get(parent) * 3;
      b.color = blocks[existing.get(parent)].color;
      b.materialKey = parent;
    } else {
      b.artTile = tile;
      tile += 3;
    }
    b.artOwner = !parent;
    if (
      /lantern|glowstone|shroomlight|froglight|jack_o_lantern|sea_lantern/.test(
        key,
      )
    )
      b.light = 15;
    if (key === "reinforced_deepslate") {
      b.hardness = 55;
      b.drop = null;
    }
    if (/redstone_ore/.test(key)) b.drop = "redstone";
    if (/quartz_ore/.test(key)) b.drop = "quartz";
    if (key === "nether_gold_ore") b.drop = "gold_nugget";
    if (/^deepslate_/.test(key) && key.endsWith("_ore"))
      b.drop = blocks[existing.get(key.replace("deepslate_", ""))]?.drop || key;
    if (/glass/.test(key)) b.drop = null;
    const variants = [];
    if (shape === "slab")
      for (const half of ["bottom", "top", "double"]) variants.push({ half });
    else if (shape === "stairs")
      for (let facing = 0; facing < 4; facing++)
        for (const half of ["bottom", "top"]) variants.push({ facing, half });
    else if (shape === "door")
      for (let facing = 0; facing < 4; facing++)
        for (const open of [false, true])
          for (const upper of [false, true])
            variants.push({ facing, open, upper });
    else if (shape === "trapdoor")
      for (let facing = 0; facing < 4; facing++)
        for (const open of [false, true])
          for (const half of ["bottom", "top"])
            variants.push({ facing, open, half });
    else if (shape === "gate")
      for (let facing = 0; facing < 4; facing++)
        for (const open of [false, true]) variants.push({ facing, open });
    else if (shape === "ladder")
      for (let facing = 0; facing < 4; facing++) variants.push({ facing });
    else if (/_(log|wood|stem|hyphae)$/.test(key))
      for (const axis of ["y", "x", "z"]) variants.push({ axis });
    else variants.push({});
    for (let v = 0; v < variants.length; v++) {
      const state = variants[v],
        entry = {
          ...b,
          key: v ? `${key}__${v}` : key,
          internal: v > 0,
          state,
          variants: variants.length,
        };
      if (shape === "door") entry.door = { ...state, base: id, item: key };
      if (shape === "gate" && state.open) entry.solid = false;
      blocks.push(entry);
    }
    existing.set(key, id);
  }
  // Crop stages are real append-only block states; the harvested items plant them.
  for (const [crop, item, food] of [
    ["carrots", "carrot", "carrot"],
    ["potatoes", "potato", "potato"],
    ["beetroots", "beetroot_seeds", "beetroot"],
    ["sweet_berry_bush", "sweet_berries", "sweet_berries"],
  ]) {
    const base = blocks.length;
    for (let age = 0; age < 4; age++)
      blocks.push({
        key: `${crop}__${age}`,
        name: title(crop),
        color: age === 3 ? "#d8a351" : "#78a344",
        hardness: 0,
        tier: 0,
        solid: false,
        transparent: true,
        internal: true,
        edition: true,
        shape: "plant",
        plant: true,
        crop: { base, age, item, food },
        drop: item,
        artTile: tile + age * 3,
        artOwner: true,
      });
    tile += 12;
  }
  blocks.push({
    key: "heavy_core",
    name: "Heavy Core",
    color: "#777a86",
    hardness: 10,
    tool: "pickaxe",
    tier: 3,
    drop: "heavy_core",
    solid: true,
    transparent: true,
    edition: true,
    shape: "core",
    state: {},
    editionBase: blocks.length,
    variants: 1,
    artOwner: true,
    artTile: tile,
  });
  tile += 3;
  if (tile > 4096) throw new Error("Content atlas capacity exceeded: " + tile);
  if (blocks.length > 65535) throw new Error("16-bit block registry exhausted");
}
export function appendEditionItems({
  ITEMS,
  BLOCKS,
  B,
  CREATIVE_ITEMS,
  RECIPES,
  SMELTS,
  FUELS,
}) {
  if (!ITEMS.bedrock)
    ITEMS.bedrock = {
      key: "bedrock",
      name: "Bedrock",
      color: "#3c4140",
      stack: 64,
      block: B.bedrock,
      edition: true,
      creativeOnly: true,
    };
  const original = new Set(Object.keys(ITEMS).filter((k) => !ITEMS[k].edition));
  for (const i of reference.items) {
    const key = editionKey(i.key);
    if (ITEMS[key]) continue;
    if (
      [
        "brush",
        "snowball",
        "fire_charge",
        "wind_charge",
        "echo_shard",
      ].includes(key)
    )
      continue;
    const suffix = key.split("_").at(-1),
      tool = [
        "pickaxe",
        "axe",
        "shovel",
        "hoe",
        "sword",
        "spear",
        "mace",
      ].includes(suffix)
        ? suffix
        : null;
    const armorSlot = ["helmet", "chestplate", "leggings", "boots"].indexOf(
      suffix,
    );
    const x = {
      key,
      name: title(i.key),
      color: editionColor(key),
      stack: i.stack,
      edition: true,
    };
    if (i.durability) x.durability = i.durability;
    if (i.foodData) {
      x.food = i.foodData.nutrition;
      x.saturation = i.foodData.saturation;
      x.foodEffectsPartial =
        /pufferfish|poisonous|rotten|spider_eye|chorus|golden|suspicious|enchanted/.test(
          key,
        );
    }
    if (["bow", "crossbow", "shield"].includes(key)) x.artifactModel = true;
    if (tool) {
      Object.assign(x, {
        tool,
        tier: key.startsWith("netherite")
          ? 5
          : key.startsWith("copper")
            ? 2
            : 1,
        speed: i.speed || 1,
        attack: 1 + (i.attributes.attack_damage || 0),
        cooldown: 1 / Math.max(0.1, 4 + (i.attributes.attack_speed || 0)),
      });
      if (tool === "spear") x.reach = 4.25;
    }
    if (armorSlot >= 0)
      Object.assign(x, {
        armorSlot,
        armor: i.attributes.armor || 0,
        toughness: i.attributes.armor_toughness || 0,
      });
    ITEMS[key] = x;
  }
  for (const [key, b] of Object.entries(B))
    if (
      BLOCKS[b].edition &&
      !BLOCKS[b].internal &&
      !BLOCKS[b].door?.upper &&
      (!BLOCKS[b].door || key === BLOCKS[b].door.item)
    ) {
      const x = ITEMS[key];
      if (x) {
        x.edition = true;
        x.stack = componentsStack(key);
      }
    }
  const supported = new Set(Object.keys(ITEMS));
  const ingredient = (n) => {
    if (Array.isArray(n)) {
      const a = [
        ...new Set(
          n.flatMap((v) => {
            const x = ingredient(v);
            return Array.isArray(x) ? x : x ? [x] : [];
          }),
        ),
      ];
      return a.length === 1 ? a[0] : a;
    }
    if (typeof n !== "string") return null;
    if (n.startsWith("#")) {
      const a = (reference.tags[n.slice(1).replace("minecraft:", "")] || [])
        .map(editionKey)
        .filter((k) => supported.has(k));
      return a.length === 1 ? a[0] : a;
    }
    const key = editionKey(n.replace("minecraft:", ""));
    return supported.has(key) ? key : null;
  };
  const valid = (n) =>
    typeof n === "string" || (Array.isArray(n) && n.length > 0);
  const oldSignatures = new Set(
    RECIPES.map((r) =>
      JSON.stringify([
        r.result,
        r.count,
        r.pattern || null,
        r.key || r.ingredients,
      ]),
    ),
  );
  for (const [name, r] of Object.entries(reference.recipes)) {
    const result = editionKey(r.result?.id?.replace("minecraft:", "") || "");
    if (!supported.has(result)) continue;
    if (r.type === "minecraft:crafting_shaped") {
      const key = Object.fromEntries(
        Object.entries(r.key).map(([k, v]) => [k, ingredient(v)]),
      );
      if (!Object.values(key).every(valid)) continue;
      const x = {
        id: "edition:" + name,
        result,
        count: r.result.count || 1,
        pattern: trimPattern(r.pattern),
        key,
        edition: true,
      };
      const sig = JSON.stringify([x.result, x.count, x.pattern, x.key]);
      if (!oldSignatures.has(sig)) {
        RECIPES.push(x);
        oldSignatures.add(sig);
      }
    } else if (r.type === "minecraft:crafting_shapeless") {
      const ingredients = r.ingredients.map(ingredient);
      if (!ingredients.every(valid)) continue;
      const x = {
        id: "edition:" + name,
        result,
        count: r.result.count || 1,
        ingredients,
        edition: true,
      };
      const sig = JSON.stringify([x.result, x.count, null, x.ingredients]);
      if (!oldSignatures.has(sig)) {
        RECIPES.push(x);
        oldSignatures.add(sig);
      }
    } else if (r.type === "minecraft:smelting") {
      const input = ingredient(r.ingredient);
      for (const k of Array.isArray(input) ? input : [input])
        if (k && !SMELTS[k]) SMELTS[k] = result;
    } else if (r.type === "minecraft:stonecutting") {
      const input = ingredient(r.ingredient);
      if (valid(input))
        EDITION_RECIPES.stonecutting.push({
          id: name,
          input,
          result,
          count: r.result.count || 1,
        });
    }
  }
  // A native smithing station uses these inputs; each gear item is preserved on upgrade.
  for (const type of [
    "sword",
    "pickaxe",
    "axe",
    "shovel",
    "hoe",
    "helmet",
    "chestplate",
    "leggings",
    "boots",
  ])
    if (ITEMS[`netherite_${type}`])
      EDITION_RECIPES.smithing.push({
        base: `diamond_${type}`,
        addition: "netherite_ingot",
        result: `netherite_${type}`,
      });
  for (const r of EDITION_RECIPES.stonecutting)
    RECIPES.push({
      id: "edition:cut:" + r.id,
      result: r.result,
      count: r.count,
      ingredients: [r.input],
      station: "stonecutter",
      edition: true,
    });
  for (const r of EDITION_RECIPES.smithing)
    RECIPES.push({
      id: "edition:upgrade:" + r.result,
      result: r.result,
      count: 1,
      ingredients: ["netherite_upgrade_smithing_template", r.base, r.addition],
      station: "smithing_table",
      edition: true,
    });
  for (const [key, x] of Object.entries(ITEMS)) {
    if (x.edition && !CREATIVE_ITEMS.includes(key)) CREATIVE_ITEMS.push(key);
    if (/planks|_log|_wood|_stem|_hyphae/.test(key)) FUELS[key] = 300;
    if (
      /_fence|_gate|_slab|_stairs|_door|_trapdoor/.test(key) &&
      BLOCKS[x.block]?.tool === "axe"
    )
      FUELS[key] = 150;
  }
  // Explicit audit covers every reference entry, including items intentionally not instantiated.
  for (const kind of ["blocks", "items"])
    for (const n of kind === "blocks"
      ? reference.blockNames
      : reference.itemNames) {
      const key = editionKey(n),
        entry = kind === "blocks" ? BLOCKS[B[key]] : ITEMS[key],
        excluded = reference.exclusions[n];
      const status = excluded
        ? "excluded"
        : entry
          ? entry.edition
            ? "added"
            : "retained"
          : "deferred";
      const note =
        excluded ||
        (!entry
          ? "Requires an additional simulation, creature, dimension, or workstation system."
          : entry.edition
            ? "Original model/art; implemented family behavior. See CONTENT.md for shared limitations."
            : "Existing DCSMCRAFT content retained; mechanics follow the existing implementation.");
      EDITION_AUDIT[kind].push({ reference: n, key, status, note });
    }
}
function componentsStack(key) {
  return /_door$/.test(key) ? 64 : 64;
}

function trimPattern(rows) {
  const occupied = [];
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== " ") occupied.push([x, y]);
    }),
  );
  const xs = occupied.map((p) => p[0]),
    ys = occupied.map((p) => p[1]),
    left = Math.min(...xs),
    right = Math.max(...xs);
  return rows
    .slice(Math.min(...ys), Math.max(...ys) + 1)
    .map((row) => row.slice(left, right + 1));
}
