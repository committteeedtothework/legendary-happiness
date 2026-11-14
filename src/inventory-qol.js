import { compatible } from "./inventory.js";
import { ITEMS } from "./data.js";
import { dropItem } from "./simulation.js";
import { validateLocalContainerMenu } from "./world-interactions.js";
export function dropCursorStack(g, one = false) {
  if (!g.inventory.cursor || g.player.health <= 0) return false;
  if (g.multiplayer?.isGuest) {
    g.multiplayer.command("inventory", { action: "drop-cursor", one });
    return true;
  }
  if (!validateLocalContainerMenu(g)) return false;
  const stack = g.inventory.cursor,
    count = one ? 1 : stack.count;
  // Spawn first. A failed action leaves the cursor unchanged.
  dropItem(
    g,
    { ...stack, count },
    g.player.x - Math.sin(g.player.yaw) * 0.9,
    g.player.y + 1,
    g.player.z - Math.cos(g.player.yaw) * 0.9,
    40,
  );
  stack.count -= count;
  if (!stack.count) g.inventory.cursor = null;
  g.ui?.refreshInventory?.();
  return true;
}
export function collectMatching(inv, array, index) {
  if (!inv.cursor && array?.[index]) {
    inv.cursor = array[index];
    array[index] = null;
  }
  const held = inv.cursor;
  if (!held) return false;
  const max = ITEMS[held.id]?.stack || 64;
  for (const array of [inv.slots, inv.craft])
    for (let i = 0; i < array.length && held.count < max; i++) {
      const s = array[i];
      if (compatible(held, s)) {
        const n = Math.min(max - held.count, s.count);
        held.count += n;
        s.count -= n;
        if (!s.count) array[i] = null;
      }
    }
  return true;
}
export function sortBackpack(inv) {
  if (inv.cursor) return false;
  const original = inv.slots.slice(9).filter(Boolean),
    sorted = [];
  for (const stack of original) {
    let n = stack.count;
    for (const s of sorted)
      if (compatible(s, stack)) {
        const a = Math.min(n, (ITEMS[s.id]?.stack || 64) - s.count);
        s.count += a;
        n -= a;
      }
    while (n) {
      const a = Math.min(n, ITEMS[stack.id]?.stack || 64);
      sorted.push({ ...stack, count: a });
      n -= a;
    }
  }
  sorted.sort((a, b) =>
    (ITEMS[a.id]?.name || a.id).localeCompare(ITEMS[b.id]?.name || b.id),
  );
  inv.slots.splice(
    9,
    27,
    ...Array.from({ length: 27 }, (_, i) => sorted[i] || null),
  );
  return true;
}
