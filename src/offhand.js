import { ITEMS, B, BLOCKS } from "./data.js";
import { wear } from "./equipment.js";
// Run a synchronous existing item action against the actual secondary stack.
// Restore the main slot even if a tool breaks, a placement consumes the stack,
// or an interaction throws. No copied inventory or extra item is introduced.
export function withOffhand(g, action) {
  const inv = g.inventory;
  if (!inv.offhand?.[0] || g.usingOffhand) return false;
  const index = inv.selected,
    main = inv.slots[index];
  inv.slots[index] = inv.offhand[0];
  inv.offhand[0] = main;
  g.usingOffhand = true;
  inv.offhandContextIndex=index;
  try {
    return action();
  } finally {
    const primaryAfter=inv.offhand[0];
    inv.offhand[0] = inv.slots[index];
    inv.slots[index] = primaryAfter;
    inv.selected = index;
    g.usingOffhand = false;
    delete inv.offhandContextIndex;
    g.ui?.updateHotbar?.();
  }
}
export function swapHands(g) {
  if (g.multiplayer?.isGuest) return g.multiplayer.command("swap-hands");
  const inv = g.inventory;
  g.endSecondaryInput?.();
  [inv.slots[inv.selected], inv.offhand[0]] = [inv.offhand[0], inv.held];
  g.player.shieldRaised = false;
  g.ui?.updateHotbar?.();
  g.audio?.tone?.("equip");
  return true;
}
export function useOffhand(g) {
  if (!g.inventory.offhand?.[0] || g.usingOffhand) return false;
  if (g.multiplayer?.isGuest) return g.multiplayer.command("offhand-use");
  return withOffhand(g, () => {
    const id = g.inventory.held.id;
    g.player.activeHand = "off";
    if (
      ITEMS[id]?.attack ||
      ["sword", "axe", "pickaxe", "spear"].includes(ITEMS[id]?.tool)
    ) {
      g.player.offhandSwingUntil = g.elapsed + 0.22;
      g.tryAttack();
      return true;
    }
    g.lastPlace = -Infinity;
    g.use();
    if (g.player.editionDraw) g.player.editionDraw.hand = "off";
    if (id === "shield") g.player.shieldHand = "off";
    return true;
  });
}
export function raisedShield(inv, p) {
  return p.shieldRaised
    ? (p.shieldHand === "off" ? inv.offhand?.[0] : inv.held)?.id === "shield"
      ? p.shieldHand === "off"
        ? inv.offhand[0]
        : inv.held
      : null
    : null;
}
export function shieldMelee(g, amount, cause, from) {
  const stack = raisedShield(g.inventory, g.player);
  if (
    !stack ||
    /fall|void|starv|drown|suffocat|fire|lava|breath|poison|weather|pearl|explosion|creeper/i.test(
      cause,
    )
  )
    return amount;
  if (!from || Math.hypot(from.x - g.player.x, from.z - g.player.z) > 5)
    return amount;
  const dx = from.x - g.player.x,
    dz = from.z - g.player.z,
    n = Math.hypot(dx, dz) || 1;
  if ((-Math.sin(g.player.yaw) * dx - Math.cos(g.player.yaw) * dz) / n < 0.2)
    return amount;
  if (g.mode !== "creative" && wear(stack, Math.max(1, Math.ceil(amount)))) {
    if (g.player.shieldHand === "off") g.inventory.offhand[0] = null;
    else g.inventory.slots[g.inventory.selected] = null;
  }
  g.audio?.tone?.("guardian-impact");
  return 0;
}

export function shouldUseOffhand(g) {
  if (
    !g.inventory.offhand?.[0] ||
    g.inventory.held?.id === "matthew_dual_pistols"
  )
    return false;
  if (g.keys?.has("AltLeft")) return true;
  const t = g.target;
  if (
    t &&
    (BLOCKS[t.id]?.door ||
      BLOCKS[t.id]?.station ||
      [
        B.chest,
        B.furnace,
        B.crafting_table,
        B.bed,
        B.enchanting_table,
        B.jukebox,
      ].includes(t.id))
  )
    return false;
  if (g.targetEntity?.()?.type === "villager") return false;
  return !g.inventory.held || !!ITEMS[g.inventory.held.id]?.attack;
}
