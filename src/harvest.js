import { B, ITEMS, BLOCKS, makeStack } from "./data.js";
import { enchantLevel } from "./equipment.js";

// One authoritative harvest decision is used by the owner and Survival guests.
// Fortune never multiplies storage blocks, containers, equipment or slab merges.
export function blockHarvest(id, held, crop, random = Math.random) {
  const b = BLOCKS[id],
    drops = [];
  if (!b) return { drops, xp: 0 };
  const add = (key, count = 1) => {
    if (key && ITEMS[key] && count > 0) drops.push(makeStack(key, count));
  };
  const silk = enchantLevel(held, "silk_touch") > 0;
  const fortune = silk ? 0 : enchantLevel(held, "fortune");
  const multiplier = () =>
    fortune ? Math.max(1, Math.floor(random() * (fortune + 2))) : 1;
  let key = b.drop,
    count = b.pickles || (id === B.clay ? 4 : 1),
    xp = 0;
  if (b.eggs && silk) {
    add("turtle_egg_1_0", b.eggs);
    return { drops, xp };
  }
  if (
    silk &&
    !b.crop &&
    ![B.crop, B.farmland].includes(id) &&
    ITEMS[b.key]?.block !== undefined &&
    (/_ore$/.test(b.key) ||
      b.foliage ||
      [B.grass, B.glass, B.ice, B.clay, B.leaves].includes(id))
  ) {
    add(b.key, b.pickles || 1);
    return { drops, xp };
  }
  if (id === B.leaves || b.foliage)
    key = random() < 0.12 ? "apple" : random() < 0.25 ? "stick" : null;
  if (b.crop?.age === 3) add(b.crop.food, 2);
  if (b.edition && b.foliage) {
    const sapling = b.key.replace("_leaves", "") + "_sapling";
    key =
      held?.id === "shears"
        ? b.drop
        : random() < 0.08 && ITEMS[sapling]
          ? sapling
          : null;
  } else if (
    (b.foliage || id === B.leaves) &&
    held?.id === "shears" &&
    ITEMS[b.key]
  )
    key = b.key;
  if (b.edition && b.shape === "slab" && b.state.half === "double" && key)
    count = 2;
  if (id === B.glass) key = null;
  if (
    id === B.gravel &&
    !silk &&
    random() < [0.1, 1 / 7, 0.25, 1][Math.min(3, fortune)]
  )
    key = "flint";
  if (id === B.crop) {
    key = "seeds";
    if (crop?.age >= 7) add("wheat");
  }
  if (/_ore$/.test(b.key)) {
    if (
      [
        "diamond",
        "emerald",
        "coal",
        "lapis_lazuli",
        "raw_copper",
        "raw_iron",
        "raw_gold",
      ].includes(key)
    ) {
      if (key === "lapis_lazuli") count = 4 + Math.floor(random() * 6);
      if (key === "raw_copper") count = 2 + Math.floor(random() * 4);
      count *= multiplier();
    }
    if (/^(deepslate_)?(coal|diamond)_ore$/.test(b.key)) xp = 1;
  }
  add(key, count);
  if (id === B.grass && !silk && random() < 0.35) add("seeds");
  return { drops, xp };
}
