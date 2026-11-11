import { ITEMS } from "./data.js";
export const enchantLevel = (stack, id) =>
  Math.max(0, Math.min(5, Math.floor(stack?.enchantments?.[id] || 0)));
export function wear(stack, amount = 1, random = Math.random) {
  if (!stack || stack.durability === undefined || ITEMS[stack.id]?.unbreakable)
    return false;
  const chance = 1 / (enchantLevel(stack, "unbreaking") + 1);
  for (let i = 0; i < amount; i++) if (random() < chance) stack.durability--;
  return stack.durability <= 0;
}
export function equipHeld(inventory) {
  const held = inventory.held,
    slot = ITEMS[held?.id]?.armorSlot;
  if (slot === undefined) return false;
  [inventory.slots[inventory.selected], inventory.equipment[slot]] = [
    inventory.equipment[slot],
    held,
  ];
  return true;
}
export function armorStats(inventory) {
  return (inventory.equipment || []).reduce(
    (s, stack) => {
      const item = ITEMS[stack?.id];
      if (item) {
        s.armor += item.armor || 0;
        s.toughness += item.toughness || 0;
        s.protection += enchantLevel(stack, "protection");
      }
      return s;
    },
    { armor: 0, toughness: 0, protection: 0 },
  );
}
export function reduceDamage(inventory, incoming, cause) {
  const s = armorStats(inventory),
    fall = /fall/i.test(cause),
    bypass = /void|starvation/.test(cause);
  if (bypass) return incoming;
  let amount = incoming;
  if (!fall && !/drowning|suffocation/.test(cause)) {
    const effective = Math.min(
      20,
      Math.max(s.armor / 5, s.armor - incoming / (2 + s.toughness / 4)),
    );
    amount *= 1 - effective / 25;
    (inventory.equipment || []).forEach((stack, i) => {
      if (wear(stack, Math.max(1, Math.floor(incoming / 4))))
        inventory.equipment[i] = null;
    });
  }
  const protection =
    s.protection +
    (inventory.equipment || []).reduce(
      (n, stack) =>
        n +
        (/lava|fire|burn|ember|cinder/i.test(cause)
          ? enchantLevel(stack, "fire_protection") * 2
          : 0) +
        (/explosion|creeper|blast|tnt/i.test(cause)
          ? enchantLevel(stack, "blast_protection") * 2
          : 0) +
        (/arrow|projectile|bolt|bullet|trident/i.test(cause)
          ? enchantLevel(stack, "projectile_protection") * 2
          : 0),
      0,
    ) +
    (fall ? enchantLevel(inventory.equipment?.[3], "feather_falling") * 3 : 0);
  const firePieces = /lava|fire|ember|cinder/i.test(cause)
    ? (inventory.equipment || []).filter((s) => s?.id.startsWith("hellfire_"))
        .length
    : 0;
  return (
    amount * (1 - Math.min(20, protection) * 0.04) * (1 - firePieces * 0.1)
  );
}
export function awardXP(game, amount) {
  let remaining = amount;
  for (const stack of [
    game.inventory.held,
    ...(game.inventory.equipment || []),
  ]) {
    const max = ITEMS[stack?.id]?.durability;
    if (
      !stack ||
      !max ||
      !enchantLevel(stack, "mending") ||
      stack.durability >= max
    )
      continue;
    const repair = Math.min(max - stack.durability, remaining * 2);
    stack.durability += repair;
    remaining -= repair / 2;
  }
  game.player.xp += remaining;
}
export const ENCHANTMENTS = {
  silk_touch: {
    name: "Silk Touch",
    max: 1,
    fits: (i) => ["pickaxe", "axe", "shovel", "hoe"].includes(i?.tool),
  },
  fortune: {
    name: "Fortune",
    max: 3,
    fits: (i) => ["pickaxe", "axe", "shovel", "hoe"].includes(i?.tool),
  },
  looting: { name: "Looting", max: 3, fits: (i) => i?.tool === "sword" },
  smite: {
    name: "Smite",
    max: 5,
    fits: (i) => ["sword", "axe"].includes(i?.tool),
  },
  bane_of_arthropods: {
    name: "Bane of Arthropods",
    max: 5,
    fits: (i) => ["sword", "axe"].includes(i?.tool),
  },
  fire_aspect: {
    name: "Fire Aspect",
    max: 2,
    fits: (i) => i?.tool === "sword",
  },
  fire_protection: {
    name: "Fire Protection",
    max: 4,
    fits: (i) => i?.armorSlot !== undefined,
  },
  blast_protection: {
    name: "Blast Protection",
    max: 4,
    fits: (i) => i?.armorSlot !== undefined,
  },
  projectile_protection: {
    name: "Projectile Protection",
    max: 4,
    fits: (i) => i?.armorSlot !== undefined,
  },
  respiration: { name: "Respiration", max: 3, fits: (i) => i?.armorSlot === 0 },
  aqua_affinity: {
    name: "Aqua Affinity",
    max: 1,
    fits: (i) => i?.armorSlot === 0,
  },
  mending: { name: "Mending", max: 1, fits: (i) => !!i?.durability },
  loyalty: { name: "Loyalty", max: 3, fits: (i) => i?.tool === "trident" },
  impaling: { name: "Impaling", max: 5, fits: (i) => i?.tool === "trident" },
  channeling: {
    name: "Channeling",
    max: 1,
    fits: (i) => i?.tool === "trident",
  },
  riptide: { name: "Riptide", max: 3, fits: (i) => i?.tool === "trident" },
  lure: { name: "Lure", max: 3, fits: (i) => i?.tool === "fishing_rod" },
  luck_of_the_sea: {
    name: "Luck of the Sea",
    max: 3,
    fits: (i) => i?.tool === "fishing_rod",
  },
  sharpness: {
    name: "Sharpness",
    max: 5,
    fits: (i) => ["sword", "axe", "spear"].includes(i?.tool),
  },
  efficiency: {
    name: "Efficiency",
    max: 5,
    fits: (i) => ["pickaxe", "axe", "shovel", "hoe"].includes(i?.tool),
  },
  unbreaking: { name: "Unbreaking", max: 3, fits: (i) => !!i?.durability },
  protection: {
    name: "Protection",
    max: 4,
    fits: (i) => i?.armorSlot !== undefined,
  },
  feather_falling: {
    name: "Feather Falling",
    max: 4,
    fits: (i) => i?.armorSlot === 3,
  },
  knockback: {
    name: "Knockback",
    max: 2,
    fits: (i) => ["sword", "spear"].includes(i?.tool),
  },
};
export const enchantCost = (level) => ({ xp: 5 * level, lapis: level });
export function enchantConflict(stack, id) {
  return [
    ["silk_touch", "fortune"],
    ["sharpness", "smite", "bane_of_arthropods"],
    [
      "protection",
      "fire_protection",
      "blast_protection",
      "projectile_protection",
    ],
    ["riptide", "loyalty"],
    ["riptide", "channeling"],
  ].some(
    (group) =>
      group.includes(id) &&
      group.some((other) => other !== id && enchantLevel(stack, other)),
  );
}
export function enchantItem(game, index, id) {
  const stack = game.inventory.slots[index],
    e = ENCHANTMENTS[id],
    item = ITEMS[stack?.id];
  if (!stack || !e || !e.fits(item))
    return { ok: false, message: "Choose compatible equipment." };
  if (enchantConflict(stack, id))
    return {
      ok: false,
      message: "That enchantment conflicts with an existing enchantment.",
    };
  if (
    (id === "riptide" &&
      (enchantLevel(stack, "loyalty") || enchantLevel(stack, "channeling"))) ||
    (["loyalty", "channeling"].includes(id) && enchantLevel(stack, "riptide"))
  )
    return {
      ok: false,
      message: "Riptide cannot combine with Loyalty or Channeling.",
    };
  const level = enchantLevel(stack, id) + 1,
    cost = enchantCost(level);
  if (level > e.max)
    return { ok: false, message: "Maximum enchantment level reached." };
  const lapis = game.inventory.slots.reduce(
    (n, s) => n + (s?.id === "lapis_lazuli" ? s.count : 0),
    0,
  );
  if (
    game.mode !== "creative" &&
    (game.player.xp < cost.xp || lapis < cost.lapis)
  )
    return {
      ok: false,
      message: `Requires ${cost.xp} XP points and ${cost.lapis} lapis.`,
    };
  if (game.mode !== "creative") {
    let left = cost.lapis;
    for (let i = 0; i < 36 && left; i++)
      if (game.inventory.slots[i]?.id === "lapis_lazuli") {
        const n = Math.min(left, game.inventory.slots[i].count);
        game.inventory.consume(i, n);
        left -= n;
      }
    game.player.xp -= cost.xp;
  }
  stack.enchantments = { ...stack.enchantments, [id]: level };
  game.audio?.tone("enchant");
  game.ui?.updateHotbar();
  return { ok: true, message: `${e.name} ${level} applied.` };
}
export function enchantText(stack) {
  return Object.entries(stack?.enchantments || {})
    .map(([id, level]) => `${ENCHANTMENTS[id]?.name || id} ${level}`)
    .join(" · ");
}
